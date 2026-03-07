const { sendJson } = require("../utils/http");
const gmailAuth = require("../auth/gmailAuth");

/**
 * Redirects user to Google OAuth consent page.
 * User logs in and grants Gmail read access; Google redirects back to callback.
 */
async function startGmailAuth(req, res) {
  const authUrl = gmailAuth.getAuthUrl();
  if (!authUrl) {
    return sendJson(res, 500, {
      error: "Gmail OAuth not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env",
    });
  }
  res.writeHead(302, { Location: authUrl });
  res.end();
}

/**
 * Handles OAuth callback from Google.
 * Exchanges code for tokens, saves them, and returns success page.
 */
async function gmailCallback(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");

  if (error) {
    return sendJson(res, 400, {
      error: `OAuth error: ${error}`,
      hint: "User may have denied access or closed the consent window.",
    });
  }

  if (!code) {
    return sendJson(res, 400, {
      error: "Missing authorization code",
      hint: "Visit GET /auth/gmail first to start the OAuth flow.",
    });
  }

  try {
    await gmailAuth.exchangeCodeForTokens(code);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.writeHead(200);
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><title>Gmail verbunden</title></head>
        <body>
          <h1>Gmail erfolgreich verbunden</h1>
          <p>Die Tokens wurden gespeichert. Der Agent kann nun deine E-Mails lesen.</p>
          <p><a href="/">Zum Chat</a></p>
        </body>
      </html>
    `);
  } catch (err) {
    return sendJson(res, 500, {
      error: "Failed to exchange code for tokens",
      details: err?.message || "Unknown error",
    });
  }
}

/**
 * Returns the current OAuth status (configured, tokens present).
 */
async function gmailStatus(req, res) {
  const configured = !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET);
  const hasTokens = gmailAuth.hasValidTokens();
  return sendJson(res, 200, {
    configured,
    hasTokens,
    message: hasTokens
      ? "Gmail OAuth ist verbunden. Der Agent kann E-Mails lesen."
      : configured
        ? "Nicht verbunden. Besuche GET /auth/gmail um den OAuth-Flow zu starten."
        : "Gmail OAuth nicht konfiguriert. Setze GMAIL_CLIENT_ID und GMAIL_CLIENT_SECRET.",
  });
}

module.exports = {
  startGmailAuth,
  gmailCallback,
  gmailStatus,
};
