const { CORS_HEADERS, json, parseEventBody, compactSignals, callOpenAI, slugify, titleCase } = require("./_shared");

exports.handler = async (event) => {
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
    const aiPayload = await generateWithAI(signals, uploadedRequirements, gapResults, generationMode, targetDocument, targetGap).catch((error) => {
    console.warn("generate-documents: AI unavailable, using deterministic fallback", error.message);
    return null;
  });
    return json(200, aiPayload || deterministicSuite(signals, gapResults, generationMode, targetDocument, targetGap));
  } catch (error) {
    console.error("generate-documents failed", error);
    return json(500, { message: error.message || "Document generation failed." });
  }
};

async function generateWithAI(signals, uploadedRequirements, gapResults, generationMode, targetDocument, targetGap) {
  const system = [
    "You are a senior Business Analyst and QA architect.",
    "Generate production-grade BRD and BDD documents for a Java application.",
    "Use only the provided package signals and uploaded requirement notes.",
    "BDD must be valid Gherkin and split into feature files by real business capabilities only.",
    "Never create BDDs for generic technical layers such as Entity Layer, Controller Layer, Repository Layer, Service Layer, Config, or Application unless they represent a real user/business workflow.",
    "Cover behavior that can be inferred from class names, endpoints, validation annotations, domain entities, and package/module names. Do not invent unrelated products.",
    "Write a substantial businessView for each BDD: include feature purpose, user goal, business outcome, validations, and a short scenario summary in plain English.",
    "When regenerating a document, preserve the original document identity and improve only the relevant missing/weak coverage.",
    "When generating from unlinked gaps, create new BDD feature files only for those gaps and avoid duplicating existing BDD modules.",
    "Return JSON only with keys: brd, bddFiles, qualityNotes.",
  ].join(" ");
  const user = JSON.stringify({
    generationMode,
    instructions: {
      initial: "For initial generation, create one BRD and 1-8 BDD files based only on real business capabilities detected in the package.",
      regenerate_document: "For regenerate_document, return only the improved target document type when possible. Keep the same module/title intent and incorporate the supplied linked findings.",
      generate_from_gap: "For generate_from_gap, create one focused BDD for the selected unlinked gap.",
      generate_from_unlinked_gaps: "For generate_from_unlinked_gaps, group gaps by business capability and create focused BDD files for each group.",
      brd: "Create one BRD with overview, actors, in-scope capabilities, business rules, validations, non-functional expectations, assumptions, and acceptance criteria.",
      bddFiles: "Each BDD must have title, module, businessView, and gherkin. Scenarios must be specific, testable, and grounded in classes/endpoints/methods.",
      traceability: "Each BDD scenario should align with a detected module/class/endpoint when possible.",
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

function deterministicSuite(signals, gapResults = null, generationMode = "initial", targetDocument = null, targetGap = null) {
  const project = signals.projectName || "Java Application";
  const modules = chooseModules(signals, gapResults, generationMode, targetDocument, targetGap);
  const brdContent = [
    `# Business Requirements Document`,
    `## ${project}`,
    ``,
    `### 1. Purpose`,
    `This BRD defines the expected business behavior, user-facing capabilities, validations, and acceptance criteria for ${project}. It is generated from the uploaded package structure and is intended for review before automated QA execution.`,
    ``,
    `### 2. Application Scope`,
    `The application is detected as ${signals.platform || "Java"} using ${signals.buildTool || "an unknown build tool"}. The scan found ${signals.sourceFileCount || 0} Java source files and ${signals.testFileCount || 0} existing automated test files.`,
    ``,
    `### 3. Functional Capabilities`,
    ...modules.map((module, index) => `${index + 1}. ${module}: The system shall support the core workflows, validations, and outcomes represented by the detected ${module.toLowerCase()} code area.`),
    ``,
    `### 4. Business Rules`,
    `- Inputs must be validated before business actions are completed.`,
    `- Successful operations must return a clear, consistent result to the caller or user interface.`,
    `- Invalid or unsupported operations must produce a controlled error outcome instead of an unhandled failure.`,
    `- Data-changing operations must preserve application consistency and be testable through automated evidence.`,
    ``,
    `### 5. Acceptance Criteria`,
    `- Each in-scope capability has at least one BDD scenario.`,
    `- Positive, negative, and boundary cases are represented where the code signals support them.`,
    `- Approved BDD feature files can be consumed by the CI pipeline as Gherkin input.`,
  ].join("\n");

  return normalizeSuite({
    brd: {
      id: "brd-application-overview",
      title: `BRD - ${project}`,
      module: "Application",
      content: brdContent,
    },
    bddFiles: modules.map((module) => buildFeature(signals, module, gapResults)),
    qualityNotes: ["Generated from package scan fallback. Review before triggering the pipeline."],
  }, "generated_fallback");
}

function buildFeature(signals, module, gapResults = null) {
  const project = signals.projectName || "Java Application";
  const relatedClasses = (signals.classes || []).filter((item) => {
    const haystack = `${item.className} ${(item.annotations || []).join(" ")} ${(item.packageName || "")}`.toLowerCase();
    return haystack.includes(module.toLowerCase().split(" ")[0]) || module.includes("Layer");
  }).slice(0, 4);
  const classHint = relatedClasses[0]?.className || `${module.replace(/\s+/g, "")}Component`;
  const endpoints = relatedClasses.flatMap((item) => item.endpoints || []).slice(0, 3);
  const endpointLine = endpoints[0]?.path ? ` through endpoint "${endpoints[0].path}"` : "";
  const moduleGaps = Array.isArray(gapResults?.findings)
    ? gapResults.findings.filter((gap) => {
        const related = String(gap?.relatedDocument || gap?.module || '').toLowerCase();
        return related.includes(module.toLowerCase().split(" ")[0]);
      })
    : [];
  const title = `BDD - ${module}`;
  const gapText = moduleGaps.length
    ? moduleGaps.map((gap) => `- Gap: ${gap.title}. Fix: ${gap.recommendedFix || gap.description || 'Review and close the gap.'}`).join("\n")
    : `- No active gap findings were passed for this module.`;
  const gherkin = [
    `Feature: ${module}`,
    `  As a QA reviewer`,
    `  I want ${project} ${module.toLowerCase()} behavior to be validated`,
    `  So that release evidence is linked to approved business requirements`,
    ``,
    `  Scenario: Successful ${module.toLowerCase()} operation`,
    `    Given the ${classHint} capability is available${endpointLine}`,
    `    When a valid request is processed`,
    `    Then the operation should complete successfully`,
    `    And the returned result should match the expected business outcome`,
    ``,
    `  Scenario: Invalid ${module.toLowerCase()} input is rejected safely`,
    `    Given the ${classHint} capability receives invalid or incomplete input`,
    `    When the operation is executed`,
    `    Then the system should reject the request with a controlled validation outcome`,
    `    And no inconsistent application state should be created`,
  ].join("\n");
  return {
    id: `bdd-${slugify(module)}`,
    title,
    module,
    businessView: [
      `Module overview: ${module} validates the business flow for ${project}.`,
      `Primary responsibility: confirm the module responds correctly to expected, invalid, and boundary inputs.`,
      `Traceability: scenarios are grounded in ${classHint}${endpointLine ? ` and ${endpoints[0].path}` : ''}.`,
      `Business focus: keep outcomes understandable for reviewers while remaining executable for automation.`,
      `Gap context:`,
      gapText,
    ].join("\n"),
    gherkin,
  };
}

function chooseModules(signals, gapResults = null, generationMode = "initial", targetDocument = null, targetGap = null) {
  if (generationMode === "regenerate_document" && targetDocument?.module) return [targetDocument.module];
  if (generationMode === "generate_from_gap" && targetGap?.module) return [targetGap.module];
  if (generationMode === "generate_from_unlinked_gaps") {
    const gapModules = [...new Set((gapResults?.findings || []).map((gap) => gap.module).filter(Boolean))]
      .filter((module) => !isTechnicalModule(module));
    if (gapModules.length) return gapModules.slice(0, 8);
  }
  const modules = [...new Set([...(signals.modules || [])])].filter(Boolean).filter((module) => !isTechnicalModule(module));
  if (modules.length) return modules.slice(0, 6);
  const domainNames = [...new Set((signals.classes || [])
    .filter((item) => !(item.annotations || []).some((annotation) => ["controller", "repository", "configuration"].includes(String(annotation).toLowerCase())))
    .map((item) => titleCase(String(item.className || '').replace(/(Service|Controller|Repository|Entity|Config|Configuration)$/i, '')))
    .filter((name) => name && !isTechnicalModule(name)))];
  if (domainNames.length) return domainNames.slice(0, 6);
  return ["Core Business Operations"];
}

function isTechnicalModule(module) {
  return /^(entity|controller|repository|service|config|configuration|application|dto|model|mapper|util|utility)\b/i.test(String(module || '').trim())
    || /\b(layer|package|class|component)$/i.test(String(module || '').trim());
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
