export const GAP_GROUP_ORDER = [
  "missing_bdd_unlinked",
  "missing_bdd_linked",
  "missing_brd",
  "missing_in_code",
  "unsupported_document_claim",
  "weak_traceability",
  "other",
];

export const GAP_GROUP_META = {
  missing_bdd_unlinked: {
    label: "Missing BDD Coverage",
    description: "Capabilities that need new BDD scenarios or feature files and are not safely owned by an existing BDD document.",
  },
  missing_bdd_linked: {
    label: "Existing BDD Needs Update",
    description: "Capabilities that map to an existing BDD document, but its scenarios need to be expanded or corrected.",
  },
  missing_brd: {
    label: "BRD Needs Update",
    description: "Business requirements coverage is missing or incomplete in the BRD documents.",
  },
  missing_in_code: {
    label: "Source Implementation Missing",
    description: "Reviewed requirement behavior is documented, but the uploaded source package does not support it.",
  },
  unsupported_document_claim: {
    label: "Document Claims Not Supported By Code",
    description: "The reviewed BRD or BDD describes behavior that the uploaded source code does not support.",
  },
  weak_traceability: {
    label: "Traceability Review Needed",
    description: "Evidence exists, but the mapping between source and documents is weak or ambiguous.",
  },
  other: {
    label: "Other Findings",
    description: "Additional findings that still need reviewer attention.",
  },
};

export function isCoveredGap(gap) {
  const status = String(gap?.status || gap?.coverageStatus || "").toLowerCase();
  return status === "covered" || status.includes("covered_after_regeneration");
}

export function normalizeGapText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeGapType(value) {
  const token = normalizeGapText(value).replace(/\s+/g, "_");
  if (!token) return "other";
  if (token === "missing_bdd") return "missing_bdd";
  if (token === "missing_brd") return "missing_brd";
  if (token === "missing_in_code") return "missing_in_code";
  if (token === "unsupported_document_claim") return "unsupported_document_claim";
  if (token === "weak_traceability") return "weak_traceability";
  if (token === "ambiguous_mapping") return "weak_traceability";
  if (["security", "validation", "integration", "automation", "risk"].includes(token)) return token;
  return token;
}

export function inferGapTargetDocumentType(gap) {
  const explicit = String(gap?.targetDocumentType || "").toUpperCase();
  if (explicit === "BRD" || explicit === "BDD") return explicit;
  const type = normalizeGapType(gap?.gapType);
  if (type === "missing_bdd") return "BDD";
  if (type === "missing_brd") return "BRD";
  return "";
}

export function getGapGroupKey(gap) {
  const type = normalizeGapType(gap?.gapType);
  if (type === "missing_bdd") {
    return String(gap?.linkStatus || "").toLowerCase() === "linked"
      ? "missing_bdd_linked"
      : "missing_bdd_unlinked";
  }
  if (type === "missing_brd") return "missing_brd";
  if (type === "missing_in_code") return "missing_in_code";
  if (type === "unsupported_document_claim") return "unsupported_document_claim";
  if (type === "weak_traceability") return "weak_traceability";
  return GAP_GROUP_META[type] ? type : "other";
}

export function getGapTypeLabel(gap) {
  const type = normalizeGapType(gap?.gapType);
  const labels = {
    missing_bdd: "Missing BDD coverage",
    missing_brd: "Missing BRD coverage",
    missing_in_code: "Missing implementation",
    unsupported_document_claim: "Unsupported document claim",
    weak_traceability: "Weak traceability",
    security: "Security review gap",
    validation: "Validation gap",
    integration: "Integration gap",
    automation: "Automation gap",
    risk: "Risk coverage gap",
  };
  return labels[type] || "Coverage finding";
}

export function getGapOwnershipLabel(gap) {
  const status = String(gap?.linkStatus || "").toLowerCase();
  if (status === "linked") {
    return gap?.relatedDocument
      ? `Linked to ${gap.relatedDocument}`
      : "Linked to an existing document";
  }
  if (status === "ambiguous") return "Ownership is ambiguous";
  return "Not linked to an existing document";
}

export function groupGapFindings(findings) {
  const buckets = new Map();
  for (const finding of Array.isArray(findings) ? findings : []) {
    const key = getGapGroupKey(finding);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: GAP_GROUP_META[key]?.label || "Other Findings",
        description: GAP_GROUP_META[key]?.description || "",
        items: [],
      });
    }
    buckets.get(key).items.push(finding);
  }
  return GAP_GROUP_ORDER
    .map((key) => buckets.get(key))
    .filter((bucket) => bucket && bucket.items.length > 0);
}

export function findMatchingDocumentsForGap(gap, documents) {
  if (isCoveredGap(gap)) return [];
  const linkStatus = String(gap?.linkStatus || "").toLowerCase();
  if (linkStatus === "unlinked" || linkStatus === "ambiguous") return [];

  const targetType = inferGapTargetDocumentType(gap);
  const candidates = targetType
    ? documents.filter((doc) => doc.type === targetType)
    : documents;
  if (!candidates.length) return [];

  const explicitIds = collectGapDocumentIds(gap);
  const byId = candidates.filter((doc) => explicitIds.has(String(doc.id || "").trim()));
  if (byId.length) return byId;

  const titleTokens = collectGapTitleTokens(gap);
  const exactTitleMatches = candidates.filter((doc) => {
    const docTitle = normalizeGapText(doc.title);
    return titleTokens.has(docTitle);
  });
  if (exactTitleMatches.length) return exactTitleMatches;

  if (targetType === "BDD") return [];
  if (targetType === "BRD" && normalizeGapType(gap?.gapType) === "missing_brd" && candidates.length === 1) {
    return candidates;
  }
  return [];
}

export function findFirstMatchingDocumentForGap(gap, documents) {
  return findMatchingDocumentsForGap(gap, documents)[0] || null;
}

function collectGapDocumentIds(gap) {
  const ids = new Set();
  const primaryId = String(gap?.relatedDocumentId || "").trim();
  if (primaryId) ids.add(primaryId);
  for (const value of Array.isArray(gap?.ownerDocumentIds) ? gap.ownerDocumentIds : []) {
    const token = String(value || "").trim();
    if (token) ids.add(token);
  }
  return ids;
}

function collectGapTitleTokens(gap) {
  const tokens = new Set();
  const values = [
    gap?.relatedDocument,
    gap?.targetDocumentTitle,
    ...(Array.isArray(gap?.documentEvidence) ? gap.documentEvidence : []),
  ];
  for (const value of values) {
    const normalized = normalizeGapText(value);
    if (normalized) tokens.add(normalized);
  }
  return tokens;
}
