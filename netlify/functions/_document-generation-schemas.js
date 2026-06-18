export function suiteResponseSchema() {
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

export function requiredSuiteShape() {
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

export function documentGenerationPlanSchema() {
  return {
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
  };
}
