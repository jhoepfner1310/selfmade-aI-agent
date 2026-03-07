const { sendJson } = require("../utils/http");
const runsController = require("../controllers/runsController");
const authController = require("../controllers/authController");
const conversationController = require("../controllers/conversationController");

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

  if (method === "GET" && pathname === "/auth/gmail") {
    return authController.startGmailAuth(req, res);
  }
  if (method === "GET" && pathname === "/auth/gmail/callback") {
    return authController.gmailCallback(req, res);
  }
  if (method === "GET" && pathname === "/auth/gmail/status") {
    return authController.gmailStatus(req, res);
  }

  if (method === "GET" && pathname === "/conversations") {
    return conversationController.listConversations(req, res);
  }
  if (method === "POST" && pathname === "/conversations") {
    return conversationController.createConversation(req, res);
  }
  if (method === "POST" && pathname.match(/^\/conversations\/[^/]+\/messages$/)) {
    const conversationId = pathname.split("/")[2];
    return conversationController.addMessage(req, res, conversationId);
  }
  if (method === "GET" && pathname.match(/^\/conversations\/[^/]+$/)) {
    const conversationId = pathname.slice("/conversations/".length);
    return conversationController.getConversation(req, res, conversationId);
  }

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
