import { connectLambda, getStore } from "@netlify/blobs";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

let aiJobStore = null;
let aiJobStoreFallback = new Map();

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
    topClasses,
    topFiles,
  };
}

export async function callOpenAI({
  system,
  user,
  temperature = 0.2,
  timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 120000),
  responseSchema = null,
  model = process.env.OPENAI_MODEL || "gpt-4.1",
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
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
  const existingLogs = Array.isArray(current?.logs) ? current.logs : [];
  const nextLogs = [
    ...existingLogs,
    {
      at: new Date().toISOString(),
      level: entry?.level || "info",
      stage: entry?.stage || "",
      message: String(entry?.message || ""),
      meta: entry?.meta || {},
    },
  ].slice(-50);
  return await upsertAiJob(type, jobId, {
    ...(current || {}),
    logs: nextLogs,
  });
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
