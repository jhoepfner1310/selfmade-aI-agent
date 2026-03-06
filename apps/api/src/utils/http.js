/**
 * HTTP response helper for JSON endpoints.
 *
 * Why this utility exists:
 * - Keeps response writing consistent across controllers/routes.
 * - Avoids duplicating JSON serialization and header setup everywhere.
 * - Provides one place to adjust response formatting behavior later.
 */
function sendJson(res, statusCode, payload) {
  // Convert plain JavaScript data into a JSON string response body.
  const body = JSON.stringify(payload);

  // Send status + headers before ending the response stream.
  // Content-Type tells clients to parse as UTF-8 JSON.
  // Content-Length uses byte size (not string length) for transport correctness.
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });

  // Write final body and close the HTTP response.
  res.end(body);
}

// Export as CommonJS utility module.
module.exports = {
  sendJson,
};
