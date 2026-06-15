import { CORS_HEADERS, json, parseEventBody, compactSignals, buildEvidenceDigest, callOpenAI, upsertAiJob, appendAiJobLog, connectBlobsFromEvent } from "./_shared.js";

const JOB_TYPE = "generate-documents";

export const config = {
  background: true,
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed." });

  let jobId = "";
  try {
    connectBlobsFromEvent(event);
    const request = parseEventBody(event);
    jobId = normalizeJobId(request.jobId);
    const context = buildGenerationContext(request, jobId);
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
    console.error("generate-documents failed", error);
    if (jobId) {
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
  if (context.packageUpload?.contentBase64 && context.generationMode === "initial") {
    await reportProgress({ stage: "file-analysis", progress: 10, message: "Uploading package to OpenAI for full source analysis." });
    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "file-analysis",
      message: "Using OpenAI file/tool workflow for full package inspection.",
      meta: {
        fileName: context.packageUpload.name,
        size: context.packageUpload.size,
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
      hasPackageUpload: Boolean(request.packageUpload?.contentBase64),
      hasGapResults: Boolean(request.gapResults),
      packageSignals: summarizeSignals(signals),
    },
  };
}

async function buildSuiteFromPackageFile(context, reportProgress) {
  const fileId = await uploadPackageToOpenAI(context.packageUpload);
  try {
    await reportProgress({ stage: "file-analysis", progress: 25, message: "Analyzing package structure with OpenAI Code Interpreter." });
    const system = [
      "ROLE: You are a principal Java solution architect, senior business analyst, and QA automation strategist.",
      "MISSION: Inspect the attached Java project ZIP using Code Interpreter, then generate a production-grade BRD and focused BDD suite.",
      "SOURCE OF TRUTH: Use the attached project files as the primary evidence source. You may use the supplied packageSignals as navigation hints only.",
      "RULES: Do not invent features, roles, integrations, pages, APIs, validations, business rules, or tests that are not supported by the package evidence.",
      "ANALYSIS METHOD: Unzip the package, inspect build files, Java source, resources, controllers, services, entities, configuration, tests, and existing feature/spec files before writing.",
      "TRACEABILITY: Every major section and BDD cluster must include evidence anchors pointing to concrete file paths, classes, methods, endpoints, tests, resources, or uploaded requirements.",
      "QUALITY TARGET: BRD should be detailed and enterprise-readable. BDDs should be business-readable, executable Gherkin, and grounded in the discovered implementation.",
      "OUTPUT: Return only JSON that matches the requested schema.",
    ].join(" ");

    const user = JSON.stringify({
      generationMode: context.generationMode,
      uploadedRequirements: context.uploadedRequirements,
      packageSignals: context.signals,
      evidenceDigest: buildEvidenceDigest(context.signals),
      requiredOutputShape: requiredSuiteShape(),
      instructions: [
        "Start by listing the extracted project tree internally and identify the main application, modules, build tool, controllers, services, domain objects, validation rules, configuration, and tests.",
        "Generate one BRD for the whole application.",
        "Generate BDD feature files grouped by real business capability, not by technical class names.",
        "Each BDD must include a concise businessView and a valid Gherkin feature with scenarios/scenario outlines where appropriate.",
        "If evidence is partial or absent, state that in BRD quality notes instead of hallucinating.",
        "Prefer high-value workflows and edge cases that the code actually supports.",
      ],
    });

    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "file-analysis",
      message: "Calling OpenAI Responses API with Code Interpreter and uploaded package.",
      meta: { fileId, packageName: context.packageUpload.name },
    });

    await reportProgress({ stage: "drafting", progress: 55, message: "Generating BRD and BDD suite from full package evidence." });
    const result = await callOpenAIFileTool({
      system,
      user,
      fileId,
      responseSchema: suiteResponseSchema(),
      temperature: 0.12,
    });
    if (!result) throw new Error("File-based document generation returned no response.");
    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "drafting",
      message: "File-based generation response received from OpenAI.",
      meta: { bddCount: result.bddFiles?.length || 0 },
    });
    return normalizeSuite(result, "ai_file_tool_generated");
  } finally {
    await deleteOpenAIFile(fileId).catch(() => {});
  }
}

async function uploadPackageToOpenAI(packageUpload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for file-based document generation.");
  const bytes = Buffer.from(packageUpload.contentBase64 || "", "base64");
  if (!bytes.length) throw new Error("Package upload was empty.");
  const form = new FormData();
  form.append("purpose", "assistants");
  form.append("file", new Blob([bytes], { type: packageUpload.type || "application/zip" }), packageUpload.name || "source-package.zip");
  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI file upload failed with ${response.status}`);
  }
  if (!payload?.id) throw new Error("OpenAI file upload did not return a file id.");
  return payload.id;
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
  timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 900000),
  model = process.env.OPENAI_MODEL || "gpt-4.1",
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for OpenAI file tools.");
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
      body: JSON.stringify({
        model,
        instructions: system,
        input: user,
        temperature,
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
      }),
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`OpenAI file-tool request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI file-tool request failed with ${response.status}`);
  }
  const outputText = extractResponseText(payload);
  try {
    return JSON.parse(outputText);
  } catch {
    throw new Error(`OpenAI file-tool returned invalid JSON content: ${String(outputText || "").slice(0, 180)}`);
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

async function buildDocumentPlan(context) {
  const system = [
    "ROLE: You are a principal Java solution architect, senior business analyst, and QA documentation strategist.",
    "MISSION: Turn the provided Java source evidence and uploaded requirements into a precise blueprint for production-grade BRD and BDD generation.",
    "QUALITY BAR: Use only confirmed evidence from the codebase and uploaded requirements. If evidence is missing, mark it as unconfirmed instead of filling the gap with assumptions.",
    "RULES: Prefer fewer, deeper, evidence-backed clusters over broad generic coverage. Name capabilities using business language that still maps cleanly back to source artifacts.",
    "TRACEABILITY: Every meaningful section, capability, cluster, or risk should be traceable to file paths, classes, methods, endpoints, tests, or uploaded requirement names.",
    "FIRST UPLOAD MODE: Treat the input as a full initial repository scan. Favor coverage, precision, and clear traceability over brevity.",
    "OUTPUT: Return only JSON that matches the requested schema.",
  ].join(" ");

  const user = JSON.stringify({
    generationMode: context.generationMode,
    targetDocument: context.targetDocument,
    targetGap: context.targetGap,
    uploadedRequirements: context.uploadedRequirements,
    gapResults: context.gapResults,
    packageSignals: context.signals,
    evidenceDigest: buildEvidenceDigest(context.signals),
    requiredPlanShape: {
      executiveSummary: "string",
      brdSections: [
        "Executive Summary",
        "Architecture Overview",
        "Stakeholders",
        "Functional Requirements",
        "Business Rules",
        "Data Model",
        "Validation Rules",
        "Workflows",
        "Integration Analysis",
        "Security Assessment",
        "Performance Assessment",
        "Gap Analysis",
        "Risk Register",
        "Traceability Matrix",
        "Recommendations",
      ],
      primaryCapabilities: [
        {
          name: "string",
          businessGoal: "string",
          sourceEvidence: ["file path or code artifact"],
          evidenceAnchors: ["file path, class, method, endpoint, test, or requirement reference"],
          notes: "string",
        },
      ],
      bddClusters: [
        {
          clusterId: "string",
          title: "string",
          module: "string",
          businessGoal: "string",
          sourceEvidence: ["file path or code artifact"],
          evidenceAnchors: ["file path, class, method, endpoint, test, or requirement reference"],
          scenarioTypes: ["happy path", "validation", "boundary", "security", "integration"],
        },
      ],
      qualityNotes: ["string"],
    },
    guidance: [
      "Keep cluster count tight and focused on the most important business capabilities.",
      "Use controllers, services, entities, validations, security config, tests, uploaded requirement files, and file names as the evidence base.",
      "Prefer the capabilityHints, validationSignals, securitySignals, featureSignals, and evidenceHighlights as your highest-signal inputs when deciding what the BRD and BDDs should cover.",
      "When the code only partially supports a capability, state the limitation in qualityNotes and lower the confidence of the related section.",
      "Do not invent process steps, user roles, external systems, or validations that are not present in the supplied evidence.",
    ],
  });

  const result = await callOpenAI({
    system,
    user,
    temperature: 0.1,
    responseSchema: {
      name: "document_generation_plan",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["executiveSummary", "brdSections", "primaryCapabilities", "bddClusters", "qualityNotes"],
        properties: {
          executiveSummary: { type: "string" },
          brdSections: {
            type: "array",
            minItems: 10,
            items: { type: "string" },
          },
          primaryCapabilities: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "businessGoal", "sourceEvidence", "evidenceAnchors", "notes"],
              properties: {
                name: { type: "string" },
                businessGoal: { type: "string" },
                sourceEvidence: { type: "array", items: { type: "string" } },
                evidenceAnchors: { type: "array", items: { type: "string" } },
                notes: { type: "string" },
              },
            },
          },
          bddClusters: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["clusterId", "title", "module", "businessGoal", "sourceEvidence", "evidenceAnchors", "scenarioTypes"],
              properties: {
                clusterId: { type: "string" },
                title: { type: "string" },
                module: { type: "string" },
                businessGoal: { type: "string" },
                sourceEvidence: { type: "array", items: { type: "string" } },
                evidenceAnchors: { type: "array", items: { type: "string" } },
                scenarioTypes: { type: "array", items: { type: "string" } },
              },
            },
          },
          qualityNotes: { type: "array", items: { type: "string" } },
        },
      },
    },
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
  const system = [
    "ROLE: You are a principal Java solution architect, senior business analyst, and QA automation strategist.",
    "MISSION: Generate a production-grade BRD and focused BDD suite from the supplied source evidence and the provided blueprint.",
    "QUALITY TARGET: The BRD must read like a detailed enterprise analysis document. The BDDs must be business-readable, executable, and explicitly anchored to evidence.",
    "STRICT RULES: Do not invent features, roles, integrations, pages, APIs, validations, business rules, or test coverage. Prefer traceability and depth over breadth.",
    "TRACEABILITY: For every major section and scenario cluster, include evidence anchors that point to the concrete files, classes, methods, endpoints, tests, or uploaded requirements that justify it.",
    "FIRST UPLOAD MODE: Optimize the response for a single full-repo analysis, not a change-only regeneration pass.",
    "STRUCTURE: The BRD content should use the sections from the blueprint in a clear markdown hierarchy.",
    "OUTPUT: Return only JSON that matches the requested schema.",
  ].join(" ");

  const user = JSON.stringify({
    generationMode: context.generationMode,
    targetDocument: context.targetDocument,
    targetGap: context.targetGap,
    uploadedRequirements: context.uploadedRequirements,
    gapResults: context.gapResults,
    packageSignals: context.signals,
    evidenceDigest: buildEvidenceDigest(context.signals),
    blueprint: plan,
    requiredOutputShape: {
      source: "ai_generated",
      brd: {
        id: "string",
        title: "string",
        module: "Application",
        content: "markdown string with detailed section headings and evidence-backed analysis",
        evidenceAnchors: ["string"],
      },
      bddFiles: [
        {
          id: "string",
          title: "string",
          module: "string",
          businessView: "string",
          gherkin: "valid Gherkin string",
          evidenceAnchors: ["string"],
        },
      ],
      qualityNotes: ["string"],
    },
    contentGuidance: [
      "Use the blueprint's brdSections and primaryCapabilities as the source of truth.",
      "Keep BRD sections detailed enough for business review, traceability, and QA alignment, but do not repeat the same idea in multiple sections.",
      "For each BDD, include a concise businessView plus specific scenarios grounded in the evidence.",
      "Do not create more BDDs than needed; aim for depth and accuracy.",
      "When regenerating, keep the identity and module focus of the target document whenever possible.",
      "When generating from unlinked gaps, create BDDs only for the missing capability clusters in the blueprint.",
      "If the evidence supports a capability only partially, make that explicit in the BRD language and quality notes instead of padding with guesses.",
      "Lean on the evidenceDigest capabilityHints, validationSignals, securitySignals, featureSignals, and evidenceHighlights to avoid broad generic writing.",
    ],
  });

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

function requiredSuiteShape() {
  return {
    source: "ai_file_tool_generated",
    brd: {
      id: "string",
      title: "string",
      module: "Application",
      content: "markdown string with detailed section headings and evidence-backed analysis",
      evidenceAnchors: ["file path, class, method, endpoint, test, resource, or requirement reference"],
    },
    bddFiles: [
      {
        id: "string",
        title: "string",
        module: "string",
        businessView: "string",
        gherkin: "valid Gherkin string",
        evidenceAnchors: ["file path, class, method, endpoint, test, resource, or requirement reference"],
      },
    ],
    qualityNotes: ["string"],
  };
}

function suiteResponseSchema() {
  return {
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
  if (!value || !value.contentBase64) return null;
  const name = String(value.name || "source-package.zip").split(/[\\/]/).pop() || "source-package.zip";
  return {
    name,
    type: String(value.type || "application/zip"),
    size: Number(value.size || 0),
    contentBase64: String(value.contentBase64 || ""),
  };
}

function normalizeJobId(value) {
  const cleaned = String(value || '').trim();
  return cleaned || crypto.randomUUID();
}
