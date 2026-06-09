import { CORS_HEADERS, json, parseEventBody, compactSignals, callOpenAI } from "./_shared.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed." });

  try {
    const {
      packageSignals,
      uploadedRequirements = [],
      gapResults = null,
      generationMode = "initial",
      targetDocument = null,
      targetGap = null,
    } = parseEventBody(event);
    const signals = compactSignals(packageSignals);
    const aiPayload = await generateWithAI(signals, uploadedRequirements, gapResults, generationMode, targetDocument, targetGap);
    if (!aiPayload) {
      return json(502, {
        message: "AI document generation did not return a valid BRD/BDD suite. Please retry after confirming the OpenAI key and package input.",
      });
    }
    return json(200, aiPayload);
  } catch (error) {
    console.error("generate-documents failed", error);
    return json(500, { message: error.message || "Document generation failed." });
  }
};

async function generateWithAI(signals, uploadedRequirements, gapResults, generationMode, targetDocument, targetGap) {
  const system = [
    "ROLE: You are a principal Java solution architect, senior business analyst, and QA automation strategist with 15+ years of experience.",
    "MISSION: Generate production-grade BRD and BDD documents only from the supplied Java project source evidence. Do not invent features, roles, integrations, pages, APIs, validations, or business rules that are not supported by code, configuration, existing tests, or uploaded requirement files.",
    "SOURCE PRIORITY: First use uploaded BRD/BDD/requirement files when present, then controller/page/API entry points, service/business logic classes, entity/model/DTO validation rules, security/configuration files, existing tests, and build/config files.",
    "STRICT RULES: Do not create generic technical BDDs such as Entity Layer, Repository Layer, Controller Layer, Service Layer, Config, DTO, Model, Utility, or Application unless that name is explicitly a real user/business workflow in the source.",
    "Create BDDs only for real business capabilities or user/system workflows that are evidenced by source files.",
    "Every BRD requirement must cite source evidence using file path and class/method when available.",
    "Every BDD scenario must map to a business requirement or code-supported behavior.",
    "If source evidence is weak, mark it as an assumption or gap in qualityNotes instead of inventing behavior.",
    "Prefer fewer accurate documents over many generic documents.",
    "Write clear business language for reviewers and valid Gherkin for pipeline execution.",
    "For each BDD businessView include feature purpose, user goal, business outcome, validations, source evidence, and scenario summary in plain English.",
    "When regenerating a document, preserve the original document identity and improve only the relevant missing/weak coverage.",
    "When generating from unlinked gaps, create new BDD feature files only for those gaps and avoid duplicating existing BDD modules.",
    "Return JSON only with keys: brd, bddFiles, qualityNotes.",
  ].join(" ");
  const user = JSON.stringify({
    generationMode,
    instructions: {
      initial: "Create one BRD and 1-8 BDD files based only on real business capabilities discovered in sourceFiles and uploaded requirements. Use sourceFiles as mandatory evidence, not optional context.",
      regenerate_document: "Return only the improved target document type when possible. Keep the same module/title intent. Incorporate only the linked findings and relevant source evidence. Do not regenerate unrelated documents.",
      generate_from_unlinked_gaps: "Group unlinked findings by business capability and create focused BDD files for those uncovered capabilities only. Do not duplicate existing BDD modules.",
      brd: "Create one BRD with document control, project overview, actors/roles, in-scope capabilities, functional requirements, business rules, validations, non-functional expectations, assumptions, gaps, and acceptance criteria. Cite source path/class/method evidence wherever possible.",
      bddFiles: "Each BDD must have title, module, businessView, and gherkin. Scenarios must be specific, testable, and grounded in source evidence. Include happy path, negative/validation, boundary, not-found/conflict/security/integration scenarios only when supported by code evidence.",
      traceability: "For every BDD scenario, include source-backed language in the scenario title or comments when possible. Avoid scenarios that cannot be traced to supplied source files.",
    },
    requiredJsonShape: {
      brd: { id: "string", title: "string", module: "Application", content: "markdown string" },
      bddFiles: [{ id: "string", title: "string", module: "string", businessView: "string", gherkin: "valid Gherkin string" }],
      qualityNotes: ["source-grounding notes, assumptions, or gaps"],
    },
    packageSignals: signals,
    uploadedRequirements,
    gapResults,
    targetDocument,
    targetGap,
  });
  const result = await callOpenAI({ system, user, temperature: 0.15 });
  if (!isMeaningfulSuite(result)) return null;
  return normalizeSuite(result, "ai_generated");
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
    },
    bddFiles: bddFiles.map((doc, index) => ({
      id: doc.id || `bdd-${index + 1}`,
      title: doc.title || `BDD - Feature ${index + 1}`,
      module: doc.module || "Application",
      businessView: doc.businessView || doc.content || doc.description || "",
      gherkin: doc.gherkin || doc.content || doc.businessView || "",
    })),
    qualityNotes: payload.qualityNotes || [],
  };
}

function isMeaningfulSuite(payload) {
  const brdText = String(
    payload?.brd?.content ||
      payload?.brd?.businessView ||
      payload?.brd?.markdown ||
      payload?.brd?.body ||
      payload?.brd?.description ||
      ''
  ).trim();
  const bdds = Array.isArray(payload?.bddFiles) ? payload.bddFiles : [];
  if (!brdText || brdText.length < 120) return false;
  if (!bdds.length) return false;
  return bdds.some((doc) => String(doc?.gherkin || doc?.content || doc?.businessView || doc?.description || '').trim().length > 80);
}
