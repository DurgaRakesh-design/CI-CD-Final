import { CORS_HEADERS, json, parseEventBody, compactSignals, buildEvidenceDigest, callOpenAI, upsertAiJob, appendAiJobLog, connectBlobsFromEvent, getPackageUploadBytes } from "./_shared.js";

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
  if (hasPackageUploadPayload(context.packageUpload)) {
    await reportProgress({ stage: "file-analysis", progress: 10, message: "Uploading package to OpenAI for source-to-document traceability audit." });
    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "file-analysis",
      message: "Using OpenAI file/tool workflow for full source-code-to-BRD/BDD traceability audit.",
      meta: {
        fileName: context.packageUpload.name,
        size: context.packageUpload.size,
        blobUploadId: context.packageUpload.blobUploadId || "",
        model: process.env.OPENAI_MODEL || "gpt-4.1",
      },
    });
    const audit = await buildFileBasedTraceabilityAudit(context, reportProgress);
    await reportProgress({ stage: "verifying", progress: 85, message: "Verifying traceability audit quality." });
    const validated = normalizeGapPayload(audit);
    if (!validated.findings.length && !validated.coverageMatrix?.length && !validated.summary) {
      throw new Error("Traceability audit returned no usable findings or coverage matrix.");
    }
    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "done",
      message: "File-based traceability audit succeeded.",
      meta: { totalFindings: validated.summary?.totalFindings || 0, coverageRows: validated.coverageMatrix?.length || 0 },
    });
    return validated;
  }

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

async function buildFileBasedTraceabilityAudit(context, reportProgress) {
  const fileId = await uploadPackageToOpenAI(context.packageUpload);
  try {
    const system = [
      "ROLE: You are a principal QA governance auditor, Java solution architect, business analyst, and BDD traceability specialist.",
      "MISSION: Perform a full source-code-to-BRD/BDD traceability audit using the attached Java project ZIP and the reviewed BRD/BDD documents.",
      "SOURCE OF TRUTH: The ZIP source code is the primary evidence. The BRD/BDD documents are claims that must be verified against code evidence.",
      "NO HALLUCINATION CONTRACT: Do not invent features, validations, roles, integrations, tests, pages, APIs, or business rules. If the code is silent, mark the item as missing, unsupported, or low-confidence.",
      "AUDIT DEPTH: Inspect controllers, services, models/entities/documents, DTOs, validators, security config, repositories, resource/config files, frontend routes/pages where present, tests, and build files.",
      "TRACEABILITY: Every finding must include concrete source evidence anchors and document evidence anchors where available.",
      "QUALITY BAR: Prefer precise, actionable findings over generic observations. Distinguish missing document coverage from unsupported document claims.",
      "OUTPUT: Return only JSON that matches the requested schema.",
    ].join(" ");

    const userPayload = {
      packageSignals: context.signals,
      evidenceDigest: buildEvidenceDigest(context.signals),
      documents: context.documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        module: doc.module,
        content: doc.type === "BDD" ? doc.gherkinContent || doc.content : doc.content,
        evidenceAnchors: Array.isArray(doc.evidenceAnchors) ? doc.evidenceAnchors : [],
      })),
      auditInstructions: [
        "First build an internal source inventory grouped by capability: authentication, catalog/product, category, cart, wishlist, order/payment, review, admin, profile, integration, security, validation, error handling, persistence, tests, frontend.",
        "Map source capabilities to BRD FR/BR/GAP/RISK IDs and BDD Feature/Scenario coverage.",
        "For each capability classify coverageStatus as covered, partial, missing_brd, missing_bdd, unsupported_document_claim, weak_traceability, or not_applicable.",
        "Flag BDD quality gaps when scenarios are too generic, lack concrete validations, omit negative/security/boundary cases evidenced by code, or cannot be traced to source methods/endpoints.",
        "Flag BRD quality gaps when source capabilities are omitted, requirements are unsupported by source, risks are missing, or evidence anchors are vague.",
        "Automation/test audit rule: do not create a high-severity finding merely because the uploaded source repository has no automated tests or no BDD files. In this product flow, generated/uploaded BDD documents may intentionally live outside the source ZIP and are valid requirements artifacts. Only create an automation/test finding when reviewed documents explicitly claim executable automation, CI test coverage, or implemented BDD tests that the source/package evidence does not support. Otherwise report source test absence as a quality note or low-priority recommendation, not as a blocking BRD/BDD traceability gap.",
        "Missing BDD ownership rule: if a source capability is covered in the BRD but no specific BDD feature/scenario covers it, set gapType='missing_bdd', linkStatus='unlinked', relatedDocumentId='', relatedDocument='', and actionType='create_bdd'. Do not attach the finding only to the BRD just because the BRD mentions the capability.",
        "Multi-document rule: when a finding affects multiple existing documents, include all specific document titles/sections in documentEvidence and evidenceAnchors. relatedDocument should name the most actionable owner only; avoid generic BRD-only ownership for BDD gaps.",
        "For every high/medium finding, provide recommendedFix that can drive BRD/BDD regeneration or manual document correction.",
      ],
      requiredOutputShape: traceabilityAuditOutputShape(),
    };

    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "file-analysis",
      message: "Calling OpenAI Responses API with Code Interpreter and uploaded package for traceability audit.",
      meta: { fileId, documentCount: context.documents.length },
    });
    await reportProgress({ stage: "analyzing", progress: 55, message: "Auditing source capabilities against BRD and BDD coverage." });

    let result = await callOpenAIFileTool({
      system,
      user: JSON.stringify(userPayload),
      fileId,
      responseSchema: traceabilityAuditResponseSchema(),
      temperature: 0.08,
      maxOutputTokens: Number(process.env.OPENAI_GAP_MAX_OUTPUT_TOKENS || process.env.OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS || 30000),
    });
    if (!result) throw new Error("File-based traceability audit returned no response.");

    const qualityGate = evaluateTraceabilityAuditDepth(result, context.documents);
    if (!qualityGate.passed) {
      await appendAiJobLog(JOB_TYPE, context.jobId, {
        stage: "analyzing",
        message: "Initial traceability audit was too shallow; requesting deeper source-to-document audit.",
        meta: qualityGate,
      });
      result = await callOpenAIFileTool({
        system,
        user: JSON.stringify({
          ...userPayload,
          qualityGateFeedback: {
            status: "previous_audit_too_shallow",
            missing: qualityGate.issues,
            requiredAction: "Regenerate the audit with a deeper capability matrix, concrete source/document evidence, unsupported claim checks, missing scenario checks, and actionable BRD/BDD regeneration guidance.",
          },
        }),
        fileId,
        responseSchema: traceabilityAuditResponseSchema(),
        temperature: 0.06,
        maxOutputTokens: Number(process.env.OPENAI_GAP_MAX_OUTPUT_TOKENS || process.env.OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS || 30000),
      });
    }

    await appendAiJobLog(JOB_TYPE, context.jobId, {
      stage: "analyzing",
      message: "File-based traceability audit response received from OpenAI.",
      meta: {
        findings: result.findings?.length || 0,
        coverageRows: result.coverageMatrix?.length || 0,
        missingScenarios: result.missingScenarios?.length || 0,
      },
    });
    return result;
  } finally {
    await deleteOpenAIFile(fileId).catch(() => {});
  }
}

async function buildGapAssessmentPlan(context) {
  const system = [
    "ROLE: You are a senior QA governance reviewer, BA traceability auditor, and Java source-code reviewer.",
    "MISSION: Build an evidence-first review plan for comparing BRD/BDD documents against the Java package evidence.",
    "QUALITY BAR: Use only the supplied source evidence and uploaded requirement files. If evidence is thin, say so and lower confidence rather than inventing a gap.",
    "RULES: Prefer concrete business-capability analysis over technical layer summaries. Do not invent gaps or business behavior.",
    "TRACEABILITY: Every focus area, risk, and coverage mapping should be explainable from file paths, classes, methods, endpoints, tests, or uploaded requirement names.",
    "FIRST UPLOAD MODE: Assume this is the only analysis pass on the full package and make the coverage assessment as complete as possible.",
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
      "Use capabilityHints, evidenceHighlights, validationSignals, securitySignals, and featureSignals to anchor the review plan.",
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
    "FIRST UPLOAD MODE: Perform the fullest evidence-based pass now; do not hold findings back for a later regeneration cycle.",
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
      "If a source capability is covered in BRD but missing from all BDD feature/scenario documents, set gapType='missing_bdd', linkStatus='unlinked', relatedDocumentId='', relatedDocument='', and actionType='create_bdd'. Do not link it to BRD only.",
      "Do not use generic relatedDocument values such as 'BRD/BDD' when a specific document cannot be identified. Leave it empty and mark unlinked.",
      "Do not create a finding titled like 'No automated test or BDD files in source repository' merely because source tests or in-repo BDD files are absent. External generated/uploaded BDD documents are valid in this flow; source test absence belongs in qualityNotes unless documents falsely claim executable automation.",
      "Use business capability names, not technical layer names, for modules.",
      "Do not report a gap unless you can point to source evidence or an uploaded requirement.",
      "If a document includes behavior unsupported by source evidence, report it as unsupported coverage.",
      "If source evidence is too weak to decide, make a low-severity review recommendation instead of a high-confidence gap.",
      "Include qualityNotes in the response when the evidence is thin or ambiguous.",
      "For each finding, include the concrete evidence hint that would let a reviewer verify it quickly.",
      "Prefer evidenceHints that mention specific files, classes, methods, endpoints, tests, or feature titles rather than generic summary language.",
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
              required: ["severity", "title", "description", "relatedDocumentId", "relatedDocument", "linkStatus", "module", "packageSignal", "impact", "recommendedFix", "actionType", "evidenceAnchors"],
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
  const suppressedQualityNotes = [];
  const rawFindings = (Array.isArray(payload.findings) ? payload.findings : []).filter((item) => {
    if (!isSourceOnlyAutomationFinding(item)) return true;
    suppressedQualityNotes.push("Source repository test/BDD absence was treated as a non-blocking quality note because BRD/BDD artifacts are supplied externally in this flow.");
    return false;
  });
  const findings = rawFindings.map((item) => ({
    gapId: item.gapId || item.id || "",
    gapType: item.gapType || "",
    confidence: item.confidence || "",
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
    sourceEvidence: Array.isArray(item.sourceEvidence) ? item.sourceEvidence : [],
    documentEvidence: Array.isArray(item.documentEvidence) ? item.documentEvidence : [],
    missingScenarios: Array.isArray(item.missingScenarios) ? item.missingScenarios : [],
  }));
  const high = findings.filter((item) => item.severity === "high").length;
  const medium = findings.filter((item) => item.severity === "medium").length;
  const low = findings.filter((item) => item.severity === "low").length;
  const summary = payload.summary || {};
  return {
    summary: {
      totalFindings: findings.length,
      high,
      medium,
      low,
      readiness: high ? "Blocked" : medium ? "Needs Review" : "Ready",
      traceabilityScore: typeof summary.traceabilityScore === "number" ? summary.traceabilityScore : null,
      documentCoverageScore: typeof summary.documentCoverageScore === "number" ? summary.documentCoverageScore : null,
      bddQualityScore: typeof summary.bddQualityScore === "number" ? summary.bddQualityScore : null,
      ...summary,
    },
    findings,
    coverageMatrix: normalizeCoverageMatrix(payload.coverageMatrix),
    unsupportedClaims: normalizeSimpleRows(payload.unsupportedClaims),
    missingScenarios: normalizeSimpleRows(payload.missingScenarios),
    sourceInventory: normalizeSimpleRows(payload.sourceInventory),
    recommendations: Array.isArray(payload.recommendations) ? payload.recommendations : [],
    qualityNotes: [...(Array.isArray(payload.qualityNotes) ? payload.qualityNotes : []), ...suppressedQualityNotes],
  };
}

function isSourceOnlyAutomationFinding(item) {
  const text = [
    item?.gapType,
    item?.title,
    item?.description,
    item?.module,
    item?.recommendedFix,
    item?.packageSignal,
  ].map((value) => String(value || "").toLowerCase()).join(" ");
  const isGenericSourceTestGap =
    text.includes("no automated test")
    && text.includes("bdd")
    && (text.includes("source repository") || text.includes("source code") || text.includes("repository"));
  const isTestingModuleOnly = /testing|automation|application/.test(String(item?.module || "Application").toLowerCase());
  return isGenericSourceTestGap && isTestingModuleOnly;
}

function normalizeCoverageMatrix(value) {
  return (Array.isArray(value) ? value : []).map((row) => ({
    capability: row.capability || "",
    sourceEvidence: Array.isArray(row.sourceEvidence) ? row.sourceEvidence : [],
    brdCoverage: row.brdCoverage || "",
    bddCoverage: row.bddCoverage || "",
    coverageStatus: row.coverageStatus || "",
    confidence: row.confidence || "",
    notes: row.notes || "",
  }));
}

function normalizeSimpleRows(value) {
  return (Array.isArray(value) ? value : []).map((row) => {
    if (typeof row === "string") return { title: row };
    return { ...row };
  });
}

function buildGapContext(request, jobId) {
  const signals = compactSignals(request.packageSignals);
  return {
    jobId,
    documents: Array.isArray(request.documents) ? request.documents : [],
    signals,
    packageUpload: normalizePackageUpload(request.packageUpload),
    auditRequest: {
      documentCount: Array.isArray(request.documents) ? request.documents.length : 0,
      packageSignals: summarizeSignals(signals),
      hasPackageUpload: hasPackageUploadPayload(request.packageUpload),
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

async function uploadPackageToOpenAI(packageUpload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for file-based gap analysis.");
  const storedPackage = packageUpload.blobUploadId ? await getPackageUploadBytes(packageUpload.blobUploadId) : null;
  const bytes = storedPackage?.bytes || Buffer.from(packageUpload.contentBase64 || "", "base64");
  if (!bytes.length) throw new Error("Package upload was empty.");
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
  timeoutMs = Number(process.env.OPENAI_FILE_TOOL_TIMEOUT_MS || 840000),
  maxOutputTokens = Number(process.env.OPENAI_GAP_MAX_OUTPUT_TOKENS || 30000),
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
        max_output_tokens: maxOutputTokens,
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
  const raw = await response.text();
  const payload = parseJsonOrNull(raw);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI file-tool request failed with ${response.status}: ${raw.slice(0, 400)}`);
  }
  const outputText = extractResponseText(payload);
  if (!String(outputText || "").trim()) {
    throw new Error(`OpenAI file-tool returned no final text output. ${summarizeResponsePayload(payload)}`);
  }
  try {
    return JSON.parse(outputText);
  } catch {
    throw new Error(`OpenAI file-tool returned invalid JSON content: ${String(outputText || "").slice(0, 180)} ${summarizeResponsePayload(payload)}`);
  }
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

function evaluateTraceabilityAuditDepth(payload, documents) {
  const issues = [];
  const matrix = Array.isArray(payload?.coverageMatrix) ? payload.coverageMatrix : [];
  const findings = Array.isArray(payload?.findings) ? payload.findings : [];
  if (matrix.length < Math.min(4, Math.max(2, documents.length))) issues.push(`Coverage matrix is too small (${matrix.length} rows).`);
  if (!findings.some((item) => Array.isArray(item.sourceEvidence) && item.sourceEvidence.length)) issues.push("Findings do not include sourceEvidence anchors.");
  if (!findings.some((item) => Array.isArray(item.documentEvidence) && item.documentEvidence.length)) issues.push("Findings do not include documentEvidence anchors.");
  if (!Array.isArray(payload?.sourceInventory) || payload.sourceInventory.length < 3) issues.push("Source inventory is too shallow.");
  if (!payload?.summary || typeof payload.summary.traceabilityScore !== "number") issues.push("Summary is missing numeric traceabilityScore.");
  return { passed: issues.length === 0, issues };
}

function traceabilityAuditOutputShape() {
  return {
    summary: {
      totalFindings: "number",
      high: "number",
      medium: "number",
      low: "number",
      readiness: "Blocked | Needs Review | Ready",
      traceabilityScore: "0-100 number",
      documentCoverageScore: "0-100 number",
      bddQualityScore: "0-100 number",
    },
    sourceInventory: [
      {
        capability: "business capability",
        sourceAreas: ["file/class/method/endpoint/resource evidence"],
        notes: "string",
      },
    ],
    coverageMatrix: [
      {
        capability: "business capability",
        sourceEvidence: ["file/class/method/endpoint/resource evidence"],
        brdCoverage: "covered | partial | missing | unsupported",
        bddCoverage: "covered | partial | missing | unsupported",
        coverageStatus: "covered | partial | missing_brd | missing_bdd | unsupported_document_claim | weak_traceability | not_applicable",
        confidence: "high | medium | low",
        notes: "string",
      },
    ],
    findings: [
      {
        gapId: "GAP-001",
        gapType: "missing_brd | missing_bdd | unsupported_document_claim | weak_traceability | security | validation | integration | automation | risk",
        severity: "high | medium | low",
        confidence: "high | medium | low",
        title: "string",
        description: "string",
        relatedDocumentId: "string",
        relatedDocument: "string",
        linkStatus: "linked | unlinked",
        module: "business module",
        packageSignal: "short source evidence hint",
        sourceEvidence: ["file/class/method/endpoint/resource evidence"],
        documentEvidence: ["BRD/BDD section, FR/BR/GAP ID, feature/scenario title"],
        impact: "business impact",
        recommendedFix: "actionable regeneration/manual correction guidance",
        actionType: "regenerate_document | create_bdd",
        evidenceAnchors: ["reviewer-friendly combined anchors"],
        missingScenarios: ["BDD scenario titles to add when applicable"],
      },
    ],
    unsupportedClaims: [
      {
        claim: "documented claim",
        documentEvidence: "doc/section/scenario",
        sourceEvidence: "why source does not support it",
        recommendedFix: "string",
      },
    ],
    missingScenarios: [
      {
        capability: "string",
        scenarioTitle: "string",
        scenarioType: "happy_path | negative | boundary | security | integration | error_handling | data_integrity",
        sourceEvidence: "string",
        targetDocument: "string",
      },
    ],
    recommendations: ["string"],
    qualityNotes: ["string"],
  };
}

function traceabilityAuditResponseSchema() {
  const stringArray = { type: "array", items: { type: "string" } };
  return {
    name: "source_to_brd_bdd_traceability_audit",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "sourceInventory", "coverageMatrix", "findings", "unsupportedClaims", "missingScenarios", "recommendations", "qualityNotes"],
      properties: {
        summary: {
          type: "object",
          additionalProperties: false,
          required: ["totalFindings", "high", "medium", "low", "readiness", "traceabilityScore", "documentCoverageScore", "bddQualityScore"],
          properties: {
            totalFindings: { type: "number" },
            high: { type: "number" },
            medium: { type: "number" },
            low: { type: "number" },
            readiness: { type: "string" },
            traceabilityScore: { type: "number" },
            documentCoverageScore: { type: "number" },
            bddQualityScore: { type: "number" },
          },
        },
        sourceInventory: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["capability", "sourceAreas", "notes"],
            properties: {
              capability: { type: "string" },
              sourceAreas: stringArray,
              notes: { type: "string" },
            },
          },
        },
        coverageMatrix: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["capability", "sourceEvidence", "brdCoverage", "bddCoverage", "coverageStatus", "confidence", "notes"],
            properties: {
              capability: { type: "string" },
              sourceEvidence: stringArray,
              brdCoverage: { type: "string" },
              bddCoverage: { type: "string" },
              coverageStatus: { type: "string" },
              confidence: { type: "string" },
              notes: { type: "string" },
            },
          },
        },
        findings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["gapId", "gapType", "severity", "confidence", "title", "description", "relatedDocumentId", "relatedDocument", "linkStatus", "module", "packageSignal", "sourceEvidence", "documentEvidence", "impact", "recommendedFix", "actionType", "evidenceAnchors", "missingScenarios"],
            properties: {
              gapId: { type: "string" },
              gapType: { type: "string" },
              severity: { type: "string" },
              confidence: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              relatedDocumentId: { type: "string" },
              relatedDocument: { type: "string" },
              linkStatus: { type: "string" },
              module: { type: "string" },
              packageSignal: { type: "string" },
              sourceEvidence: stringArray,
              documentEvidence: stringArray,
              impact: { type: "string" },
              recommendedFix: { type: "string" },
              actionType: { type: "string" },
              evidenceAnchors: stringArray,
              missingScenarios: stringArray,
            },
          },
        },
        unsupportedClaims: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["claim", "documentEvidence", "sourceEvidence", "recommendedFix"],
            properties: {
              claim: { type: "string" },
              documentEvidence: { type: "string" },
              sourceEvidence: { type: "string" },
              recommendedFix: { type: "string" },
            },
          },
        },
        missingScenarios: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["capability", "scenarioTitle", "scenarioType", "sourceEvidence", "targetDocument"],
            properties: {
              capability: { type: "string" },
              scenarioTitle: { type: "string" },
              scenarioType: { type: "string" },
              sourceEvidence: { type: "string" },
              targetDocument: { type: "string" },
            },
          },
        },
        recommendations: stringArray,
        qualityNotes: stringArray,
      },
    },
  };
}
