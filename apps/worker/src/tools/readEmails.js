const { getGmailClient } = require("../lib/gmailClient");

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/**
 * Tool: reads recent emails from Gmail via OAuth2.
 * Requires Gmail OAuth to be completed (GET /auth/gmail) before use.
 *
 * @param {Object} [params] - Sanitized tool params from LLM
 * @param {number} [params.limit] - Number of emails to fetch (default 5, max 20)
 * @param {string} [params.q] - Gmail search query (e.g. from:user@example.com, subject:foo, is:unread)
 * @returns {Promise<{ success: boolean, result: string, toolName: string }>}
 */
async function execute(params = {}) {
  const limit = Math.min(
    Math.max(1, Number(params.limit) || DEFAULT_LIMIT),
    MAX_LIMIT
  );
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const client = await getGmailClient();
  if (!client) {
    return {
      success: false,
      result: "Gmail nicht verbunden. Besuche GET /auth/gmail um OAuth zu starten.",
      toolName: "read_emails",
    };
  }

  try {
    const { gmail } = client;
    const listOptions = { userId: "me", maxResults: limit };
    if (q) listOptions.q = q;
    const { data } = await gmail.users.messages.list(listOptions);

    const messages = data.messages || [];
    if (messages.length === 0) {
      return {
        success: true,
        result: "Keine E-Mails gefunden.",
        toolName: "read_emails",
      };
    }

    const summaries = [];
    for (const msg of messages) {
      const { data: full } = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
      });
      const headers = full.payload?.headers || [];
      const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
      summaries.push({
        from: getHeader("From"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        snippet: full.snippet || "",
      });
    }

    const result = summaries
      .map((s, i) => `${i + 1}. Von: ${s.from} | Betreff: ${s.subject} | ${s.date}\n   ${s.snippet}`)
      .join("\n\n");

    return {
      success: true,
      result,
      toolName: "read_emails",
    };
  } catch (err) {
    return {
      success: false,
      result: err?.message || "Fehler beim Lesen der E-Mails.",
      toolName: "read_emails",
    };
  }
}

module.exports = {
  execute,
  name: "read_emails",
  description:
    "Liest E-Mails aus dem Gmail-Postfach (OAuth2). Parameter: limit (optional, 1-20, Standard 5); q (optional, Gmail-Suchanfrage, z.B. from:user@example.com, subject:foo, is:unread).",
};
