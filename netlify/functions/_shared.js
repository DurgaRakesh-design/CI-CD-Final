import { connectLambda, getStore } from "@netlify/blobs";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

let aiJobStore = null;
let aiJobStoreFallback = new Map();
let packageUploadStore = null;
let packageUploadFallback = new Map();

function getAiJobStore() {
  if (aiJobStore !== null) return aiJobStore;
  try {
    aiJobStore = getStore({ name: "ai-jobs" });
  } catch (error) {
    if (isNetlifyRuntime()) {
      throw error;
    }
    aiJobStore = null;
  }
  return aiJobStore;
}

function isNetlifyRuntime() {
  return process.env.NETLIFY === "true" || Boolean(process.env.SITE_ID);
}

export function connectBlobsFromEvent(event) {
  try {
    if (event) connectLambda(event);
  } catch (error) {
    // If the runtime already provides blob context, continue without failing.
  }
}

export function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

export function parseEventBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw || "{}");
}

export function compactSignals(packageSignals = {}) {
  return {
    projectName: packageSignals.projectName,
    fileName: packageSignals.fileName,
    platform: packageSignals.platform,
    buildTool: packageSignals.buildTool,
    hasSpringBoot: packageSignals.hasSpringBoot,
    sourceFileCount: packageSignals.sourceFileCount,
    testFileCount: packageSignals.testFileCount,
    bddFileCount: packageSignals.bddFileCount,
    modules: (packageSignals.modules || []).slice(0, 20),
    endpoints: (packageSignals.endpoints || []).slice(0, 60),
    validationSignals: (packageSignals.validationSignals || []).slice(0, 60),
    securitySignals: (packageSignals.securitySignals || []).slice(0, 40),
    featureSignals: (packageSignals.featureSignals || []).slice(0, 20),
    capabilityHints: (packageSignals.capabilityHints || []).slice(0, 20),
    evidenceHighlights: (packageSignals.evidenceHighlights || []).slice(0, 20),
    summary: packageSignals.summary || {},
    classes: (packageSignals.classes || []).slice(0, 80).map((item) => ({
      className: item.className,
      packageName: item.packageName,
      annotations: item.annotations,
      methods: (item.methods || []).slice(0, 14),
      endpoints: item.endpoints || [],
    })),
    sourceFiles: (packageSignals.sourceFiles || []).slice(0, 40).map((item) => ({
      path: item.path,
      type: item.type,
      truncated: Boolean(item.truncated),
      charCount: item.charCount,
      content: String(item.content || '').slice(0, 5500),
    })),
  };
}

export function buildEvidenceDigest(signals = {}) {
  const topClasses = (signals.classes || []).slice(0, 12).map((item) => {
    const annotations = Array.isArray(item.annotations) && item.annotations.length ? ` [${item.annotations.slice(0, 4).join(", ")}]` : "";
    const packageName = item.packageName ? ` (${item.packageName})` : "";
    return `${item.className || "UnknownClass"}${packageName}${annotations}`;
  });
  const topFiles = (signals.sourceFiles || []).slice(0, 12).map((item) => {
    const type = item.type ? ` [${item.type}]` : "";
    const truncated = item.truncated ? " (truncated)" : "";
    return `${item.path || "unknown-path"}${type}${truncated}`;
  });
  return {
    projectName: signals.projectName || "",
    platform: signals.platform || "",
    buildTool: signals.buildTool || "",
    hasSpringBoot: Boolean(signals.hasSpringBoot),
    sourceFileCount: signals.sourceFileCount || 0,
    testFileCount: signals.testFileCount || 0,
    bddFileCount: signals.bddFileCount || 0,
    modules: (signals.modules || []).slice(0, 12),
    endpoints: (signals.endpoints || []).slice(0, 18),
    validationSignals: (signals.validationSignals || []).slice(0, 18),
    securitySignals: (signals.securitySignals || []).slice(0, 12),
    capabilityHints: (signals.capabilityHints || []).slice(0, 18),
    evidenceHighlights: (signals.evidenceHighlights || []).slice(0, 12),
    topClasses,
    topFiles,
    summary: signals.summary || {},
  };
}

function getPackageUploadStore() {
  if (packageUploadStore !== null) return packageUploadStore;
  try {
    packageUploadStore = getStore({ name: "ai-package-uploads" });
  } catch (error) {
    if (isNetlifyRuntime()) {
      throw error;
    }
    packageUploadStore = null;
  }
  return packageUploadStore;
}

export async function callOpenAI({
  system,
  user,
  temperature = 0.2,
  timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 120000),
  responseSchema = null,
  model = process.env.OPENAI_MODEL,
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!model) {
    throw new Error("No OpenAI model configured. Set OPENAI_MODEL.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    const responseFormat = responseSchema
      ? {
          type: "json_schema",
          json_schema: {
            name: responseSchema.name || "ai_response",
            strict: true,
            schema: responseSchema.schema,
          },
        }
      : { type: "json_object" };
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        response_format: responseFormat,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`OpenAI request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`OpenAI returned a non-JSON response: ${raw.slice(0, 180)}`);
  }
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI request failed with ${response.status}`);
  }
  const content = payload?.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`OpenAI returned invalid JSON content: ${content.slice(0, 180)}`);
  }
}

export function jobKey(type, jobId) {
  return `${type}:${jobId}`;
}

export async function upsertAiJob(type, jobId, data) {
  const now = new Date().toISOString();
  const payload = {
    type,
    jobId,
    updatedAt: now,
    ...data,
  };
  if (!payload.createdAt) payload.createdAt = now;
  const store = getAiJobStore();
  if (store) {
    await store.setJSON(jobKey(type, jobId), payload);
  } else {
    aiJobStoreFallback.set(jobKey(type, jobId), payload);
  }
  return payload;
}

export async function getAiJob(type, jobId) {
  const store = getAiJobStore();
  if (store) {
    return await store.get(jobKey(type, jobId), { type: "json" });
  }
  return aiJobStoreFallback.get(jobKey(type, jobId)) || null;
}

export async function appendAiJobLog(type, jobId, entry) {
  const current = await getAiJob(type, jobId);
  const normalizedEntry = {
    at: new Date().toISOString(),
    level: entry?.level || "info",
    stage: entry?.stage || "",
    message: String(entry?.message || ""),
    meta: entry?.meta || {},
  };
  const existingLogs = Array.isArray(current?.logs) ? current.logs : [];
  const nextLogs = [
    ...existingLogs,
    normalizedEntry,
  ].slice(-50);
  const logLabel = `[ai-job:${type}:${jobId}] [${normalizedEntry.level}] [${normalizedEntry.stage || "step"}] ${normalizedEntry.message}`;
  if (normalizedEntry.level === "error") {
    console.error(logLabel, normalizedEntry.meta);
  } else if (normalizedEntry.level === "warn") {
    console.warn(logLabel, normalizedEntry.meta);
  } else {
    console.info(logLabel, normalizedEntry.meta);
  }
  return await upsertAiJob(type, jobId, {
    ...(current || {}),
    logs: nextLogs,
  });
}

export async function setPackageUploadChunk(uploadId, index, bytes) {
  const key = packageChunkKey(uploadId, index);
  const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const store = getPackageUploadStore();
  if (store) {
    await store.set(key, payload);
  } else {
    packageUploadFallback.set(key, payload);
  }
}

export async function setPackageUploadManifest(uploadId, manifest) {
  const current = await getPackageUploadManifest(uploadId);
  const payload = {
    ...(current || {}),
    uploadId,
    ...manifest,
  };
  const store = getPackageUploadStore();
  if (store) {
    await store.setJSON(packageManifestKey(uploadId), payload);
  } else {
    packageUploadFallback.set(packageManifestKey(uploadId), payload);
  }
  return payload;
}

export async function getPackageUploadBytes(uploadId) {
  const manifest = await getPackageUploadManifest(uploadId);
  if (!manifest) throw new Error("Uploaded package reference was not found.");

  const chunkBuffers = [];
  const total = Number(manifest.chunkCount || manifest.total || 0);
  if (!total) throw new Error("Uploaded package reference has no chunks.");

  for (let index = 0; index < total; index += 1) {
    const chunk = await getPackageUploadChunkWithRetry(uploadId, index);
    if (!chunk) throw new Error(`Uploaded package chunk ${index + 1} of ${total} was not found.`);
    chunkBuffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const bytes = Buffer.concat(chunkBuffers);
  if (manifest.size && bytes.length !== Number(manifest.size)) {
    throw new Error(`Uploaded package size mismatch. Expected ${manifest.size} bytes but found ${bytes.length}.`);
  }
  return {
    bytes,
    name: manifest.name || "source-package.zip",
    type: manifest.type || "application/zip",
    size: bytes.length,
  };
}

export async function countPackageUploadChunks(uploadId) {
  const prefix = `${safeBlobSegment(uploadId)}/chunks/`;
  const store = getPackageUploadStore();
  if (store) {
    const { blobs } = await store.list({ prefix });
    return blobs.length;
  }
  let count = 0;
  for (const key of packageUploadFallback.keys()) {
    if (String(key).startsWith(prefix)) count += 1;
  }
  return count;
}

async function getPackageUploadManifest(uploadId) {
  const key = packageManifestKey(uploadId);
  const store = getPackageUploadStore();
  if (store) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const manifest = await store.get(key, { type: "json" });
      if (manifest) return manifest;
      await sleep(300 * (attempt + 1));
    }
    return null;
  }
  return packageUploadFallback.get(key) || null;
}

async function getPackageUploadChunkWithRetry(uploadId, index) {
  const key = packageChunkKey(uploadId, index);
  const store = getPackageUploadStore();
  if (store) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const chunk = await store.get(key, { type: "arrayBuffer" });
      if (chunk) return chunk;
      await sleep(300 * (attempt + 1));
    }
    return null;
  }
  return packageUploadFallback.get(key) || null;
}

function packageManifestKey(uploadId) {
  return `${safeBlobSegment(uploadId)}/manifest.json`;
}

function packageChunkKey(uploadId, index) {
  return `${safeBlobSegment(uploadId)}/chunks/${String(index).padStart(5, "0")}.b64`;
}

function safeBlobSegment(value) {
  return String(value || "upload").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "upload";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function slugify(value) {
  return String(value || "document")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "document";
}

export function titleCase(value) {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
