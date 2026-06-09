const API_HOST = "api.github.com";
const API_VERSION = "2022-11-28";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function json(statusCode, payload) {
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

function isTextLike(contentType) {
  const value = String(contentType || "").toLowerCase();
  return (
    value.includes("application/json") ||
    value.includes("application/problem+json") ||
    value.startsWith("text/") ||
    value.includes("application/xml") ||
    value.includes("application/javascript") ||
    value.includes("application/x-www-form-urlencoded")
  );
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }

    const token = process.env.GITHUB_PAT;
    if (!token) {
      return json(500, {
        message: "Netlify function is missing GITHUB_PAT. Add it in Netlify environment variables.",
      });
    }

    const rawTarget = event.queryStringParameters?.target || "";
    if (!rawTarget) return json(400, { message: "Missing target query parameter." });

    let target;
    try {
      target = new URL(rawTarget);
    } catch (error) {
      return json(400, { message: `Invalid target URL: ${error.message}` });
    }

    if (target.protocol !== "https:" || target.hostname !== API_HOST) {
      return json(400, { message: "Only https://api.github.com targets are allowed." });
    }

    const owner = String(process.env.GITHUB_OWNER || "").trim();
    const repo = String(process.env.GITHUB_REPO || "").trim();
    if (owner && repo) {
      const repoPrefix = `/repos/${owner}/${repo}/`;
      if (!target.pathname.startsWith(repoPrefix)) {
        return json(403, {
          message: `Proxy is restricted to ${owner}/${repo}. Requested path is not allowed.`,
        });
      }
    }

    const incomingHeaders = event.headers || {};
    const acceptHeader = incomingHeaders.accept || incomingHeaders.Accept || "application/vnd.github+json";
    const contentTypeHeader = incomingHeaders["content-type"] || incomingHeaders["Content-Type"];
    const requestHeaders = new Headers();
    requestHeaders.set("Authorization", `Bearer ${token}`);
    requestHeaders.set("Accept", acceptHeader);
    requestHeaders.set("X-GitHub-Api-Version", API_VERSION);
    requestHeaders.set("User-Agent", "netlify-github-proxy");
    if (contentTypeHeader) requestHeaders.set("Content-Type", contentTypeHeader);

    const init = {
      method: event.httpMethod || "GET",
      headers: requestHeaders,
      redirect: "follow",
    };

    if (!["GET", "HEAD"].includes(init.method.toUpperCase()) && event.body != null) {
      init.body = event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body;
    }

    const response = await fetch(target.toString(), init);
    console.log("github-proxy: GitHub response", {
      method: init.method,
      target: target.pathname,
      status: response.status,
      contentType: response.headers.get("content-type") || "",
    });

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const headers = { ...CORS_HEADERS, "Content-Type": contentType, "Cache-Control": "no-store" };
    const disposition = response.headers.get("content-disposition");
    if (disposition) headers["Content-Disposition"] = disposition;

    if (response.status === 204) return { statusCode: 204, headers, body: "" };

    if (isTextLike(contentType)) {
      return { statusCode: response.status, headers, body: await response.text() };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return { statusCode: response.status, headers, isBase64Encoded: true, body: buffer.toString("base64") };
  } catch (error) {
    console.error("github-proxy: unhandled failure", error);
    return json(500, { message: `Netlify github-proxy failed: ${error?.message || "Unexpected error"}` });
  }
};
