export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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

export async function callOpenAI({ system, user, temperature = 0.2, timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 120000) }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4.1";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
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
        response_format: { type: "json_object" },
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
