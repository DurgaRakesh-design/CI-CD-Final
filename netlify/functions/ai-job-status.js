import { CORS_HEADERS, json, getAiJob } from "./_shared.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "GET") return json(405, { message: "Method not allowed." });

  const type = String(event.queryStringParameters?.type || "").trim();
  const jobId = String(event.queryStringParameters?.jobId || "").trim();
  if (!type || !jobId) {
    return json(400, { message: "type and jobId are required." });
  }

  const job = await getAiJob(type, jobId);
  if (!job) {
    return json(404, { message: "Job not found." });
  }

  return json(200, job);
};
