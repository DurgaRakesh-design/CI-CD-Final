import {
  CORS_HEADERS,
  json,
  parseEventBody,
  connectBlobsFromEvent,
  setPackageUploadChunk,
  setPackageUploadManifest,
} from "./_shared.js";

const MAX_CHUNK_BASE64_CHARS = 2_200_000;

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed." });

  try {
    connectBlobsFromEvent(event);
    const request = parseEventBody(event);
    const action = String(request.action || "").trim();
    const uploadId = normalizeUploadId(request.uploadId);
    if (!uploadId) return json(400, { message: "uploadId is required." });

    if (action === "chunk") {
      const index = Number(request.index);
      const total = Number(request.total);
      const contentBase64 = String(request.contentBase64 || "");
      if (!Number.isInteger(index) || index < 0) return json(400, { message: "Valid chunk index is required." });
      if (!Number.isInteger(total) || total < 1) return json(400, { message: "Valid chunk total is required." });
      if (!contentBase64) return json(400, { message: "Chunk content is required." });
      if (contentBase64.length > MAX_CHUNK_BASE64_CHARS) return json(413, { message: "Package chunk is too large." });

      await setPackageUploadChunk(uploadId, index, contentBase64);
      return json(200, { uploadId, index, total, status: "chunk-stored" });
    }

    if (action === "complete") {
      const manifest = await setPackageUploadManifest(uploadId, {
        name: safeFileName(request.name || "source-package.zip"),
        type: String(request.type || "application/zip"),
        size: Number(request.size || 0),
        chunkCount: Number(request.chunkCount || request.total || 0),
      });
      return json(200, {
        uploadId,
        status: "completed",
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

function normalizeUploadId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

function safeFileName(value) {
  return String(value || "source-package.zip").split(/[\\/]/).pop().replace(/[^\w.\- ()]/g, "_") || "source-package.zip";
}
