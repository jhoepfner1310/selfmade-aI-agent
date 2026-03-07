const { sendJson } = require("./utils/http");
const { handleRunRoutes } = require("./routes/runsRoutes");
const { serveStatic } = require("./utils/staticFiles");

/**
 * App-level request entrypoint.
 *
 * Responsibilities:
 * 1) Serve static files for GET requests to /, /index.html, /app.js, /app.css.
 * 2) Delegate API requests to the route dispatcher.
 * 3) Provide one centralized error boundary for route/controller/service errors.
 */
async function handleRequest(req, res) {
  try {
    if (req.method === "GET") {
      const served = await serveStatic(req, res);
      if (served) return;
    }
    return await handleRunRoutes(req, res);
  } catch (error) {
    // Filesystem ENOENT usually means a run file was requested but does not exist.
    // Return a domain-specific 404 response for API consumers.
    if (error.code === "ENOENT") {
      return sendJson(res, 404, { error: "Run not found" });
    }

    // SyntaxError commonly comes from malformed JSON payloads in request bodies.
    // Return 400 to signal a client-side request format problem.
    if (error instanceof SyntaxError) {
      return sendJson(res, 400, { error: "Invalid JSON body" });
    }

    // Fallback for all unexpected runtime issues.
    // Avoid leaking internals; send a stable generic error response.
    return sendJson(res, 500, { error: "Internal Server Error" });
  }
}

// Export as CommonJS object so the server bootstrap can destructure:
// const { handleRequest } = require("./app");
module.exports = {
  handleRequest,
};
