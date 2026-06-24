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
    await preloadPackageMaterial(context);
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
    const validated = normalizeGapPayload(audit, context.documents);
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
  const validated = normalizeGapPayload(report, context.documents);
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
      documentCatalog: context.documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        module: doc.module,
      })),
      auditInstructions: [
        "First build an internal source inventory grouped by capability: authentication, catalog/product, category, cart, wishlist, order/payment, review, admin, profile, integration, security, validation, error handling, persistence, tests, frontend.",
        "Map source capabilities to BRD requirement coverage and BDD feature/scenario coverage using the exact reviewed document ids/titles provided in documentCatalog.",
        "BDD coverage semantics are strict: use bddCoverage='missing' only when no reviewed BDD document or scenario covers the capability at all. If a reviewed BDD document exists but is incomplete, generic, or missing validations, use bddCoverage='partial' and coverageStatus='partial' or 'weak_traceability' instead.",
        "Do not emit duplicate coverageMatrix rows for the same capability/evidence pair. If a BDD scenario outline repeats the same capability across examples, consolidate it into one matrix row and mention the examples in notes instead.",
        "For each capability classify coverageStatus as covered, partial, missing_brd, missing_bdd, unsupported_document_claim, weak_traceability, or not_applicable.",
        "Flag BDD quality gaps when scenarios are too generic, lack concrete validations, omit negative/security/boundary cases evidenced by code, or cannot be traced to source methods/endpoints.",
        "BDD rule: treat BDD as requirement/scenario documentation, not as automated unit/integration/UI tests. Never classify missing automated tests, test coverage, or unit-test implementation as gapType='missing_bdd'. missing_bdd is only for absent or insufficient BDD feature/scenario documentation.",
        "Flag BRD quality gaps when source capabilities are omitted, requirements are unsupported by source, risks are missing, or evidence anchors are vague.",
        "Automation/test audit rule: do not create a high-severity finding merely because the uploaded source repository has no automated tests or no BDD files. In this product flow, generated/uploaded BDD documents may intentionally live outside the source ZIP and are valid requirements artifacts. Only create an automation/test finding when reviewed documents explicitly claim executable automation, CI test coverage, or implemented BDD tests that the source/package evidence does not support. Otherwise report source test absence as a quality note or low-priority recommendation, not as a blocking BRD/BDD traceability gap.",
        "If the BRD or BDD already documents an open risk, limitation, or known caveat, put it in documentedOpenRisks instead of findings unless the source code contradicts the document or required traceability is missing.",
        "Missing BDD ownership rule: if a source capability is covered in the BRD but no specific BDD feature/scenario covers it, set gapType='missing_bdd', linkStatus='unlinked', relatedDocumentId='', relatedDocument='', and actionType='create_bdd'. Do not attach the finding only to the BRD just because the BRD mentions the capability.",
        "If a BDD document exists but its scenarios are too generic, incomplete, or weakly mapped, do not mark the capability as missing_bdd. Keep the existing BDD linked to that exact reviewed BDD document id/title and classify it as partial coverage or weak_traceability with a precise explanation.",
        "When documentEvidence or feature/scenario titles point to an existing reviewed BDD document, relatedDocumentId and relatedDocument must reference that BDD document. Do not leave the finding unlinked in that case.",
        "Strict ownership rule: only set linkStatus='linked' when an existing reviewed document is the precise owner to update now. Use the exact document id/title from documentCatalog. If ownership is uncertain, set linkStatus='ambiguous'. If a new BDD is needed, set linkStatus='unlinked'. Never guess-link a gap to a document by module similarity alone.",
        "missing_brd rule: only use gapType='missing_brd' when the reviewed BRD genuinely lacks the capability or acceptance coverage. Do not use missing_brd when the capability exists in code and the BRD already describes it.",
        "missing_in_code rule: when BRD or BDD clearly documents a capability but the source package does not support it, use gapType='missing_in_code' or unsupported_document_claim rather than missing_brd/missing_bdd.",
        "Multi-document rule: when a finding affects multiple existing documents, include all specific document titles/sections in documentEvidence and evidenceAnchors. relatedDocument should name the most actionable owner only; avoid generic BRD-only ownership for BDD gaps.",
        "For every high/medium finding, provide recommendedFix that can drive BRD/BDD regeneration or manual document correction.",
        "Always return at least one recommendation. If no action is needed, return a positive recommendation such as proceeding to approval.",
        "Always return at least one qualityNote. If there are no caveats, return a positive note that evidence quality was sufficient for this review.",
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
    if (!qualityGate.passed && isGapAuditRetryEnabled()) {
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
    } else if (!qualityGate.passed) {
      await appendAiJobLog(JOB_TYPE, context.jobId, {
        stage: "analyzing",
        message: "Initial traceability audit was shallow, but automatic deep retry is disabled for faster portal feedback.",
        meta: qualityGate,
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
    documentCatalog: context.documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      module: doc.module,
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
          qualityNotes: { type: "array", minItems: 1, items: { type: "string" } },
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
      "If a finding clearly belongs to an existing BRD or BDD, set linkStatus='linked', relatedDocumentId to that exact reviewed document id, relatedDocument to its exact title, and actionType='regenerate_document'.",
      "If a finding represents a missing capability with no existing BRD/BDD owner, set linkStatus='unlinked' and actionType='create_bdd'.",
      "If a source capability is covered in BRD but missing from all BDD feature/scenario documents, set gapType='missing_bdd', linkStatus='unlinked', relatedDocumentId='', relatedDocument='', and actionType='create_bdd'. Do not link it to BRD only.",
      "BDD coverage semantics are strict: use missing_bdd only when no reviewed BDD document or scenario covers the capability at all. If a reviewed BDD document exists but is incomplete, generic, or weakly mapped, keep it linked and classify the issue as weak_traceability or partial coverage instead.",
      "If ownership is not safe to assign to one exact existing document, set linkStatus='ambiguous', leave relatedDocumentId empty, and explain the ambiguity in description/qualityNotes rather than forcing a link.",
      "Do not use generic relatedDocument values such as 'BRD/BDD' when a specific document cannot be identified. Leave it empty and mark unlinked.",
      "BDD rule: BDD coverage means feature/scenario documentation coverage, not automated test execution or unit-test implementation. Do not recommend creating unit tests as the fix for gapType='missing_bdd'.",
      "Do not create a finding titled like 'No automated test or BDD files in source repository' merely because source tests or in-repo BDD files are absent. External generated/uploaded BDD documents are valid in this flow; source test absence belongs in qualityNotes unless documents falsely claim executable automation.",
      "Use business capability names, not technical layer names, for modules.",
      "Use missing_in_code or unsupported_document_claim when the documents describe behavior that the source package does not implement.",
      "Do not report a gap unless you can point to source evidence or an uploaded requirement.",
      "If a document includes behavior unsupported by source evidence, report it as unsupported coverage.",
      "If a BDD document exists but is incomplete or too generic, keep it linked to that exact reviewed BDD document and classify the issue as weak_traceability or partial coverage rather than missing_bdd.",
      "If documentEvidence points to an existing reviewed BDD document, relatedDocumentId and relatedDocument must reference that BDD document rather than remaining unlinked.",
      "Do not emit duplicate findings or repeated matrix rows for the same capability just because multiple BDD examples exercise the same underlying behavior.",
      "If BRD or BDD already documents a known risk, limitation, or open caveat, include it under documentedOpenRisks instead of findings unless it is itself a traceability mismatch.",
      "If source evidence is too weak to decide, make a low-severity review recommendation instead of a high-confidence gap.",
      "Include qualityNotes in the response when the evidence is thin or ambiguous.",
      "For each finding, include the concrete evidence hint that would let a reviewer verify it quickly.",
      "Prefer evidenceHints that mention specific files, classes, methods, endpoints, tests, or feature titles rather than generic summary language.",
      "Always return at least one recommendation. If no corrective action is needed, provide a positive next-step recommendation.",
      "Always return at least one qualityNote. If there are no caveats, provide a positive note that evidence was sufficient and no major ambiguity remained.",
    ],
    outputShape: {
      summary: "Object with totalFindings, high, medium, low, readiness.",
      findings: "Array of findings with severity, title, description, gapType, sourceCapabilityId, sourceCapability, targetDocumentType, targetDocumentTitle, relatedDocumentId, relatedDocument, linkStatus, module, packageSignal, impact, recommendedFix, actionType, targetScenarioRefs, evidenceAnchors.",
      documentedOpenRisks: "Array of known risks or limitations already documented in BRD or BDD and therefore not counted as open traceability findings.",
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
        required: ["summary", "findings", "documentedOpenRisks", "recommendations", "qualityNotes"],
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
              required: ["severity", "title", "description", "gapType", "sourceCapabilityId", "sourceCapability", "targetDocumentType", "targetDocumentTitle", "relatedDocumentId", "relatedDocument", "linkStatus", "module", "packageSignal", "impact", "recommendedFix", "actionType", "targetScenarioRefs", "evidenceAnchors"],
              properties: {
                severity: { type: "string" },
                title: { type: "string" },
                description: { type: "string" },
                gapType: { type: "string" },
                sourceCapabilityId: { type: "string" },
                sourceCapability: { type: "string" },
                targetDocumentType: { type: "string" },
                targetDocumentTitle: { type: "string" },
                relatedDocumentId: { type: "string" },
                relatedDocument: { type: "string" },
                linkStatus: { type: "string" },
                module: { type: "string" },
                packageSignal: { type: "string" },
                impact: { type: "string" },
                recommendedFix: { type: "string" },
                actionType: { type: "string" },
                targetScenarioRefs: { type: "array", items: { type: "string" } },
                evidenceAnchors: { type: "array", items: { type: "string" } },
              },
            },
          },
          documentedOpenRisks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["riskId", "title", "severity", "relatedDocumentId", "relatedDocument", "documentType", "evidence", "explanation", "recommendation"],
              properties: {
                riskId: { type: "string" },
                title: { type: "string" },
                severity: { type: "string" },
                relatedDocumentId: { type: "string" },
                relatedDocument: { type: "string" },
                documentType: { type: "string" },
                evidence: { type: "array", items: { type: "string" } },
                explanation: { type: "string" },
                recommendation: { type: "string" },
              },
            },
          },
          recommendations: { type: "array", minItems: 1, items: { type: "string" } },
          qualityNotes: { type: "array", minItems: 1, items: { type: "string" } },
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

function normalizeGapPayload(payload, documents = []) {
  const findings = (Array.isArray(payload.findings) ? payload.findings : []).map((item) => sanitizeGapFinding(item, documents));
  const documentedOpenRisks = normalizeDocumentedOpenRisks(payload.documentedOpenRisks, documents);
  const qualityNotes = normalizeQualityNotes(payload.qualityNotes);
  const high = findings.filter((item) => item.severity === "high").length;
  const medium = findings.filter((item) => item.severity === "medium").length;
  const low = findings.filter((item) => item.severity === "low").length;
  const summary = payload.summary || {};
  const readiness = computeGapReadiness({ findings, documentedOpenRisks, summary });
  return {
    summary: {
      ...summary,
      totalFindings: findings.length,
      high,
      medium,
      low,
      readiness,
      traceabilityScore: typeof summary.traceabilityScore === "number" ? summary.traceabilityScore : null,
      documentCoverageScore: typeof summary.documentCoverageScore === "number" ? summary.documentCoverageScore : null,
      bddQualityScore: typeof summary.bddQualityScore === "number" ? summary.bddQualityScore : null,
    },
    findings,
    documentedOpenRisks,
    coverageMatrix: normalizeCoverageMatrix(payload.coverageMatrix),
    unsupportedClaims: normalizeSimpleRows(payload.unsupportedClaims),
    missingScenarios: normalizeSimpleRows(payload.missingScenarios),
    sourceInventory: normalizeSimpleRows(payload.sourceInventory),
    recommendations: Array.isArray(payload.recommendations) ? payload.recommendations : [],
    qualityNotes,
  };
}

function sanitizeGapFinding(item, documents) {
  let gapType = normalizeGapType(item.gapType || "");
  let targetDocumentType = inferGapTargetDocumentType({ ...item, gapType });
  const relatedDocumentId = String(item.relatedDocumentId || "").trim();
  const relatedDocument = String(item.relatedDocument || "").trim();
  const resolvedDoc = resolveRelatedDocument(documents, {
    relatedDocumentId,
    relatedDocument,
    targetDocumentType,
  });
  const normalizedLinkStatus = normalizeLinkStatus(item.linkStatus, {
    resolvedDoc,
    relatedDocumentId,
    relatedDocument,
  });
  const actionType = normalizeActionType(item.actionType, gapType, normalizedLinkStatus);
  const documentOwner = normalizedLinkStatus === "linked" && resolvedDoc
    ? resolvedDoc
    : null;

  return {
    gapId: item.gapId || item.id || "",
    gapType,
    confidence: item.confidence || "",
    severity: ["high", "medium", "low"].includes(String(item.severity).toLowerCase())
      ? String(item.severity).toLowerCase()
      : "medium",
    title: item.title || "Requirement coverage gap",
    description: item.description || "",
    sourceCapabilityId: String(item.sourceCapabilityId || item.capabilityId || "").trim(),
    sourceCapability: String(item.sourceCapability || item.capability || item.title || "").trim(),
    targetDocumentType,
    targetDocumentTitle: String(item.targetDocumentTitle || "").trim(),
    relatedDocumentId: documentOwner?.id || (normalizedLinkStatus === "linked" ? relatedDocumentId : ""),
    relatedDocument: documentOwner?.title || (normalizedLinkStatus === "linked" ? relatedDocument : ""),
    ownerDocumentIds: documentOwner?.id ? [documentOwner.id] : [],
    linkStatus: normalizedLinkStatus,
    module: item.module || "Application",
    packageSignal: item.packageSignal || "",
    impact: item.impact || "",
    recommendedFix: normalizeRecommendedFix(item.recommendedFix || "", gapType),
    actionType,
    targetScenarioRefs: Array.isArray(item.targetScenarioRefs) ? item.targetScenarioRefs : [],
    evidenceAnchors: Array.isArray(item.evidenceAnchors) ? item.evidenceAnchors : [],
    sourceEvidence: Array.isArray(item.sourceEvidence) ? item.sourceEvidence : [],
    documentEvidence: Array.isArray(item.documentEvidence) ? item.documentEvidence : [],
    missingScenarios: Array.isArray(item.missingScenarios) ? item.missingScenarios : [],
  };
}

function normalizeCoverageMatrix(value) {
  const seen = new Set();
  const rows = [];
  for (const row of Array.isArray(value) ? value : []) {
    const normalized = {
      capability: row.capability || "",
      sourceEvidence: Array.isArray(row.sourceEvidence) ? row.sourceEvidence : [],
      brdCoverage: row.brdCoverage || "",
      bddCoverage: row.bddCoverage || "",
      coverageStatus: row.coverageStatus || "",
      confidence: row.confidence || "",
      notes: row.notes || "",
    };
    const key = [
      normalizeGapToken(normalized.capability),
      normalized.sourceEvidence.map(normalizeGapToken).join("|"),
      normalizeGapToken(normalized.brdCoverage),
      normalizeGapToken(normalized.bddCoverage),
      normalizeGapToken(normalized.coverageStatus),
    ].join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(normalized);
  }
  return rows;
}

function normalizeSimpleRows(value) {
  return (Array.isArray(value) ? value : []).map((row) => {
    if (typeof row === "string") return { title: row };
    return { ...row };
  });
}

function normalizeGapType(value) {
  const token = normalizeGapToken(value);
  if (!token) return "other";
  if (token === "ambiguous_mapping") return "weak_traceability";
  return token;
}

function inferGapTargetDocumentType(item) {
  const explicit = String(item?.targetDocumentType || "").toUpperCase();
  if (explicit === "BRD" || explicit === "BDD") return explicit;
  const normalizedGapType = normalizeGapType(item?.gapType);
  if (normalizedGapType === "missing_bdd") return "BDD";
  if (normalizedGapType === "missing_brd") return "BRD";
  return "";
}

function normalizeLinkStatus(value, { resolvedDoc, relatedDocumentId, relatedDocument }) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "linked" && resolvedDoc) return "linked";
  if (normalized === "unlinked") return "unlinked";
  if (normalized === "ambiguous") return "ambiguous";
  if ((relatedDocumentId || relatedDocument) && !resolvedDoc) return "ambiguous";
  if (resolvedDoc && !normalized) return "linked";
  return "unlinked";
}

function normalizeActionType(value, gapType, linkStatus) {
  if (value === "regenerate_document" || value === "create_bdd") return value;
  if (gapType === "missing_bdd") return linkStatus === "linked" ? "regenerate_document" : "create_bdd";
  if (gapType === "missing_brd" && linkStatus === "linked") return "regenerate_document";
  return linkStatus === "linked" ? "regenerate_document" : "";
}

function resolveRelatedDocument(documents, { relatedDocumentId, relatedDocument, targetDocumentType }) {
  const candidates = targetDocumentType
    ? documents.filter((doc) => doc.type === targetDocumentType)
    : documents;
  if (!candidates.length) return null;

  if (relatedDocumentId) {
    const exactById = candidates.find((doc) => String(doc.id || "").trim() === relatedDocumentId);
    if (exactById) return exactById;
  }

  const titleToken = normalizeGapToken(relatedDocument);
  if (titleToken) {
    const exactByTitle = candidates.find((doc) => normalizeGapToken(doc.title) === titleToken);
    if (exactByTitle) return exactByTitle;
  }

  if (targetDocumentType === "BRD" && candidates.length === 1 && !relatedDocumentId && !relatedDocument) {
    return candidates[0];
  }
  return null;
}

function normalizeGapToken(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeRecommendedFix(value, gapType) {
  return String(value || "").trim();
}

function normalizeDocumentedOpenRisks(value, documents) {
  const rows = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = [];
  for (const item of rows) {
    const relatedDocumentId = String(item?.relatedDocumentId || "").trim();
    const relatedDocument = String(item?.relatedDocument || "").trim();
    const documentType = String(item?.documentType || item?.targetDocumentType || "").toUpperCase();
    const resolvedDoc = resolveRelatedDocument(documents, {
      relatedDocumentId,
      relatedDocument,
      targetDocumentType: documentType === "BRD" || documentType === "BDD" ? documentType : "",
    });
    const record = {
      riskId: String(item?.riskId || item?.gapId || "").trim(),
      title: String(item?.title || item?.riskTitle || "Documented open risk").trim(),
      severity: ["high", "medium", "low"].includes(String(item?.severity || "").toLowerCase())
        ? String(item.severity).toLowerCase()
        : "low",
      relatedDocumentId: resolvedDoc?.id || relatedDocumentId,
      relatedDocument: resolvedDoc?.title || relatedDocument,
      documentType: resolvedDoc?.type || (documentType === "BRD" || documentType === "BDD" ? documentType : ""),
      evidence: Array.isArray(item?.evidence)
        ? item.evidence.filter(Boolean).map(String)
        : Array.isArray(item?.documentEvidence)
          ? item.documentEvidence.filter(Boolean).map(String)
          : [],
      explanation: String(item?.explanation || item?.description || "").trim(),
      recommendation: String(item?.recommendation || item?.recommendedFix || "").trim(),
    };
    const key = [
      normalizeGapToken(record.title),
      normalizeGapToken(record.relatedDocumentId || record.relatedDocument),
      record.evidence.map(normalizeGapToken).join("|"),
    ].join("::");
    if (!record.title || seen.has(key)) continue;
    seen.add(key);
    normalized.push(record);
  }
  return normalized;
}

function normalizeQualityNotes(value) {
  const filtered = [];
  const seen = new Set();
  for (const item of Array.isArray(value) ? value : []) {
    const text = String(item || "").trim();
    if (!text) continue;
    const key = normalizeGapToken(text);
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(text);
  }
  return filtered;
}

function computeGapReadiness({ findings, documentedOpenRisks, summary }) {
  const explicit = String(summary?.readiness || "").trim();
  if (/skipped/i.test(explicit)) return "Skipped by user";
  const high = findings.filter((item) => item.severity === "high").length;
  const medium = findings.filter((item) => item.severity === "medium").length;
  const low = findings.filter((item) => item.severity === "low").length;
  if (high) return "Blocked";
  if (medium) return "Needs Review";
  if (low) return "Partial";
  if (documentedOpenRisks.length) return "Ready With Known Risks";
  return "Ready";
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
  const storedPackage = packageUpload.packageMaterial || (packageUpload.blobUploadId ? await getPackageUploadBytes(packageUpload.blobUploadId) : null);
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
  requestTimeoutMs = Number(process.env.OPENAI_FILE_TOOL_REQUEST_TIMEOUT_MS || 120000),
  finalizationTimeoutMs = Number(process.env.OPENAI_FILE_TOOL_FINALIZATION_TIMEOUT_MS || 420000),
  pollIntervalMs = Number(process.env.OPENAI_FILE_TOOL_POLL_INTERVAL_MS || 3000),
  maxOutputTokens = Number(process.env.OPENAI_GAP_MAX_OUTPUT_TOKENS || 30000),
  model = process.env.OPENAI_MODEL || "gpt-4.1",
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for OpenAI file tools.");
  const effectiveTimeoutMs = Math.max(timeoutMs, 300000);
  const effectiveRequestTimeoutMs = Math.max(requestTimeoutMs, 120000);
  const effectiveFinalizationTimeoutMs = Math.max(finalizationTimeoutMs, 240000);
  const effectivePollIntervalMs = Math.max(pollIntervalMs, 1500);
  const createPayload = await postOpenAIResponse({
    apiKey,
    timeoutMs: effectiveRequestTimeoutMs,
    body: {
      model,
      background: true,
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
    },
  });
  const payload = await waitForOpenAIResponse({
    apiKey,
    initialPayload: createPayload,
    timeoutMs: effectiveTimeoutMs,
    pollIntervalMs: effectivePollIntervalMs,
  });
  let outputText = extractResponseText(payload);
  if (!String(outputText || "").trim() && payload?.id) {
    outputText = await requestFinalJsonFromResponse({
      apiKey,
      model,
      previousResponseId: payload.id,
      responseSchema,
      timeoutMs: effectiveFinalizationTimeoutMs,
      pollIntervalMs: effectivePollIntervalMs,
      maxOutputTokens,
    });
  }
  if (!String(outputText || "").trim()) {
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
      maxOutputTokens,
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

async function requestFinalJsonFromResponse({
  apiKey,
  model,
  previousResponseId,
  responseSchema,
  timeoutMs,
  pollIntervalMs,
  maxOutputTokens,
}) {
  const attempts = [
    {
      body: {
        model,
        background: true,
        previous_response_id: previousResponseId,
        input:
          "The prior tool run completed without a final assistant message. Using the analysis already performed in that response, return the final deliverable JSON only. Do not call tools again. Do not include markdown, prose, or code fences.",
        temperature: 0,
        max_output_tokens: maxOutputTokens,
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
      body: {
        model,
        background: false,
        previous_response_id: previousResponseId,
        instructions:
          "Return the final structured JSON using the already completed analysis from the previous response. Do not call tools again. Do not add prose or markdown.",
        input: "Return only the final JSON payload now.",
        temperature: 0,
        max_output_tokens: maxOutputTokens,
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
  maxOutputTokens,
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
    },
  });
  const payload = await waitForOpenAIResponse({
    apiKey,
    initialPayload: createPayload,
    timeoutMs,
    pollIntervalMs,
  });
  return extractResponseText(payload);
}

async function postOpenAIResponse({ apiKey, body, timeoutMs }) {
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
  return payload;
}

async function waitForOpenAIResponse({ apiKey, initialPayload, timeoutMs, pollIntervalMs }) {
  const startedAt = Date.now();
  let payload = initialPayload;

  while (Date.now() - startedAt < timeoutMs) {
    const status = String(payload?.status || "").toLowerCase();
    if (!status || status === "completed") {
      return payload;
    }
    if (status === "failed" || status === "cancelled" || status === "incomplete" || status === "expired") {
      throw new Error(`OpenAI file-tool did not complete successfully. ${summarizeResponsePayload(payload)}`);
    }
    if (!payload?.id) {
      throw new Error(`OpenAI file-tool returned no response id for polling. ${summarizeResponsePayload(payload)}`);
    }
    await sleep(pollIntervalMs);
    payload = await retrieveOpenAIResponseWithRetry({ apiKey, responseId: payload.id });
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
      return await retrieveOpenAIResponse({ apiKey, responseId });
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

function isGapAuditRetryEnabled() {
  return String(process.env.OPENAI_GAP_ENABLE_DEEP_RETRY || "false").toLowerCase() === "true";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        gapType: "missing_brd | missing_bdd | missing_in_code | unsupported_document_claim | weak_traceability | security | validation | integration | automation | risk",
        severity: "high | medium | low",
        confidence: "high | medium | low",
        title: "string",
        description: "string",
        sourceCapabilityId: "string",
        sourceCapability: "business capability name",
        targetDocumentType: "BRD | BDD | ''",
        targetDocumentTitle: "exact existing document title when applicable",
        relatedDocumentId: "string",
        relatedDocument: "string",
        linkStatus: "linked | unlinked | ambiguous",
        module: "business module",
        packageSignal: "short source evidence hint",
        sourceEvidence: ["file/class/method/endpoint/resource evidence"],
        documentEvidence: ["BRD/BDD section, FR/BR/GAP ID, feature/scenario title"],
        impact: "business impact",
        recommendedFix: "actionable regeneration/manual correction guidance",
        actionType: "regenerate_document | create_bdd",
        targetScenarioRefs: ["exact scenario titles to update or add"],
        evidenceAnchors: ["reviewer-friendly combined anchors"],
        missingScenarios: ["BDD scenario titles to add when applicable"],
      },
    ],
    documentedOpenRisks: [
      {
        riskId: "RISK-001",
        title: "documented risk or limitation title",
        severity: "high | medium | low",
        relatedDocumentId: "exact reviewed doc id",
        relatedDocument: "exact reviewed doc title",
        documentType: "BRD | BDD",
        evidence: ["risk section, GAP/RISK ID, feature/scenario title"],
        explanation: "why this is a documented open risk rather than a traceability finding",
        recommendation: "optional reviewer guidance",
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
    recommendations: ["at least one string"],
    qualityNotes: ["at least one string"],
  };
}

function traceabilityAuditResponseSchema() {
  const stringArray = { type: "array", items: { type: "string" } };
  return {
    name: "source_to_brd_bdd_traceability_audit",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "sourceInventory", "coverageMatrix", "findings", "documentedOpenRisks", "unsupportedClaims", "missingScenarios", "recommendations", "qualityNotes"],
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
            required: ["gapId", "gapType", "severity", "confidence", "title", "description", "sourceCapabilityId", "sourceCapability", "targetDocumentType", "targetDocumentTitle", "relatedDocumentId", "relatedDocument", "linkStatus", "module", "packageSignal", "sourceEvidence", "documentEvidence", "impact", "recommendedFix", "actionType", "targetScenarioRefs", "evidenceAnchors", "missingScenarios"],
            properties: {
              gapId: { type: "string" },
              gapType: { type: "string" },
              severity: { type: "string" },
              confidence: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              sourceCapabilityId: { type: "string" },
              sourceCapability: { type: "string" },
              targetDocumentType: { type: "string" },
              targetDocumentTitle: { type: "string" },
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
              targetScenarioRefs: stringArray,
              evidenceAnchors: stringArray,
              missingScenarios: stringArray,
            },
          },
        },
        documentedOpenRisks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["riskId", "title", "severity", "relatedDocumentId", "relatedDocument", "documentType", "evidence", "explanation", "recommendation"],
            properties: {
              riskId: { type: "string" },
              title: { type: "string" },
              severity: { type: "string" },
              relatedDocumentId: { type: "string" },
              relatedDocument: { type: "string" },
              documentType: { type: "string" },
              evidence: stringArray,
              explanation: { type: "string" },
              recommendation: { type: "string" },
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
        recommendations: { ...stringArray, minItems: 1 },
        qualityNotes: { ...stringArray, minItems: 1 },
      },
    },
  };
}
