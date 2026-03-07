const { sendJson } = require("../utils/http");
const runsController = require("../controllers/runsController");

/**
 * Route dispatcher for the API surface.
 *
 * Responsibilities:
 * 1) Parse method + pathname from the incoming Node HTTP request.
 * 2) Delegate to the corresponding controller handler.
 * 3) Return a consistent 404 payload for unknown endpoints.
 *
 * Note: This module intentionally stays thin and keeps business logic
 * inside controllers/services.
 */
/**
 * Dispatches HTTP requests to the appropriate controller based on method and path.
 * Uses URL constructor to parse pathname (req.url can be relative).
 */
async function handleRunRoutes(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;
  const method = req.method;

  if (method === "GET" && pathname === "/health") {
    return runsController.health(req, res);
  }

  if (method === "POST" && pathname === "/runs") {
    return runsController.createRun(req, res);
  }

  if (method === "GET" && pathname === "/runs") {
    return runsController.listRuns(req, res);
  }

  if (method === "GET" && pathname.startsWith("/runs/")) {
    const runId = pathname.slice("/runs/".length);
    return runsController.getRunById(req, res, runId);
  }

  return sendJson(res, 404, { error: "Not Found" });
}

module.exports = {
  handleRunRoutes,
};
