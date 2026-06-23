import {
  CORS_HEADERS,
  json,
  parseEventBody,
  connectBlobsFromEvent,
  setPackageUploadChunk,
  setPackageUploadManifest,
  countPackageUploadChunks,
} from "./_shared.js";

const MAX_CHUNK_BYTES = 2 * 1024 * 1024;

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed." });

  try {
    connectBlobsFromEvent(event);
    const action = getAction(event);

    if (action === "init") {
      const request = parseEventBody(event);
      const uploadId = normalizeUploadId(request.uploadId || crypto.randomUUID());
      const chunkCount = Number(request.chunkCount || request.total || 0);
      if (!chunkCount || chunkCount < 1) return json(400, { message: "Valid chunkCount is required." });
      const manifest = await setPackageUploadManifest(uploadId, {
        name: safeFileName(request.name || "source-package.zip"),
        type: String(request.type || "application/zip"),
        size: Number(request.size || 0),
        chunkCount,
        status: "initiated",
        initiatedAt: new Date().toISOString(),
      });
      return json(200, {
        uploadId,
        status: manifest.status,
        packageUpload: {
          name: manifest.name,
          type: manifest.type,
          size: manifest.size,
          blobUploadId: uploadId,
          chunkCount: manifest.chunkCount,
        },
      });
    }

    if (action === "chunk") {
      const uploadId = normalizeUploadId(getRequestValue(event, "uploadId"));
      const index = Number(getRequestValue(event, "index"));
      const total = Number(getRequestValue(event, "total"));
      const bytes = readBinaryBody(event);
      if (!uploadId) return json(400, { message: "uploadId is required." });
      if (!Number.isInteger(index) || index < 0) return json(400, { message: "Valid chunk index is required." });
      if (!Number.isInteger(total) || total < 1) return json(400, { message: "Valid chunk total is required." });
      if (!bytes.length) return json(400, { message: "Chunk content is required." });
      if (bytes.length > MAX_CHUNK_BYTES) return json(413, { message: "Package chunk is too large." });

      await setPackageUploadChunk(uploadId, index, bytes);
      return json(200, { uploadId, index, total, size: bytes.length, status: "chunk-stored" });
    }

    if (action === "complete") {
      const request = parseEventBody(event);
      const uploadId = normalizeUploadId(request.uploadId);
      if (!uploadId) return json(400, { message: "uploadId is required." });
      const storedChunkCount = await countPackageUploadChunks(uploadId);
      const expectedChunkCount = Number(request.chunkCount || request.total || 0);
      if (expectedChunkCount > 0 && storedChunkCount !== expectedChunkCount) {
        return json(409, {
          message: `Upload is incomplete. Expected ${expectedChunkCount} chunks but found ${storedChunkCount}.`,
          uploadId,
          expectedChunkCount,
          storedChunkCount,
        });
      }
      const manifest = await setPackageUploadManifest(uploadId, {
        status: "completed",
        completedAt: new Date().toISOString(),
        chunkCount: storedChunkCount,
      });
      return json(200, {
        uploadId,
        status: manifest.status,
        packageUpload: {
          name: manifest.name,
          type: manifest.type,
          size: manifest.size,
          blobUploadId: uploadId,
          chunkCount: manifest.chunkCount,
        },
      });
    }

    return json(400, { message: "Unsupported package upload action." });
  } catch (error) {
    console.error("ai-package-upload failed", {
      message: error.message,
      stack: error.stack,
    });
    return json(500, { message: error.message || "Package upload failed." });
  }
};

function getAction(event) {
  const direct = String(getRequestValue(event, "action") || "").trim().toLowerCase();
  if (direct) return direct;
  const request = safelyParseBody(event);
  const parsedAction = String(request.action || "").trim().toLowerCase();
  if (parsedAction) return parsedAction;

  const uploadId = String(getRequestValue(event, "uploadId") || request.uploadId || "").trim();
  const index = getRequestValue(event, "index") || request.index;
  const total = getRequestValue(event, "total") || request.total || request.chunkCount;
  const hasName = typeof request.name === "string" && request.name.trim().length > 0;
  const hasType = typeof request.type === "string" && request.type.trim().length > 0;
  const hasSize = request.size !== undefined && request.size !== null && request.size !== "";

  if (uploadId && index !== undefined && index !== null && index !== "" && total !== undefined && total !== null && total !== "") {
    return "chunk";
  }
  if (uploadId && hasName && hasType && hasSize && total !== undefined && total !== null && total !== "") {
    return "init";
  }
  if (uploadId && total !== undefined && total !== null && total !== "") {
    return "complete";
  }
  return "";
}

function getRequestValue(event, key) {
  const queryValue = event?.queryStringParameters?.[key];
  if (queryValue !== undefined && queryValue !== null && queryValue !== "") return queryValue;
  const headerValue = event?.headers?.[key] ?? event?.headers?.[key.toLowerCase()];
  if (headerValue !== undefined && headerValue !== null && headerValue !== "") return headerValue;
  return "";
}

function safelyParseBody(event) {
  try {
    return parseEventBody(event);
  } catch (_) {
    return {};
  }
}

function normalizeUploadId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

function safeFileName(value) {
  return String(value || "source-package.zip").split(/[\\/]/).pop().replace(/[^\w.\- ()]/g, "_") || "source-package.zip";
}

function readBinaryBody(event) {
  if (!event?.body) return Buffer.alloc(0);
  if (event.isBase64Encoded) return Buffer.from(event.body, "base64");
  return Buffer.from(event.body, "binary");
}
