export async function generateRequirementSuite({
  packageSignals,
  uploadedRequirements = [],
  gapResults = null,
  generationMode = 'initial',
  targetDocument = null,
  targetGap = null,
  jobTimeoutMs = 900000,
  onStatusUpdate = null,
}) {
  const jobId = createJobId();
  const response = await fetch('/.netlify/functions/generate-documents-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, packageSignals, uploadedRequirements, gapResults, generationMode, targetDocument, targetGap }),
  });
  if (!response.ok) {
    const payload = await readJsonResponse(response, 'Document generation');
    throw new Error(payload?.message || 'Document generation failed.');
  }
  const job = await waitForAiJob({
    type: 'generate-documents',
    jobId,
    timeoutMs: jobTimeoutMs,
    onStatusUpdate,
  });
  return normalizeGeneratedSuite(job.result || job.payload || job);
}

export async function runGapAnalysis({ packageSignals, documents, jobTimeoutMs = 900000, onStatusUpdate = null }) {
  const jobId = createJobId();
  const response = await fetch('/.netlify/functions/gap-analysis-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, packageSignals, documents }),
  });
  if (!response.ok) {
    const payload = await readJsonResponse(response, 'Gap analysis');
    throw new Error(payload?.message || 'Gap analysis failed.');
  }
  const job = await waitForAiJob({
    type: 'gap-analysis',
    jobId,
    timeoutMs: jobTimeoutMs,
    onStatusUpdate,
  });
  return job.result || job.payload || job;
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

function createJobId() {
  return globalThis.crypto?.randomUUID?.() || `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function waitForAiJob({ type, jobId, timeoutMs, onStatusUpdate }) {
  const startedAt = Date.now();
  let delayMs = 1200;
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`/.netlify/functions/ai-job-status?type=${encodeURIComponent(type)}&jobId=${encodeURIComponent(jobId)}`);
    const payload = await readJsonResponse(response, 'AI job status');
    if (response.status === 404) {
      await sleep(delayMs);
      delayMs = Math.min(Math.round(delayMs * 1.3), 5000);
      continue;
    }
    if (!response.ok) {
      throw new Error(payload?.message || 'AI job status lookup failed.');
    }

    onStatusUpdate?.(payload);

    if (payload.status === 'completed') return payload;
    if (payload.status === 'failed') {
      const trace = Array.isArray(payload.logs) && payload.logs.length
        ? ` Logs: ${payload.logs.map((log) => `[${log.stage || 'step'}] ${log.message}`).join(' | ')}`
        : '';
      throw new Error(`${payload.message || 'AI job failed.'}${trace}`);
    }

    await sleep(delayMs);
    delayMs = Math.min(Math.round(delayMs * 1.3), 5000);
  }
  throw new Error('AI job timed out while waiting for completion.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
