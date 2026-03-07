const path = require("path");
const fs = require("fs");
const { google } = require("googleapis");

const TOKENS_PATH = path.join(process.cwd(), "data", "gmail-tokens.json");
const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

/**
 * Loads stored OAuth tokens from disk (same path as API auth flow).
 * @returns {Object|null}
 */
function loadTokens() {
  try {
    const raw = fs.readFileSync(TOKENS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Creates an authenticated Gmail API client.
 * Uses stored refresh_token to obtain access_token; auto-refreshes when expired.
 * @returns {Promise<{ gmail: Object }|null>} Gmail API instance or null if not configured
 */
async function getGmailClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const tokens = loadTokens();

  if (!clientId || !clientSecret || !tokens?.refresh_token) {
    return null;
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials(tokens);

  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  return { gmail };
}

module.exports = {
  loadTokens,
  getGmailClient,
  TOKENS_PATH,
};
