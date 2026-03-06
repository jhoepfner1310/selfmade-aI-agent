/**
 * Read the Node HTTP request stream and parse it as JSON.
 *
 * Behavior:
 * - Accumulates all request chunks.
 * - Returns {} for an empty body.
 * - Throws SyntaxError for malformed JSON (handled by app-level error boundary).
 */
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

module.exports = {
  readJsonBody,
};
