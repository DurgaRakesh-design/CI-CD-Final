import { CORS_HEADERS, json, getAiJob, connectBlobsFromEvent } from "./_shared.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "GET") return json(405, { message: "Method not allowed." });

  connectBlobsFromEvent(event);

  const type = String(event.queryStringParameters?.type || "").trim();
  const jobId = String(event.queryStringParameters?.jobId || "").trim();
  if (!type || !jobId) {
    return json(400, { message: "type and jobId are required." });
  }

  try {
    const job = await getAiJob(type, jobId);
    if (!job) {
      return json(404, { message: "Job not found." });
    }

    return json(200, job);
  } catch (error) {
    console.error("ai-job-status failed", error);
    return json(500, {
      message: error.message || "AI job status lookup failed.",
    });
  }
};
