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
/** Health check endpoint for load balancers and monitoring. */
async function health(req, res) {
  return sendJson(res, 200, {
    status: "ok",
    service: "selfmade-agent-api",
  });
}

/**
 * Creates a new run from request body, persists it, and enqueues for worker processing.
 * Expects { userText: string } in body. Returns the queued run (201).
 */
async function createRun(req, res) {
  const input = await readJsonBody(req);
  // Service creates run, persists, transitions to queued, enqueues job; returns queued run
  const queuedRun = await runService.createRun(input);
  return sendJson(res, 201, queuedRun);
}

/** Returns all runs from the repository, newest first. */
async function listRuns(req, res) {
  const runs = await runService.listRuns();
  return sendJson(res, 200, runs);
}

/**
 * Returns a single run by ID. Path param: /runs/:id
 * Returns 400 if runId is empty, 404 if not found.
 */
async function getRunById(req, res, runId) {
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
