import { CORS_HEADERS, json, parseEventBody, compactSignals, buildEvidenceDigest, callOpenAI, upsertAiJob, appendAiJobLog, connectBlobsFromEvent, getPackageUploadBytes } from "./_shared.js";
import {
  buildDocumentPlanSystemPrompt,
  buildDocumentPlanUserPayload,
  buildFileAnalysisSystemPrompt,
  buildFileAnalysisUserPayload,
  buildFinalSuiteSystemPrompt,
  buildFinalSuiteUserPayload,
} from "./_document-generation-prompts.js";
import {
  documentGenerationPlanSchema,
  requiredSuiteShape,
  suiteResponseSchema,
} from "./_document-generation-schemas.js";

const JOB_TYPE = "generate-documents";

export const config = {
  background: true,
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed." });

  let jobId = "";
  try {
    console.info("generate-documents-background: request received", {
      method: event.httpMethod,
      requestId: event.headers?.["x-nf-request-id"] || event.headers?.["x-request-id"] || "",
      bodyBytes: event.body ? Buffer.byteLength(event.body, event.isBase64Encoded ? "base64" : "utf8") : 0,
      isBase64Encoded: Boolean(event.isBase64Encoded),
    });
    connectBlobsFromEvent(event);
    const request = parseEventBody(event);
    jobId = normalizeJobId(request.jobId);
    const context = buildGenerationContext(request, jobId);
    console.info("generate-documents-background: request parsed", {
      jobId,
      generationMode: context.generationMode,
      hasPackageUpload: hasPackageUploadPayload(context.packageUpload),
      packageName: context.packageUpload?.name || "",
      packageSize: context.packageUpload?.size || 0,
      uploadedRequirementCount: context.uploadedRequirements.length,
    });
    await appendAiJobLog(JOB_TYPE, jobId, {
      stage: "queued",
      message: "Document generation request received.",
      meta: {
        generationMode: context.generationMode,
        packageSummary: context.auditRequest.packageSignals,
      },
    });
    await upsertAiJob(JOB_TYPE, jobId, {
      status: "running",
      stage: "queued",
      progress: 1,
      message: "Queued AI document generation.",
      request: context.auditRequest,
    });

    const result = await generateWithAI(context, async (update) => {
      await upsertAiJob(JOB_TYPE, jobId, {
        status: "running",
        ...update,
      });
    });

    await upsertAiJob(JOB_TYPE, jobId, {
      status: "completed",
      stage: "done",
      progress: 100,
      message: "Document generation completed.",
      result,
    });

    return json(202, { jobId, status: "accepted" });
  } catch (error) {
    console.error("generate-documents-background failed", {
      jobId,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
    if (jobId) {
      await appendAiJobLog(JOB_TYPE, jobId, {
        level: "error",
        stage: "failed",
        message: error.message || "Document generation failed.",
        meta: {
          stack: String(error.stack || "").slice(0, 1200),
        },
      }).catch(() => {});
      await upsertAiJob(JOB_TYPE, jobId, {
        status: "failed",
        stage: "failed",
        progress: 100,
        message: error.message || "Document generation failed.",
      });
    }
    return json(500, { message: error.message || "Document generation failed." });
  }
};

async function generateWithAI(context, reportProgress) {
  if (hasPackageUploadPayload(context.packageUpload) && context.generationMode === "initial") {
    await preloadPackageMaterial(context);
    await reportProgress({ stage: "file-analysis", progress: 10, message: "Uploading package to OpenAI for full source analysis." });
    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "file-analysis",
      message: "Using OpenAI file/tool workflow for full package inspection.",
      meta: {
        fileName: context.packageUpload.name,
        size: context.packageUpload.size,
        blobUploadId: context.packageUpload.blobUploadId || "",
        model: resolveDocumentGenerationModel(),
      },
    });
    const suite = await buildSuiteFromPackageFile(context, reportProgress);
    await reportProgress({ stage: "verifying", progress: 85, message: "Verifying output quality and traceability." });
    const validated = validateSuite(suite);
    if (!validated) throw new Error("AI document generation returned an invalid suite.");
    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "done",
      message: "File-based document generation succeeded.",
      meta: { brdTitle: validated?.brd?.title || "", bddCount: validated?.bddFiles?.length || 0 },
    });
    return validated;
  }

  await reportProgress({ stage: "planning", progress: 10, message: "Planning document structure." });
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "planning",
    message: "Planning BRD and BDD structure with the configured document generation model.",
    meta: { model: resolveDocumentGenerationModel(), temperature: 0.1 },
  });
  const plan = await buildDocumentPlan(context);

  await reportProgress({ stage: "drafting", progress: 45, message: "Drafting BRD and BDD content." });
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "drafting",
    message: "Drafting final BRD and BDD suite.",
    meta: { primaryCapabilities: plan.primaryCapabilities?.length || 0, bddClusters: plan.bddClusters?.length || 0 },
  });
  const suite = await buildFinalSuite(context, plan);

  await reportProgress({ stage: "verifying", progress: 85, message: "Verifying output quality and traceability." });
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "verifying",
    message: "Validating output quality and traceability before completion.",
  });
  const validated = validateSuite(suite);
  if (!validated) {
    await appendAiJobLog(JOB_TYPE, context.jobId, {
      level: "error",
      stage: "verifying",
      message: "Generated suite failed validation.",
    });
    throw new Error("AI document generation returned an invalid suite.");
  }

  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "done",
    message: "Document generation succeeded.",
    meta: { brdTitle: validated?.brd?.title || "", bddCount: validated?.bddFiles?.length || 0 },
  });
  return validated;
}

function buildGenerationContext(request, jobId) {
  const signals = compactSignals(request.packageSignals);
  return {
    jobId,
    generationMode: request.generationMode || "initial",
    targetDocument: request.targetDocument || null,
    targetGap: request.targetGap || null,
    packageUpload: normalizePackageUpload(request.packageUpload),
    uploadedRequirements: Array.isArray(request.uploadedRequirements) ? request.uploadedRequirements : [],
    gapResults: request.gapResults || null,
    signals,
    auditRequest: {
      generationMode: request.generationMode || "initial",
      targetDocument: request.targetDocument || null,
      targetGap: request.targetGap || null,
      uploadedRequirementCount: Array.isArray(request.uploadedRequirements) ? request.uploadedRequirements.length : 0,
      hasPackageUpload: hasPackageUploadPayload(request.packageUpload),
      hasGapResults: Boolean(request.gapResults),
      packageSignals: summarizeSignals(signals),
    },
  };
}

async function buildSuiteFromPackageFile(context, reportProgress) {
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "file-upload",
    message: "Uploading source package to OpenAI Files API.",
    meta: {
      fileName: context.packageUpload.name,
      size: context.packageUpload.size,
      blobUploadId: context.packageUpload.blobUploadId || "",
      purpose: process.env.OPENAI_FILE_PURPOSE || "user_data",
    },
  });
  const uploadResult = await uploadPackageToOpenAI(context.packageUpload);
  const fileId = uploadResult.fileId;
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "file-upload",
    message: "OpenAI file upload completed.",
    meta: {
      fileId,
      blobReadMs: uploadResult.timings.blobReadMs,
      openAiFileUploadMs: uploadResult.timings.openAiFileUploadMs,
      packageBytes: uploadResult.timings.packageBytes,
    },
  });
  try {
    await reportProgress({ stage: "file-analysis", progress: 25, message: "Analyzing package structure with OpenAI Code Interpreter." });
    const system = buildFileAnalysisSystemPrompt();
    const evidenceDigest = buildEvidenceDigest(context.signals);
    const userPayload = buildFileAnalysisUserPayload({
      context,
      evidenceDigest,
      requiredOutputShape: requiredSuiteShape(),
    });
    const user = JSON.stringify(userPayload);

    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "file-analysis",
      message: "Calling OpenAI Responses API with Code Interpreter and uploaded package.",
      meta: { fileId, packageName: context.packageUpload.name },
    });

    await reportProgress({ stage: "drafting", progress: 55, message: "Generating BRD and BDD suite from full package evidence." });
    const toolResult = await callOpenAIFileTool({
      system,
      user,
      fileId,
      responseSchema: suiteResponseSchema(),
      temperature: 0.12,
    });
    const result = toolResult.result;
    if (!result) throw new Error("File-based document generation returned no response.");
    const normalized = normalizeSuite(result, "ai_file_tool_generated");
    const qualityGate = evaluateSuiteDepth(normalized);
    if (!qualityGate.passed) {
      await appendAiJobLog(JOB_TYPE, context.jobId, {
        stage: "drafting",
        message: "Generated suite did not meet the full quality gate, but retry regeneration is disabled for single-pass deep analysis.",
        meta: qualityGate,
      });
    }
    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "drafting",
      message: "File-based generation response received from OpenAI.",
      meta: {
        bddCount: normalized.bddFiles?.length || 0,
        brdChars: String(normalized.brd?.content || "").length,
        responseCreateMs: toolResult.timings.responseCreateMs,
        responseWaitMs: toolResult.timings.responseWaitMs,
        responseRetrieveMs: toolResult.timings.responseRetrieveMs,
        responseRetrieveAttempts: toolResult.timings.responseRetrieveAttempts,
        finalizationMs: toolResult.timings.finalizationMs,
        totalOpenAiMs: toolResult.timings.totalOpenAiMs,
      },
    });
    return normalized;
  } finally {
    await deleteOpenAIFile(fileId).catch(() => {});
  }
}

async function uploadPackageToOpenAI(packageUpload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for file-based document generation.");
  const blobReadStartedAt = Date.now();
  const storedPackage = packageUpload.packageMaterial || (packageUpload.blobUploadId ? await getPackageUploadBytes(packageUpload.blobUploadId) : null);
  const blobReadMs = Date.now() - blobReadStartedAt;
  const bytes = storedPackage?.bytes || Buffer.from(packageUpload.contentBase64 || "", "base64");
  if (!bytes.length) throw new Error("Package upload was empty.");
  const form = new FormData();
  form.append("purpose", process.env.OPENAI_FILE_PURPOSE || "user_data");
  form.append("file", new Blob([bytes], { type: storedPackage?.type || packageUpload.type || "application/zip" }), storedPackage?.name || packageUpload.name || "source-package.zip");
  const uploadStartedAt = Date.now();
  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const openAiFileUploadMs = Date.now() - uploadStartedAt;
  const raw = await response.text();
  const payload = parseJsonOrNull(raw);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI file upload failed with ${response.status}: ${raw.slice(0, 240)}`);
  }
  if (!payload?.id) throw new Error("OpenAI file upload did not return a file id.");
  return {
    fileId: payload.id,
    timings: {
      blobReadMs,
      openAiFileUploadMs,
      packageBytes: bytes.length,
    },
  };
}

async function deleteOpenAIFile(fileId) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !fileId) return;
  await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

async function callOpenAIFileTool({
  system,
  user,
  fileId,
  responseSchema,
  temperature = 0.1,
  timeoutMs = Number(process.env.OPENAI_FILE_TOOL_TIMEOUT_MS || 1200000),
  requestTimeoutMs = Number(process.env.OPENAI_FILE_TOOL_REQUEST_TIMEOUT_MS || 180000),
  finalizationTimeoutMs = Number(process.env.OPENAI_FILE_TOOL_FINALIZATION_TIMEOUT_MS || 420000),
  pollIntervalMs = Number(process.env.OPENAI_FILE_TOOL_POLL_INTERVAL_MS || 3000),
  model = resolveDocumentGenerationModel(),
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for OpenAI file tools.");
  const totalOpenAiStartedAt = Date.now();
  const effectiveTimeoutMs = Math.max(timeoutMs, 600000);
  const effectiveRequestTimeoutMs = Math.max(requestTimeoutMs, 120000);
  const effectiveFinalizationTimeoutMs = Math.max(finalizationTimeoutMs, 240000);
  const effectivePollIntervalMs = Math.max(pollIntervalMs, 1500);
  const createStartedAt = Date.now();
  const createPayload = await postOpenAIResponse({
    apiKey,
    timeoutMs: effectiveRequestTimeoutMs,
    body: {
      model,
      background: true,
      instructions: system,
      input: user,
      temperature,
      max_output_tokens: Number(process.env.OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS || 30000),
      tools: [
        {
          type: "code_interpreter",
          container: {
            type: "auto",
            file_ids: [fileId],
          },
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: responseSchema.name,
          schema: responseSchema.schema,
          strict: true,
        },
      },
    },
    timeoutLabel: "request",
  });
  const responseCreateMs = Date.now() - createStartedAt;
  const waitStartedAt = Date.now();
  const waitResult = await waitForOpenAIResponse({
    apiKey,
    initialPayload: createPayload,
    timeoutMs: effectiveTimeoutMs,
    pollIntervalMs: effectivePollIntervalMs,
  });
  const responseWaitMs = Date.now() - waitStartedAt;
  const payload = waitResult.payload;
  let outputText = extractResponseText(payload);
  let finalizationMs = 0;
  let recoveryMs = 0;
  if (!String(outputText || "").trim() && payload?.id) {
    const finalizationStartedAt = Date.now();
    outputText = await requestFinalJsonFromResponse({
      apiKey,
      model,
      previousResponseId: payload.id,
      responseSchema,
      timeoutMs: effectiveFinalizationTimeoutMs,
      pollIntervalMs: effectivePollIntervalMs,
    });
    finalizationMs = Date.now() - finalizationStartedAt;
  }
  if (!String(outputText || "").trim() && isFileToolRecoveryEnabled()) {
    const recoveryStartedAt = Date.now();
    outputText = await requestRecoveryJsonWithFile({
      apiKey,
      model,
      system,
      user,
      fileId,
      responseSchema,
      temperature,
      timeoutMs: effectiveTimeoutMs,
      requestTimeoutMs: effectiveRequestTimeoutMs,
      pollIntervalMs: effectivePollIntervalMs,
    });
    recoveryMs = Date.now() - recoveryStartedAt;
  }
  if (!String(outputText || "").trim()) {
    throw new Error(`OpenAI file-tool returned no final text output. ${summarizeResponsePayload(payload)}`);
  }
  try {
    return {
      result: JSON.parse(outputText),
      timings: {
        responseCreateMs,
        responseWaitMs,
        responseRetrieveMs: waitResult.retrieveMs,
        responseRetrieveAttempts: waitResult.retrieveAttempts,
        finalizationMs,
        recoveryMs,
        totalOpenAiMs: Date.now() - totalOpenAiStartedAt,
      },
    };
  } catch {
    throw new Error(`OpenAI file-tool returned invalid JSON content: ${String(outputText || "").slice(0, 180)} ${summarizeResponsePayload(payload)}`);
  }
}

async function requestFinalJsonFromResponse({ apiKey, model, previousResponseId, responseSchema, timeoutMs, pollIntervalMs }) {
  const attempts = [
    {
      label: "finalization",
      body: {
        model,
        background: true,
        previous_response_id: previousResponseId,
        input:
          "The prior tool run completed without a final assistant message. Using the analysis already performed in that response, return the final deliverable JSON only. Do not call tools again. Do not include markdown, prose, or code fences.",
        temperature: 0,
        max_output_tokens: Number(process.env.OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS || 30000),
        tools: [],
        text: {
          format: {
            type: "json_schema",
            name: responseSchema.name,
            schema: responseSchema.schema,
            strict: true,
          },
        },
      },
    },
    {
      label: "finalization-fallback",
      body: {
        model,
        background: false,
        previous_response_id: previousResponseId,
        instructions:
          "Return the final structured JSON using the already completed analysis from the previous response. Do not call tools again. Do not add prose or markdown.",
        input: "Return only the final JSON payload now.",
        temperature: 0,
        max_output_tokens: Number(process.env.OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS || 30000),
        tools: [],
        text: {
          format: {
            type: "json_schema",
            name: responseSchema.name,
            schema: responseSchema.schema,
            strict: true,
          },
        },
      },
    },
  ];

  for (const attempt of attempts) {
    const createPayload = await postOpenAIResponse({
      apiKey,
      timeoutMs,
      body: attempt.body,
      timeoutLabel: attempt.label,
    });
    const payload = await waitForOpenAIResponse({
      apiKey,
      initialPayload: createPayload,
      timeoutMs,
      pollIntervalMs,
    });
    const extracted = extractResponseText(payload);
    if (String(extracted || "").trim()) return extracted;
  }
  return "";
}

async function requestRecoveryJsonWithFile({
  apiKey,
  model,
  system,
  user,
  fileId,
  responseSchema,
  temperature,
  timeoutMs,
  requestTimeoutMs,
  pollIntervalMs,
}) {
  const createPayload = await postOpenAIResponse({
    apiKey,
    timeoutMs: requestTimeoutMs,
    body: {
      model,
      background: false,
      instructions: `${system}\n\nIf the prior tool run finished without returning the final schema payload, rerun the analysis and return only the final JSON that matches the schema exactly. Do not return prose or markdown.`,
      input: user,
      temperature,
      max_output_tokens: Number(process.env.OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS || 30000),
      tools: [
        {
          type: "code_interpreter",
          container: {
            type: "auto",
            file_ids: [fileId],
          },
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: responseSchema.name,
          schema: responseSchema.schema,
          strict: true,
        },
      },
    },
    timeoutLabel: "recovery",
  });
  const waitResult = await waitForOpenAIResponse({
    apiKey,
    initialPayload: createPayload,
    timeoutMs,
    pollIntervalMs,
  });
  return extractResponseText(waitResult.payload);
}

async function postOpenAIResponse({ apiKey, body, timeoutMs, timeoutLabel }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`OpenAI file-tool ${timeoutLabel} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const raw = await response.text();
  const payload = parseJsonOrNull(raw);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI file-tool ${timeoutLabel} failed with ${response.status}: ${raw.slice(0, 400)}`);
  }
  return payload;
}

async function waitForOpenAIResponse({ apiKey, initialPayload, timeoutMs, pollIntervalMs }) {
  const startedAt = Date.now();
  let payload = initialPayload;
  let retrieveMs = 0;
  let retrieveAttempts = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const status = String(payload?.status || "").toLowerCase();
    if (!status || status === "completed") {
      return { payload, retrieveMs, retrieveAttempts };
    }
    if (status === "failed" || status === "cancelled" || status === "incomplete" || status === "expired") {
      throw new Error(`OpenAI file-tool did not complete successfully. ${summarizeResponsePayload(payload)}`);
    }
    if (!payload?.id) {
      throw new Error(`OpenAI file-tool returned no response id for polling. ${summarizeResponsePayload(payload)}`);
    }
    await sleep(pollIntervalMs);
    const retrieveStartedAt = Date.now();
    const retrieveResult = await retrieveOpenAIResponseWithRetry({ apiKey, responseId: payload.id });
    retrieveMs += Date.now() - retrieveStartedAt;
    retrieveAttempts += retrieveResult.attempts;
    payload = retrieveResult.payload;
  }

  throw new Error(`OpenAI file-tool processing timed out after ${timeoutMs}ms`);
}

async function retrieveOpenAIResponse({ apiKey, responseId }) {
  const response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const raw = await response.text();
  const payload = parseJsonOrNull(raw);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI response retrieve failed with ${response.status}: ${raw.slice(0, 400)}`);
  }
  return payload;
}

async function retrieveOpenAIResponseWithRetry({ apiKey, responseId, maxAttempts = Number(process.env.OPENAI_RESPONSE_RETRY_ATTEMPTS || 4) }) {
  let lastError;
  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
    try {
      const payload = await retrieveOpenAIResponse({ apiKey, responseId });
      return { payload, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (!isRetryableOpenAIResponseError(error) || attempt === maxAttempts) break;
      await sleep(Math.min(1500 * attempt, 5000));
    }
  }
  throw lastError;
}

async function preloadPackageMaterial(context) {
  if (!context?.packageUpload?.blobUploadId || context.packageUpload.packageMaterial) return;
  const storedPackage = await getPackageUploadBytes(context.packageUpload.blobUploadId);
  context.packageUpload = {
    ...context.packageUpload,
    packageMaterial: storedPackage,
  };
}

function isRetryableOpenAIResponseError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("openai response retrieve failed with 429") ||
    message.includes("openai response retrieve failed with 500") ||
    message.includes("openai response retrieve failed with 502") ||
    message.includes("openai response retrieve failed with 503") ||
    message.includes("openai response retrieve failed with 504") ||
    message.includes("connection refused") ||
    message.includes("upstream connect error") ||
    message.includes("transport failure");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonOrNull(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return null;
  }
}

function extractResponseText(payload) {
  const chunks = [];
  const pushChunk = (value) => {
    if (typeof value === "string" && value.trim()) {
      chunks.push(value);
      return;
    }
    if (value && typeof value === "object") {
      try {
        chunks.push(JSON.stringify(value));
      } catch {
        // Ignore unstringifiable fragments.
      }
    }
  };
  if (payload?.output_text) return payload.output_text;
  pushChunk(payload?.output_parsed);
  for (const item of payload?.output || []) {
    pushChunk(item?.parsed);
    pushChunk(item?.text);
    pushChunk(item?.result);
    if (Array.isArray(item?.summary)) {
      for (const summaryItem of item.summary) {
        if (typeof summaryItem === "string" && summaryItem.trim()) chunks.push(summaryItem);
        else if (summaryItem?.text) chunks.push(summaryItem.text);
        else if (summaryItem?.content) chunks.push(summaryItem.content);
      }
    }
    for (const content of item?.content || []) {
      pushChunk(content?.parsed);
      pushChunk(content?.json);
      if (content?.type === "output_text" && content?.text) chunks.push(content.text);
      if (content?.type === "text" && content?.text) chunks.push(content.text);
      if (typeof content === "string" && content.trim()) chunks.push(content);
    }
    for (const output of item?.outputs || []) {
      pushChunk(output?.parsed);
      pushChunk(output?.json);
      if (output?.type === "output_text" && output?.text) chunks.push(output.text);
      if (output?.type === "text" && output?.text) chunks.push(output.text);
      if (typeof output === "string" && output.trim()) chunks.push(output);
    }
  }
  return chunks.join("\n").trim();
}

function summarizeResponsePayload(payload) {
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const outputTypes = output.map((item) => item?.type || item?.role || "unknown").slice(0, 8);
  return `Response status=${payload?.status || "unknown"} outputTypes=${outputTypes.join(",") || "none"} incompleteReason=${payload?.incomplete_details?.reason || ""}`;
}

async function buildDocumentPlan(context) {
  const system = buildDocumentPlanSystemPrompt();
  const user = JSON.stringify(buildDocumentPlanUserPayload({
    context,
    evidenceDigest: buildEvidenceDigest(context.signals),
  }));

  const result = await callOpenAI({
    system,
    user,
    temperature: 0.1,
    responseSchema: documentGenerationPlanSchema(),
    model: resolveDocumentGenerationModel(),
  });

  if (!result) throw new Error("Document planning returned no response.");
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "planning",
    message: "Planning response received from OpenAI.",
    meta: { brdSections: result.brdSections?.length || 0, capabilities: result.primaryCapabilities?.length || 0 },
  });
  return result;
}

async function buildFinalSuite(context, plan) {
  const system = buildFinalSuiteSystemPrompt();
  const user = JSON.stringify(buildFinalSuiteUserPayload({
    context,
    evidenceDigest: buildEvidenceDigest(context.signals),
    blueprint: plan,
  }));

  const result = await callOpenAI({
    system,
    user,
    temperature: 0.15,
    model: resolveDocumentGenerationModel(),
    responseSchema: {
      name: "document_generation_suite",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["source", "brd", "bddFiles", "qualityNotes"],
        properties: {
          source: { type: "string" },
          brd: {
            type: "object",
            additionalProperties: false,
            required: ["id", "title", "module", "content", "evidenceAnchors"],
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              module: { type: "string" },
              content: { type: "string" },
              evidenceAnchors: { type: "array", items: { type: "string" } },
            },
          },
          bddFiles: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "title", "module", "businessView", "gherkin", "evidenceAnchors"],
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                module: { type: "string" },
                businessView: { type: "string" },
                gherkin: { type: "string" },
                evidenceAnchors: { type: "array", items: { type: "string" } },
              },
            },
          },
          qualityNotes: { type: "array", items: { type: "string" } },
        },
      },
    },
  });

  if (!result) throw new Error("Document generation returned no response.");
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "drafting",
    message: "Final generation response received from OpenAI.",
    meta: { bddCount: result.bddFiles?.length || 0 },
  });
  return normalizeSuite(result, "ai_generated");
}

function validateSuite(payload) {
  const brdText = String(payload?.brd?.content || "").trim();
  const bdds = Array.isArray(payload?.bddFiles) ? payload.bddFiles : [];
  if (!brdText || brdText.length < 300) return null;
  if (!bdds.length) return null;
  if (!bdds.some((doc) => String(doc?.gherkin || "").trim().length > 80)) return null;
  return payload;
}

function evaluateSuiteDepth(payload) {
  const criticalIssues = [];
  const advisoryIssues = [];
  const brdText = String(payload?.brd?.content || "");
  const bdds = Array.isArray(payload?.bddFiles) ? payload.bddFiles : [];
  const brdSections = [
    "Executive Summary",
    "Application Profile",
    "Functional Requirements",
    "Non-Functional Requirements",
    "Business Rules",
    "Gaps",
    "Risk Register",
    "Traceability",
  ];
  const missingSections = brdSections.filter((section) => !brdText.toLowerCase().includes(section.toLowerCase()));
  if (brdText.length < 2500) criticalIssues.push(`BRD is far too short (${brdText.length} chars; target 2500+ minimum before accepting).`);
  else if (brdText.length < 6500) advisoryIssues.push(`BRD is shorter than the enterprise target (${brdText.length} chars; target 6500+).`);
  if (missingSections.length) criticalIssues.push(`BRD missing sections: ${missingSections.join(", ")}.`);
  if (!/FR-\d{3}/i.test(brdText)) criticalIssues.push("BRD does not include formal FR identifiers.");
  if (!/BR-\d{3}/i.test(brdText)) criticalIssues.push("BRD does not include formal BR identifiers.");
  if (!/Gap|GAP-\d{3}/i.test(brdText)) criticalIssues.push("BRD does not include a useful gaps catalogue.");
  if (!bdds.length) criticalIssues.push("No BDD feature files returned for fresh package generation.");
  if (bdds.length > 0 && bdds.length < 3) criticalIssues.push(`Only ${bdds.length} BDD feature files returned; capability-rich packages should not collapse to fewer than 3 unless evidence is truly minimal.`);
  bdds.forEach((doc, index) => {
    const gherkin = String(doc?.gherkin || "");
    const scenarioCount = (gherkin.match(/^\s*Scenario(?: Outline)?:/gim) || []).length;
    if (gherkin.length < 350) criticalIssues.push(`BDD ${index + 1} is far too short (${gherkin.length} chars).`);
    else if (gherkin.length < 700) advisoryIssues.push(`BDD ${index + 1} is shorter than the target (${gherkin.length} chars).`);
    if (scenarioCount < 2) criticalIssues.push(`BDD ${index + 1} has fewer than 2 scenarios.`);
    if (!/#\s*Covers:/i.test(gherkin)) criticalIssues.push(`BDD ${index + 1} is missing # Covers traceability comments.`);
    if (/^\s*(get|post|put|delete|patch)\s+\//i.test(String(doc?.title || ""))) criticalIssues.push(`BDD ${index + 1} title is endpoint-shaped instead of business-capability-shaped.`);
  });
  return {
    passed: criticalIssues.length === 0,
    criticalIssues,
    advisoryIssues,
    issues: [...criticalIssues, ...advisoryIssues],
  };
}

function normalizeSuite(payload, source) {
  const brd = payload.brd || {};
  const bddFiles = Array.isArray(payload.bddFiles) ? payload.bddFiles : [];
  return {
    source,
    brd: {
      id: brd.id || "brd-application-overview",
      title: brd.title || "BRD - Application Overview",
      module: brd.module || "Application",
      content: brd.content || brd.businessView || brd.markdown || brd.body || brd.description || "",
      evidenceAnchors: Array.isArray(brd.evidenceAnchors) ? brd.evidenceAnchors : [],
    },
    bddFiles: bddFiles.map((doc, index) => ({
      id: doc.id || `bdd-${index + 1}`,
      title: doc.title || `BDD - Feature ${index + 1}`,
      module: doc.module || "Application",
      businessView: doc.businessView || doc.content || doc.description || "",
      gherkin: doc.gherkin || doc.content || doc.businessView || "",
      evidenceAnchors: Array.isArray(doc.evidenceAnchors) ? doc.evidenceAnchors : [],
    })),
    qualityNotes: payload.qualityNotes || [],
  };
}

function summarizeSignals(signals) {
  return {
    projectName: signals.projectName,
    fileName: signals.fileName,
    platform: signals.platform,
    buildTool: signals.buildTool,
    hasSpringBoot: signals.hasSpringBoot,
    sourceFileCount: signals.sourceFileCount,
    testFileCount: signals.testFileCount,
    bddFileCount: signals.bddFileCount,
    modules: (signals.modules || []).slice(0, 20),
    endpoints: (signals.endpoints || []).slice(0, 20),
    classes: (signals.classes || []).slice(0, 20).map((item) => ({
      className: item.className,
      packageName: item.packageName,
      annotations: item.annotations,
      methodCount: item.methodCount,
      endpoints: item.endpoints || [],
    })),
  };
}

function normalizePackageUpload(value) {
  if (!hasPackageUploadPayload(value)) return null;
  const name = String(value.name || "source-package.zip").split(/[\\/]/).pop() || "source-package.zip";
  return {
    name,
    type: String(value.type || "application/zip"),
    size: Number(value.size || 0),
    blobUploadId: value.blobUploadId ? String(value.blobUploadId) : "",
    chunkCount: Number(value.chunkCount || 0),
    contentBase64: String(value.contentBase64 || ""),
  };
}

function hasPackageUploadPayload(value) {
  return Boolean(value?.contentBase64 || value?.blobUploadId);
}

function resolveDocumentGenerationModel() {
  const model =
    process.env.OPENAI_DOCUMENT_GENERATION_MODEL ||
    process.env.OPENAI_DOCUMENT_MODEL ||
    process.env.OPENAI_MODEL;
  if (!model) {
    throw new Error("No OpenAI model configured. Set OPENAI_DOCUMENT_GENERATION_MODEL, OPENAI_DOCUMENT_MODEL, or OPENAI_MODEL.");
  }
  return model;
}

function isFileToolRecoveryEnabled() {
  return String(process.env.OPENAI_FILE_TOOL_RECOVERY_ENABLED || "").trim().toLowerCase() === "true";
}

function normalizeJobId(value) {
  const cleaned = String(value || '').trim();
  return cleaned || crypto.randomUUID();
}
