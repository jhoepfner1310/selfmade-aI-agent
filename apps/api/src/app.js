const { sendJson } = require("./utils/http");
const { handleRunRoutes } = require("./routes/runsRoutes");

/**
 * App-level request entrypoint.
 *
 * Responsibilities:
 * 1) Delegate incoming HTTP requests to the route dispatcher.
 * 2) Provide one centralized error boundary for route/controller/service errors.
 *
 * This keeps error-to-HTTP mapping consistent across all endpoints.
 */
async function handleRequest(req, res) {
  try {
    // Route dispatcher decides which endpoint handler should process this request.
    // We await to ensure thrown async errors are caught by the catch block below.
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
