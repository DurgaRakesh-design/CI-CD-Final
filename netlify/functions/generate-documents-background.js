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
    await reportProgress({ stage: "file-analysis", progress: 10, message: "Uploading package to OpenAI for full source analysis." });
    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "file-analysis",
      message: "Using OpenAI file/tool workflow for full package inspection.",
      meta: {
        fileName: context.packageUpload.name,
        size: context.packageUpload.size,
        blobUploadId: context.packageUpload.blobUploadId || "",
        model: process.env.OPENAI_MODEL || "gpt-4.1",
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
    message: "Planning BRD and BDD structure with GPT-4.1.",
    meta: { model: process.env.OPENAI_MODEL || "gpt-4.1", temperature: 0.1 },
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
  const startedAt = Date.now();
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
  const fileId = await uploadPackageToOpenAI(context.packageUpload, context.jobId);
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "file-upload",
    message: "OpenAI file upload completed.",
    meta: { fileId },
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
    let result = await callOpenAIFileTool({
      system,
      user,
      fileId,
      responseSchema: suiteResponseSchema(),
      temperature: 0.12,
      jobId: context.jobId,
    });
    if (!result) throw new Error("File-based document generation returned no response.");
    let normalized = normalizeSuite(result, "ai_file_tool_generated");
    const qualityGate = evaluateSuiteDepth(normalized);
    if (!qualityGate.passed) {
      await appendAiJobLog(JOB_TYPE, context.jobId, {
        stage: "drafting",
        message: "Initial file-based generation was too shallow; requesting expanded enterprise output.",
        meta: qualityGate,
      });
      result = await callOpenAIFileTool({
        system,
        user: JSON.stringify(buildFileAnalysisUserPayload({
          context,
          evidenceDigest,
          requiredOutputShape: requiredSuiteShape(),
          qualityGateFeedback: {
            status: "previous_output_missing_critical_depth_requirements",
            missing: qualityGate.criticalIssues,
            advisory: qualityGate.advisoryIssues,
            requiredAction: "Regenerate from the attached ZIP with a formal enterprise BRD, source-driven BDD feature files for every real evidenced business capability/workflow, detailed FR/BR/GAP/RISK catalogues, and richer traceability. Do not summarize or use app-specific templates.",
          },
        })),
        fileId,
        responseSchema: suiteResponseSchema(),
        temperature: 0.1,
        jobId: context.jobId,
      });
      normalized = normalizeSuite(result, "ai_file_tool_generated");
    }
    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "drafting",
      message: "File-based generation response received from OpenAI.",
      meta: {
        bddCount: normalized.bddFiles?.length || 0,
        brdChars: String(normalized.brd?.content || "").length,
        elapsedMs: Date.now() - startedAt,
      },
    });
    return normalized;
  } finally {
    await deleteOpenAIFile(fileId, context.jobId).catch(() => {});
  }
}

async function uploadPackageToOpenAI(packageUpload, jobId = "") {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for file-based document generation.");
  const startedAt = Date.now();
  if (jobId) {
    await appendAiJobLog(JOB_TYPE, jobId, {
      stage: "file-upload",
      message: "Reassembling uploaded package from blob storage.",
      meta: {
        blobUploadId: packageUpload.blobUploadId || "",
        expectedSize: packageUpload.size || 0,
        chunkCount: packageUpload.chunkCount || 0,
      },
    });
  }
  const storedPackage = packageUpload.blobUploadId ? await getPackageUploadBytes(packageUpload.blobUploadId) : null;
  const bytes = storedPackage?.bytes || Buffer.from(packageUpload.contentBase64 || "", "base64");
  if (!bytes.length) throw new Error("Package upload was empty.");
  if (jobId) {
    await appendAiJobLog(JOB_TYPE, jobId, {
      stage: "file-upload",
      message: "Package reassembly completed. Starting OpenAI Files API upload.",
      meta: {
        bytes: bytes.length,
        elapsedMs: Date.now() - startedAt,
      },
    });
  }
  const form = new FormData();
  form.append("purpose", process.env.OPENAI_FILE_PURPOSE || "user_data");
  form.append("file", new Blob([bytes], { type: storedPackage?.type || packageUpload.type || "application/zip" }), storedPackage?.name || packageUpload.name || "source-package.zip");
  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const raw = await response.text();
  const payload = parseJsonOrNull(raw);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI file upload failed with ${response.status}: ${raw.slice(0, 240)}`);
  }
  if (!payload?.id) throw new Error("OpenAI file upload did not return a file id.");
  if (jobId) {
    await appendAiJobLog(JOB_TYPE, jobId, {
      stage: "file-upload",
      message: "OpenAI Files API upload completed.",
      meta: {
        fileId: payload.id,
        bytes: bytes.length,
        elapsedMs: Date.now() - startedAt,
      },
    });
  }
  return payload.id;
}

async function deleteOpenAIFile(fileId, jobId = "") {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !fileId) return;
  const response = await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (jobId) {
    await appendAiJobLog(JOB_TYPE, jobId, {
      stage: "cleanup",
      message: "OpenAI file cleanup completed.",
      meta: {
        fileId,
        status: response.status,
      },
    });
  }
}

async function callOpenAIFileTool({
  system,
  user,
  fileId,
  responseSchema,
  temperature = 0.1,
  timeoutMs = Number(process.env.OPENAI_FILE_TOOL_TIMEOUT_MS || 840000),
  requestTimeoutMs = Number(process.env.OPENAI_FILE_TOOL_REQUEST_TIMEOUT_MS || 120000),
  finalizationTimeoutMs = Number(process.env.OPENAI_FILE_TOOL_FINALIZATION_TIMEOUT_MS || 240000),
  pollIntervalMs = Number(process.env.OPENAI_FILE_TOOL_POLL_INTERVAL_MS || 3000),
  model = process.env.OPENAI_MODEL || "gpt-4.1",
  jobId = "",
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for OpenAI file tools.");
  const effectiveTimeoutMs = Math.max(timeoutMs, 300000);
  const effectiveRequestTimeoutMs = Math.max(requestTimeoutMs, 120000);
  const effectiveFinalizationTimeoutMs = Math.max(finalizationTimeoutMs, 180000);
  const effectivePollIntervalMs = Math.max(pollIntervalMs, 1500);
  if (jobId) {
    await appendAiJobLog(JOB_TYPE, jobId, {
      stage: "file-analysis",
      message: "Creating OpenAI background response with Code Interpreter.",
      meta: {
        fileId,
        model,
        timeoutMs: effectiveTimeoutMs,
        requestTimeoutMs: effectiveRequestTimeoutMs,
        finalizationTimeoutMs: effectiveFinalizationTimeoutMs,
        pollIntervalMs: effectivePollIntervalMs,
      },
    });
  }
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
  const payload = await waitForOpenAIResponse({
    apiKey,
    initialPayload: createPayload,
    timeoutMs: effectiveTimeoutMs,
    pollIntervalMs: effectivePollIntervalMs,
    jobId,
  });
  let outputText = extractResponseText(payload);
  if (!String(outputText || "").trim() && payload?.id) {
    if (jobId) {
      await appendAiJobLog(JOB_TYPE, jobId, {
        stage: "file-analysis",
        message: "Primary tool response had no final text. Requesting final JSON from previous response.",
        meta: { responseId: payload.id },
      });
    }
    outputText = await requestFinalJsonFromResponse({
      apiKey,
      model,
      previousResponseId: payload.id,
      responseSchema,
      timeoutMs: effectiveFinalizationTimeoutMs,
      pollIntervalMs: effectivePollIntervalMs,
      jobId,
    });
  }
  if (!String(outputText || "").trim()) {
    throw new Error(`OpenAI file-tool returned no final text output. ${summarizeResponsePayload(payload)}`);
  }
  try {
    return JSON.parse(outputText);
  } catch {
    throw new Error(`OpenAI file-tool returned invalid JSON content: ${String(outputText || "").slice(0, 180)} ${summarizeResponsePayload(payload)}`);
  }
}

async function requestFinalJsonFromResponse({ apiKey, model, previousResponseId, responseSchema, timeoutMs, pollIntervalMs, jobId = "" }) {
  const createPayload = await postOpenAIResponse({
    apiKey,
    timeoutMs,
    body: {
      model,
      background: true,
      previous_response_id: previousResponseId,
      input: [
        {
          role: "user",
          content:
            "The prior tool run completed without a final assistant message. Using the analysis already performed in that response, return the final deliverable JSON only. Do not call tools again. Do not include markdown, prose, or code fences.",
        },
      ],
      temperature: 0,
      max_output_tokens: Number(process.env.OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS || 30000),
      text: {
        format: {
          type: "json_schema",
          name: responseSchema.name,
          schema: responseSchema.schema,
          strict: true,
        },
      },
    },
    timeoutLabel: "finalization",
  });
  const payload = await waitForOpenAIResponse({
    apiKey,
    initialPayload: createPayload,
    timeoutMs,
    pollIntervalMs,
    jobId,
  });
  return extractResponseText(payload);
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

async function waitForOpenAIResponse({ apiKey, initialPayload, timeoutMs, pollIntervalMs, jobId = "" }) {
  const startedAt = Date.now();
  let payload = initialPayload;
  let pollCount = 0;
  let lastLoggedStatus = "";

  while (Date.now() - startedAt < timeoutMs) {
    const status = String(payload?.status || "").toLowerCase();
    pollCount += 1;
    if (jobId && status && (status !== lastLoggedStatus || pollCount === 1 || pollCount % 10 === 0)) {
      lastLoggedStatus = status;
      await appendAiJobLog(JOB_TYPE, jobId, {
        stage: "file-analysis",
        message: "OpenAI background response poll update.",
        meta: {
          responseId: payload?.id || "",
          status,
          pollCount,
          elapsedMs: Date.now() - startedAt,
          incompleteReason: payload?.incomplete_details?.reason || "",
          outputTextChars: String(payload?.output_text || "").length,
        },
      });
    }
    if (!status || status === "completed") {
      if (jobId) {
        await appendAiJobLog(JOB_TYPE, jobId, {
          stage: "file-analysis",
          message: "OpenAI background response completed.",
          meta: {
            responseId: payload?.id || "",
            pollCount,
            elapsedMs: Date.now() - startedAt,
          },
        });
      }
      return payload;
    }
    if (status === "failed" || status === "cancelled" || status === "incomplete" || status === "expired") {
      throw new Error(`OpenAI file-tool did not complete successfully. ${summarizeResponsePayload(payload)}`);
    }
    if (!payload?.id) {
      throw new Error(`OpenAI file-tool returned no response id for polling. ${summarizeResponsePayload(payload)}`);
    }
    await sleep(pollIntervalMs);
    payload = await retrieveOpenAIResponse({ apiKey, responseId: payload.id });
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
  if (payload?.output_text) return payload.output_text;
  const chunks = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) chunks.push(content.text);
      if (content?.type === "text" && content?.text) chunks.push(content.text);
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
  if (brdText.length < 6500) advisoryIssues.push(`BRD is shorter than the enterprise target (${brdText.length} chars; target 6500+).`);
  if (missingSections.length) criticalIssues.push(`BRD missing sections: ${missingSections.join(", ")}.`);
  if (!/FR-\d{3}/i.test(brdText)) criticalIssues.push("BRD does not include formal FR identifiers.");
  if (!/BR-\d{3}/i.test(brdText)) criticalIssues.push("BRD does not include formal BR identifiers.");
  if (!/Gap|GAP-\d{3}/i.test(brdText)) criticalIssues.push("BRD does not include a useful gaps catalogue.");
  if (!bdds.length) criticalIssues.push("No BDD feature files returned for fresh package generation.");
  bdds.forEach((doc, index) => {
    const gherkin = String(doc?.gherkin || "");
    const scenarioCount = (gherkin.match(/^\s*Scenario(?: Outline)?:/gim) || []).length;
    if (gherkin.length < 700) advisoryIssues.push(`BDD ${index + 1} is shorter than the target (${gherkin.length} chars).`);
    if (scenarioCount < 2) criticalIssues.push(`BDD ${index + 1} has fewer than 2 scenarios.`);
    if (!/#\s*Covers:/i.test(gherkin)) criticalIssues.push(`BDD ${index + 1} is missing # Covers traceability comments.`);
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

function normalizeJobId(value) {
  const cleaned = String(value || '').trim();
  return cleaned || crypto.randomUUID();
}
