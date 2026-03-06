const runService = require("../services/runService");
const { sendJson } = require("../utils/http");
const { readJsonBody } = require("../utils/readJsonBody");

/**
 * Controller layer for run-related HTTP handlers.
 *
 * Responsibilities:
 * 1) Read/validate HTTP-facing input (params/body).
 * 2) Delegate business logic to the service layer.
 * 3) Map successful outcomes to HTTP status codes + JSON payloads.
 *
 * Error mapping is centralized in app.js, so controller methods keep
 * their happy path straightforward.
 */
async function health(req, res) {
  return sendJson(res, 200, {
    status: "ok",
    service: "selfmade-agent-api",
  });
}

async function createRun(req, res) {
  // Parse request stream into JSON once; throws SyntaxError on malformed payloads.
  const input = await readJsonBody(req);
  const queuedRun = await runService.createRun(input);
  return sendJson(res, 201, queuedRun);
}

async function listRuns(req, res) {
  const runs = await runService.listRuns();
  return sendJson(res, 200, runs);
}

async function getRunById(req, res, runId) {
  // Defensively reject missing path parameter before calling the service.
  if (!runId) {
    return sendJson(res, 400, { error: "Run id is required" });
  }
  const run = await runService.getRun(runId);
  return sendJson(res, 200, run);
}

module.exports = {
  health,
  createRun,
  listRuns,
  getRunById,
};
