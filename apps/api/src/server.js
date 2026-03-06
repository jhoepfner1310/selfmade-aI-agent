require("dotenv").config();
const http = require("http");
const { handleRequest } = require("./app");
const runRepository = require("./repositories/runRepository");

// Resolve the runtime port from environment first (useful for cloud/platform deployment),
// then fallback to a deterministic local default for development.
const PORT = process.env.PORT || 3080;

// Bootstrap sequence:
// 1) Ensure filesystem prerequisites exist (data/runs directory)
// 2) Start HTTP server only after step 1 succeeds
// 3) Fail fast on initialization errors
runRepository
  // This returns a Promise. The next step (.then) runs only after this
  // async initialization has completed successfully.
  .ensureRunsDir()
  .then(() => {
    // Create a Node HTTP server and delegate all request handling
    // to the app-level dispatcher (`handleRequest`).
    const server = http.createServer(handleRequest);

    // Start listening after initialization is complete.
    // Keeping startup here guarantees the API does not accept requests
    // before required storage folders are available.
    server.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
      console.log("Routes: GET /health, POST /runs, GET /runs, GET /runs/:id");
    });
  })
  .catch((error) => {
    // Initialization errors are considered fatal at startup time.
    // Exiting with code 1 makes failures explicit for local dev, CI, and process managers.
    console.error("Failed to initialize runs directory:", error);
    process.exit(1);
  });
