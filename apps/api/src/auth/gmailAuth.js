const path = require("path");
const fs = require("fs");
const { google } = require("googleapis");

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const TOKENS_PATH = path.join(process.cwd(), "data", "gmail-tokens.json");

/**
 * Ensures the data directory exists for token storage.
 */
function ensureDataDir() {
  const dir = path.dirname(TOKENS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Loads stored OAuth tokens from disk.
 * @returns {Object|null} { access_token, refresh_token, ... } or null if not found
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
 * Saves OAuth tokens to disk for reuse.
 * @param {Object} tokens - Tokens from OAuth2 callback
 */
function saveTokens(tokens) {
  ensureDataDir();
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), "utf8");
}

/**
 * Creates an OAuth2 client for Gmail.
 * Uses GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET from env.
 * @returns {google.auth.OAuth2|null}
 */
function createOAuth2Client() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || "http://localhost:3080/auth/gmail/callback";

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates the Google OAuth consent URL.
 * User must visit this URL to grant access.
 * @returns {string|null} Auth URL or null if client not configured
 */
function getAuthUrl() {
  const oauth2 = createOAuth2Client();
  if (!oauth2) return null;
  return oauth2.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent",
  });
}

/**
 * Exchanges authorization code for tokens and persists them.
 * @param {string} code - Authorization code from callback
 * @returns {Promise<Object>} Tokens object
 */
async function exchangeCodeForTokens(code) {
  const oauth2 = createOAuth2Client();
  if (!oauth2) {
    throw new Error("Gmail OAuth not configured (missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET)");
  }
  const { tokens } = await oauth2.getToken(code);
  saveTokens(tokens);
  return tokens;
}

/**
 * Checks whether Gmail OAuth is configured and tokens exist.
 * @returns {boolean}
 */
function hasValidTokens() {
  const tokens = loadTokens();
  return !!tokens?.refresh_token;
}

module.exports = {
  loadTokens,
  saveTokens,
  createOAuth2Client,
  getAuthUrl,
  exchangeCodeForTokens,
  hasValidTokens,
  TOKENS_PATH,
  GMAIL_SCOPES,
};
