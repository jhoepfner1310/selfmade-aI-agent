require("dotenv").config();
const http = require("http");
const { handleRequest } = require("./app");
const runRepository = require("./repositories/runRepository");

const PORT = process.env.PORT || 3080;

/**
 * API server bootstrap. Ensures runs table exists, then starts HTTP server.
 * Fails fast on init errors (e.g. missing DATABASE_URL).
 */
runRepository
  .ensureRunsDir()
  .then(() => {
    const server = http.createServer(handleRequest);
    server.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
      console.log("Routes: GET /health, POST /runs, GET /runs, GET /runs/:id");
    });
  })
  .catch((error) => {
    console.error("Failed to initialize runs directory:", error);
    process.exit(1);
  });
