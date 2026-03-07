const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
const http = require("http");
const { handleRequest } = require("./app");
const runRepository = require("./repositories/runRepository");
const conversationRepository = require("./repositories/conversationRepository");

const PORT = process.env.PORT || 3080;

/**
 * API server bootstrap. Ensures runs and conversations tables exist, then starts HTTP server.
 * Fails fast on init errors (e.g. missing DATABASE_URL).
 */
Promise.all([runRepository.ensureRunsDir(), conversationRepository.ensureTables()])
  .then(() => {
    const server = http.createServer(handleRequest);
    server.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
      console.log("Routes: GET /health, POST /runs, GET /runs, GET /runs/:id, POST /conversations, POST /conversations/:id/messages, GET /conversations/:id, GET /auth/gmail, GET /auth/gmail/callback, GET /auth/gmail/status");
    });
  })
  .catch((error) => {
    console.error("Failed to initialize runs directory:", error);
    process.exit(1);
  });
