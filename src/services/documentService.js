export async function generateRequirementSuite({
  packageSignals,
  uploadedRequirements = [],
  gapResults = null,
  generationMode = 'initial',
  targetDocument = null,
  targetGap = null,
}) {
  const response = await fetch('/.netlify/functions/generate-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageSignals, uploadedRequirements, gapResults, generationMode, targetDocument, targetGap }),
  });
  const payload = await readJsonResponse(response, 'Document generation');
  if (!response.ok) {
    throw new Error(payload?.message || 'Document generation failed.');
  }
  return normalizeGeneratedSuite(payload);
}

export async function runGapAnalysis({ packageSignals, documents }) {
  const response = await fetch('/.netlify/functions/gap-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageSignals, documents }),
  });
  const payload = await readJsonResponse(response, 'Gap analysis');
  if (!response.ok) {
    throw new Error(payload?.message || 'Gap analysis failed.');
  }
  return payload;
}

export function normalizeGeneratedSuite(payload) {
  const brd = payload?.brd || {};
  const bdds = Array.isArray(payload?.bddFiles) ? payload.bddFiles : [];
  const now = new Date().toISOString();
  return [
    {
      id: brd.id || 'brd-application-overview',
      title: brd.title || 'BRD - Application Overview',
      type: 'BRD',
      module: brd.module || 'Application',
      status: 'review',
      approved: false,
      source: payload.source || 'ai_generated',
      content: brd.content || brd.businessView || brd.markdown || brd.body || brd.description || '',
      gherkinContent: '',
      lastEdited: now,
    },
    ...bdds.map((doc, index) => ({
      id: doc.id || `bdd-${index + 1}`,
      title: doc.title || `BDD - Feature ${index + 1}`,
      type: 'BDD',
      module: doc.module || 'Application',
      status: 'review',
      approved: false,
      source: payload.source || 'ai_generated',
      content: doc.businessView || doc.content || doc.description || '',
      gherkinContent: doc.gherkin || doc.content || doc.businessView || '',
      lastEdited: now,
    })),
  ];
}

export function buildBddUploadFiles(documents) {
  return documents
    .filter((doc) => doc.type === 'BDD')
    .map((doc, index) => ({
      name: `${slugify(doc.module || doc.title || `bdd-${index + 1}`)}.feature`,
      content: doc.gherkinContent || doc.content || '',
    }));
}

export function buildBrdUploadFile(documents) {
  const brd = documents.find((doc) => doc.type === 'BRD');
  if (!brd) return null;
  return {
    name: `${slugify(brd.title || 'application-brd')}.md`,
    content: brd.content || '',
  };
}

export function slugify(value) {
  return String(value || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'document';
}

async function readJsonResponse(response, label) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (_) {
    const compact = text
      .replace(/\s+/g, ' ')
      .slice(0, 180);
    throw new Error(`${label} endpoint returned ${response.status} ${response.statusText || ''}: ${compact || 'No response body'}`);
  }
}
