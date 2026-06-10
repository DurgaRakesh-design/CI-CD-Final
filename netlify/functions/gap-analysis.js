import { CORS_HEADERS, json, parseEventBody, compactSignals, callOpenAI } from "./_shared.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed." });

  try {
    const { packageSignals, documents = [] } = parseEventBody(event);
    const signals = compactSignals(packageSignals);
    const aiPayload = await analyzeWithAI(signals, documents);
    if (!aiPayload) {
      return json(502, {
        message: "AI gap analysis did not return a valid response. Please retry after confirming the OpenAI key and package input.",
      });
    }
    return json(200, aiPayload);
  } catch (error) {
    console.error("gap-analysis failed", error);
    return json(500, { message: error.message || "Gap analysis failed." });
  }
};

async function analyzeWithAI(signals, documents) {
  const system = [
    "ROLE: You are a senior QA governance reviewer, BA traceability auditor, and Java source-code reviewer.",
    "MISSION: Compare reviewed BRD/BDD documents against the supplied Java source-code evidence. Identify missing, weak, unsupported, duplicated, or not traceable requirement coverage.",
    "Use sourceFiles as mandatory evidence. Do not judge against imagined requirements or generic Java architecture expectations.",
    "Findings must be based on concrete source evidence such as controllers/endpoints, service methods, entities/DTO validations, security/config, tests, or uploaded requirement files.",
    "If a finding belongs to an existing BRD or BDD document, mark it linked and provide relatedDocumentId.",
    "If a source-supported behavior has no clear BRD/BDD owner, mark it unlinked and actionType=create_bdd.",
    "Use business capability names, not technical layer names.",
    "Keep findings actionable, concise, and suitable for a BA/QA reviewer.",
    "Return JSON only with keys: summary, findings, recommendations.",
  ].join(" ");
  const user = JSON.stringify({
    expectedOutput: {
      summary: "Object with totalFindings, high, medium, low, readiness.",
      findings: "Array of {severity,title,description,relatedDocumentId,relatedDocument,linkStatus,module,packageSignal,impact,recommendedFix,actionType}.",
      recommendations: "Array of concise business-readable next steps.",
    },
    rules: [
      "If a finding clearly belongs to an existing BRD or BDD, set linkStatus='linked', relatedDocumentId to that document id when available, and actionType='regenerate_document'.",
      "If a finding represents a missing capability with no existing BRD/BDD owner, set linkStatus='unlinked' and actionType='create_bdd'.",
      "Do not use generic relatedDocument values such as 'BRD/BDD' when a specific document cannot be identified. Leave it empty and mark unlinked.",
      "Use business capability names, not technical layer names, for modules.",
      "Do not report a gap unless you can point to source evidence or an uploaded requirement.",
      "If a document includes behavior unsupported by source evidence, report it as unsupported coverage.",
      "If source evidence is too weak to decide, make a low-severity review recommendation instead of a high-confidence gap.",
    ],
    packageSignals: signals,
    documents: documents.map((doc) => ({
      title: doc.title,
      id: doc.id,
      type: doc.type,
      module: doc.module,
      content: doc.type === "BDD" ? doc.gherkinContent || doc.content : doc.content,
    })),
  });
  const result = await callOpenAI({ system, user, temperature: 0.1 });
  if (!result || !Array.isArray(result.findings)) return null;
  return normalizeGapPayload(result);
}

function normalizeGapPayload(payload) {
  const findings = payload.findings.map((item) => ({
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
    recommendations: payload.recommendations || [],
  };
}
