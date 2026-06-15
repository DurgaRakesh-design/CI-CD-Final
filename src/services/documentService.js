import { safeFileName } from './encoding';

const PACKAGE_CHUNK_BYTES = 768 * 1024;
const inFlightRequirementSuites = new Map();

export async function generateRequirementSuite({
  packageSignals,
  packageFile = null,
  uploadedRequirements = [],
  gapResults = null,
  generationMode = 'initial',
  targetDocument = null,
  targetGap = null,
  jobTimeoutMs = 900000,
  onStatusUpdate = null,
}) {
  const requestKey = buildGenerationRequestKey({ packageSignals, packageFile, uploadedRequirements, gapResults, generationMode, targetDocument, targetGap });
  if (requestKey && inFlightRequirementSuites.has(requestKey)) {
    return inFlightRequirementSuites.get(requestKey);
  }

  const promise = generateRequirementSuiteRequest({
    packageSignals,
    packageFile,
    uploadedRequirements,
    gapResults,
    generationMode,
    targetDocument,
    targetGap,
    jobTimeoutMs,
    onStatusUpdate,
  });

  if (!requestKey) return promise;
  inFlightRequirementSuites.set(requestKey, promise);
  try {
    return await promise;
  } finally {
    inFlightRequirementSuites.delete(requestKey);
  }
}

async function generateRequirementSuiteRequest({
  packageSignals,
  packageFile = null,
  uploadedRequirements = [],
  gapResults = null,
  generationMode = 'initial',
  targetDocument = null,
  targetGap = null,
  jobTimeoutMs = 900000,
  onStatusUpdate = null,
}) {
  const jobId = createJobId();
  const packageUpload = packageFile && generationMode === 'initial'
    ? await uploadPackageForAi({ jobId, packageFile, packageSignals, onStatusUpdate })
    : null;
  const response = await fetch('/.netlify/functions/generate-documents-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, packageSignals, packageUpload, uploadedRequirements, gapResults, generationMode, targetDocument, targetGap }),
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

function buildGenerationRequestKey({ packageSignals, packageFile, uploadedRequirements, gapResults, generationMode, targetDocument, targetGap }) {
  if (generationMode !== 'initial' || !packageFile) return '';
  return JSON.stringify({
    mode: generationMode,
    fileName: packageFile.name || packageSignals?.fileName || '',
    fileSize: packageFile.size || 0,
    fileModified: packageFile.lastModified || 0,
    projectName: packageSignals?.projectName || '',
    uploadedRequirementCount: uploadedRequirements?.length || 0,
    hasGapResults: Boolean(gapResults),
    targetDocumentId: targetDocument?.id || '',
    targetGapId: targetGap?.id || '',
  });
}

async function uploadPackageForAi({ jobId, packageFile, packageSignals, onStatusUpdate }) {
  const uploadId = `${jobId}-${Date.now()}`;
  const name = safeFileName(packageFile.name || packageSignals?.fileName || 'source-package.zip');
  const type = packageFile.type || 'application/zip';
  const buffer = await packageFile.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const total = Math.max(1, Math.ceil(bytes.length / PACKAGE_CHUNK_BYTES));

  for (let index = 0; index < total; index += 1) {
    const start = index * PACKAGE_CHUNK_BYTES;
    const end = Math.min(start + PACKAGE_CHUNK_BYTES, bytes.length);
    const contentBase64 = bytesToBase64(bytes.slice(start, end));
    onStatusUpdate?.({
      status: 'running',
      stage: 'package-upload',
      progress: Math.min(8, Math.round(((index + 1) / total) * 8)),
      message: `Uploading source package chunk ${index + 1} of ${total}.`,
    });
    const response = await fetch('/.netlify/functions/ai-package-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'chunk', uploadId, name, type, size: packageFile.size || bytes.length, index, total, contentBase64 }),
    });
    if (!response.ok) {
      const payload = await readJsonResponse(response, 'Package upload');
      throw new Error(payload?.message || 'Package upload failed.');
    }
  }

  const response = await fetch('/.netlify/functions/ai-package-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'complete', uploadId, name, type, size: packageFile.size || bytes.length, chunkCount: total }),
  });
  if (!response.ok) {
    const payload = await readJsonResponse(response, 'Package upload');
    throw new Error(payload?.message || 'Package upload failed.');
  }
  const payload = await readJsonResponse(response, 'Package upload');
  return payload.packageUpload || {
    name,
    type,
    size: packageFile.size || bytes.length,
    blobUploadId: uploadId,
    chunkCount: total,
  };
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export async function runGapAnalysis({ packageSignals, documents, packageFile = null, jobTimeoutMs = 900000, onStatusUpdate = null }) {
  const jobId = createJobId();
  const packageUpload = packageFile
    ? await uploadPackageForAi({ jobId, packageFile, packageSignals, onStatusUpdate })
    : null;
  const response = await fetch('/.netlify/functions/gap-analysis-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, packageSignals, packageUpload, documents }),
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
      evidenceAnchors: Array.isArray(brd.evidenceAnchors) ? brd.evidenceAnchors : [],
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
      evidenceAnchors: Array.isArray(doc.evidenceAnchors) ? doc.evidenceAnchors : [],
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
