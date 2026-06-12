import { CORS_HEADERS, json, parseEventBody, compactSignals, callOpenAI, upsertAiJob, appendAiJobLog, connectBlobsFromEvent } from "./_shared.js";

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
    uploadedRequirements: Array.isArray(request.uploadedRequirements) ? request.uploadedRequirements : [],
    gapResults: request.gapResults || null,
    signals,
    auditRequest: {
      generationMode: request.generationMode || "initial",
      targetDocument: request.targetDocument || null,
      targetGap: request.targetGap || null,
      uploadedRequirementCount: Array.isArray(request.uploadedRequirements) ? request.uploadedRequirements.length : 0,
      hasGapResults: Boolean(request.gapResults),
      packageSignals: summarizeSignals(signals),
    },
  };
}

async function buildDocumentPlan(context) {
  const system = [
    "ROLE: You are a principal Java solution architect, senior business analyst, and QA documentation strategist.",
    "MISSION: Turn the provided Java source evidence and uploaded requirements into a precise blueprint for production-grade BRD and BDD generation.",
    "QUALITY BAR: Use only confirmed evidence from the codebase and uploaded requirements. If evidence is missing, mark it as unconfirmed instead of filling the gap with assumptions.",
    "RULES: Prefer fewer, deeper, evidence-backed clusters over broad generic coverage. Name capabilities using business language that still maps cleanly back to source artifacts.",
    "TRACEABILITY: Every meaningful section, capability, cluster, or risk should be traceable to file paths, classes, methods, endpoints, tests, or uploaded requirement names.",
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
              required: ["name", "businessGoal", "sourceEvidence", "notes"],
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
              required: ["clusterId", "title", "module", "businessGoal", "sourceEvidence", "scenarioTypes"],
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
          required: ["id", "title", "module", "content"],
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
              required: ["id", "title", "module", "businessView", "gherkin"],
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

function normalizeJobId(value) {
  const cleaned = String(value || '').trim();
  return cleaned || crypto.randomUUID();
}
