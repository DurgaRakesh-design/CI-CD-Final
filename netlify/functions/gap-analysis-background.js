import { CORS_HEADERS, json, parseEventBody, compactSignals, buildEvidenceDigest, callOpenAI, upsertAiJob, appendAiJobLog, connectBlobsFromEvent } from "./_shared.js";

const JOB_TYPE = "gap-analysis";

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
    const context = buildGapContext(request, jobId);
    await appendAiJobLog(JOB_TYPE, jobId, {
      stage: "queued",
      message: "Gap analysis request received.",
      meta: {
        documentCount: context.auditRequest.documentCount,
        packageSummary: context.auditRequest.packageSignals,
      },
    });
    await upsertAiJob(JOB_TYPE, jobId, {
      status: "running",
      stage: "queued",
      progress: 1,
      message: "Queued AI gap analysis.",
      request: context.auditRequest,
    });

    const result = await analyzeWithAI(context, async (update) => {
      await upsertAiJob(JOB_TYPE, jobId, {
        status: "running",
        ...update,
      });
    });

    await upsertAiJob(JOB_TYPE, jobId, {
      status: "completed",
      stage: "done",
      progress: 100,
      message: "Gap analysis completed.",
      result,
    });

    return json(202, { jobId, status: "accepted" });
  } catch (error) {
    console.error("gap-analysis failed", error);
    if (jobId) {
      await upsertAiJob(JOB_TYPE, jobId, {
        status: "failed",
        stage: "failed",
        progress: 100,
        message: error.message || "Gap analysis failed.",
      });
    }
    return json(500, { message: error.message || "Gap analysis failed." });
  }
};

async function analyzeWithAI(context, reportProgress) {
  await reportProgress({ stage: "planning", progress: 20, message: "Planning evidence review." });
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "planning",
    message: "Building evidence-first review plan.",
    meta: { model: process.env.OPENAI_MODEL || "gpt-4.1", temperature: 0.1 },
  });
  const plan = await buildGapAssessmentPlan(context);

  await reportProgress({ stage: "analyzing", progress: 55, message: "Reviewing package evidence against document coverage." });
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "analyzing",
    message: "Running final gap analysis against evidence and reviewed documents.",
    meta: { focusAreas: plan.primaryFocusAreas?.slice(0, 5) || [] },
  });
  const report = await buildGapAssessmentReport(context, plan);

  await reportProgress({ stage: "verifying", progress: 85, message: "Verifying findings, traceability, and readiness." });
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "verifying",
    message: "Validating findings and readiness summary.",
  });
  const validated = normalizeGapPayload(report);
  if (!validated.findings.length && !validated.summary) {
    await appendAiJobLog(JOB_TYPE, context.jobId, {
      level: "error",
      stage: "verifying",
      message: "Gap analysis produced no usable findings.",
    });
    throw new Error("Gap analysis returned no usable findings.");
  }
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "done",
    message: "Gap analysis succeeded.",
    meta: { totalFindings: validated.summary?.totalFindings || 0 },
  });
  return validated;
}

async function buildGapAssessmentPlan(context) {
  const system = [
    "ROLE: You are a senior QA governance reviewer, BA traceability auditor, and Java source-code reviewer.",
    "MISSION: Build an evidence-first review plan for comparing BRD/BDD documents against the Java package evidence.",
    "QUALITY BAR: Use only the supplied source evidence and uploaded requirement files. If evidence is thin, say so and lower confidence rather than inventing a gap.",
    "RULES: Prefer concrete business-capability analysis over technical layer summaries. Do not invent gaps or business behavior.",
    "TRACEABILITY: Every focus area, risk, and coverage mapping should be explainable from file paths, classes, methods, endpoints, tests, or uploaded requirement names.",
    "OUTPUT: Return only JSON that matches the requested schema.",
  ].join(" ");

  const user = JSON.stringify({
    packageSignals: context.signals,
    evidenceDigest: buildEvidenceDigest(context.signals),
    documents: context.documents.map((doc) => ({
      title: doc.title,
      id: doc.id,
      type: doc.type,
      module: doc.module,
      content: doc.type === "BDD" ? doc.gherkinContent || doc.content : doc.content,
    })),
    planRequirements: {
      primaryFocusAreas: "Array of the most important business capabilities to verify.",
      evidencePriority: "Array of source areas in descending priority.",
      documentCoverageMap: "Array describing which docs appear to own which business capabilities.",
      likelyRisks: "Array of likely coverage or traceability risks that deserve deeper review.",
      qualityNotes: "Array of assumptions, weak signals, or areas that need careful judgment.",
    },
    guidance: [
      "Prefer 3-8 focused focus areas over broad generic layer-based areas.",
      "Use business capability names instead of technical layer names.",
      "Call out evidence strength explicitly when it is weak.",
      "Do not label something as a gap unless the document coverage and code evidence clearly support that conclusion.",
    ],
  });

  const result = await callOpenAI({
    system,
    user,
    temperature: 0.1,
    responseSchema: {
      name: "gap_analysis_plan",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["primaryFocusAreas", "evidencePriority", "documentCoverageMap", "likelyRisks", "qualityNotes"],
        properties: {
          primaryFocusAreas: { type: "array", items: { type: "string" } },
          evidencePriority: { type: "array", items: { type: "string" } },
          documentCoverageMap: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["capability", "ownerDocument", "confidence", "notes"],
              properties: {
                capability: { type: "string" },
                ownerDocument: { type: "string" },
                confidence: { type: "string" },
                notes: { type: "string" },
              },
            },
          },
          likelyRisks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "severity", "evidenceHint", "recommendation"],
              properties: {
                title: { type: "string" },
                severity: { type: "string" },
                evidenceHint: { type: "string" },
                recommendation: { type: "string" },
              },
            },
          },
          qualityNotes: { type: "array", items: { type: "string" } },
        },
      },
    },
  });

  if (!result) throw new Error("Gap analysis planning returned no response.");
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "planning",
    message: "Planning response received from OpenAI.",
    meta: { focusAreas: result.primaryFocusAreas?.length || 0, likelyRisks: result.likelyRisks?.length || 0 },
  });
  return result;
}

async function buildGapAssessmentReport(context, plan) {
  const system = [
    "ROLE: You are a senior QA governance reviewer, BA traceability auditor, and Java source-code reviewer.",
    "MISSION: Compare reviewed BRD/BDD documents against the supplied Java source-code evidence and identify missing, weak, unsupported, duplicated, or not traceable requirement coverage.",
    "USE THE PLAN: Treat the plan as the blueprint. Prioritize its focus areas, risks, and coverage map.",
    "RULES: Findings must be based on concrete evidence such as controllers/endpoints, service methods, entities/DTO validations, security/config, tests, or uploaded requirement files.",
    "QUALITY: Prefer fewer, high-confidence findings over noisy generic findings.",
    "OUTPUT: Return only JSON that matches the requested schema.",
  ].join(" ");

  const user = JSON.stringify({
    packageSignals: context.signals,
    evidenceDigest: buildEvidenceDigest(context.signals),
    documents: context.documents.map((doc) => ({
      title: doc.title,
      id: doc.id,
      type: doc.type,
      module: doc.module,
      content: doc.type === "BDD" ? doc.gherkinContent || doc.content : doc.content,
    })),
    plan,
    rules: [
      "If a finding clearly belongs to an existing BRD or BDD, set linkStatus='linked', relatedDocumentId to that document id when available, and actionType='regenerate_document'.",
      "If a finding represents a missing capability with no existing BRD/BDD owner, set linkStatus='unlinked' and actionType='create_bdd'.",
      "Do not use generic relatedDocument values such as 'BRD/BDD' when a specific document cannot be identified. Leave it empty and mark unlinked.",
      "Use business capability names, not technical layer names, for modules.",
      "Do not report a gap unless you can point to source evidence or an uploaded requirement.",
      "If a document includes behavior unsupported by source evidence, report it as unsupported coverage.",
      "If source evidence is too weak to decide, make a low-severity review recommendation instead of a high-confidence gap.",
      "Include qualityNotes in the response when the evidence is thin or ambiguous.",
      "For each finding, include the concrete evidence hint that would let a reviewer verify it quickly.",
    ],
    outputShape: {
      summary: "Object with totalFindings, high, medium, low, readiness.",
      findings: "Array of findings with severity, title, description, relatedDocumentId, relatedDocument, linkStatus, module, packageSignal, impact, recommendedFix, actionType, evidenceAnchors.",
      recommendations: "Array of concise business-readable next steps.",
      qualityNotes: "Array of evidence caveats or confidence notes.",
    },
  });

  const result = await callOpenAI({
    system,
    user,
    temperature: 0.1,
    responseSchema: {
      name: "gap_analysis_report",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["summary", "findings", "recommendations", "qualityNotes"],
        properties: {
          summary: {
            type: "object",
            additionalProperties: false,
            required: ["totalFindings", "high", "medium", "low", "readiness"],
            properties: {
              totalFindings: { type: "number" },
              high: { type: "number" },
              medium: { type: "number" },
              low: { type: "number" },
              readiness: { type: "string" },
            },
          },
        findings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
              required: ["severity", "title", "description", "relatedDocumentId", "relatedDocument", "linkStatus", "module", "packageSignal", "impact", "recommendedFix", "actionType"],
              properties: {
                severity: { type: "string" },
                title: { type: "string" },
                description: { type: "string" },
                relatedDocumentId: { type: "string" },
                relatedDocument: { type: "string" },
                linkStatus: { type: "string" },
                module: { type: "string" },
                packageSignal: { type: "string" },
                impact: { type: "string" },
                recommendedFix: { type: "string" },
                actionType: { type: "string" },
                evidenceAnchors: { type: "array", items: { type: "string" } },
              },
            },
          },
          recommendations: { type: "array", items: { type: "string" } },
          qualityNotes: { type: "array", items: { type: "string" } },
        },
      },
    },
  });

  if (!result) throw new Error("Gap analysis returned no response.");
  await appendAiJobLog(JOB_TYPE, context.jobId, {
    stage: "analyzing",
    message: "Final analysis response received from OpenAI.",
    meta: { findings: result.findings?.length || 0, recommendations: result.recommendations?.length || 0 },
  });
  return result;
}

function normalizeGapPayload(payload) {
  const findings = (Array.isArray(payload.findings) ? payload.findings : []).map((item) => ({
    severity: ["high", "medium", "low"].includes(String(item.severity).toLowerCase())
      ? String(item.severity).toLowerCase()
      : "medium",
    title: item.title || "Requirement coverage gap",
    description: item.description || "",
    relatedDocumentId: item.relatedDocumentId || "",
    relatedDocument: item.relatedDocument || "",
    linkStatus: item.linkStatus === "linked" ? "linked" : item.linkStatus === "unlinked" ? "unlinked" : "",
    module: item.module || "Application",
    packageSignal: item.packageSignal || "",
    impact: item.impact || "",
    recommendedFix: item.recommendedFix || "",
    actionType: item.actionType === "regenerate_document" || item.actionType === "create_bdd" ? item.actionType : "",
    evidenceAnchors: Array.isArray(item.evidenceAnchors) ? item.evidenceAnchors : [],
  }));
  const high = findings.filter((item) => item.severity === "high").length;
  const medium = findings.filter((item) => item.severity === "medium").length;
  const low = findings.filter((item) => item.severity === "low").length;
  return {
    summary: {
      totalFindings: findings.length,
      high,
      medium,
      low,
      readiness: high ? "Blocked" : medium ? "Needs Review" : "Ready",
      ...(payload.summary || {}),
    },
    findings,
    recommendations: Array.isArray(payload.recommendations) ? payload.recommendations : [],
    qualityNotes: Array.isArray(payload.qualityNotes) ? payload.qualityNotes : [],
  };
}

function buildGapContext(request, jobId) {
  const signals = compactSignals(request.packageSignals);
  return {
    jobId,
    documents: Array.isArray(request.documents) ? request.documents : [],
    signals,
    auditRequest: {
      documentCount: Array.isArray(request.documents) ? request.documents.length : 0,
      packageSignals: summarizeSignals(signals),
    },
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
