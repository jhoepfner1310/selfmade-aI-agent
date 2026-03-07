// OpenRouter API base URL; defaults to official endpoint if not set
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
// Model ID (e.g. "anthropic/claude-3-haiku"); must be set for OpenRouter to work
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL;
const { SYSTEM_PROMPT } = require("../systemPrompt");

/**
 * Extracts plain text from OpenRouter's message content.
 * Handles string, array of parts (e.g. { type: "text", text: "..." }), or empty.
 *
 * @param {string|Array} content - Message content from API response
 * @returns {string} Extracted text
 */
function extractTextContent(content) {
  // Simple case: content is already a string
  if (typeof content === "string") {
    return content.trim();
  }

  // OpenRouter can return content as array of parts (e.g. multimodal, tool calls).
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        // Part may be { type: "text", text: "..." } (OpenAI-compatible format)
        if (part?.type === "text" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

/**
 * Generates text using OpenRouter's chat completions API.
 * Embeds system prompt in user message (some models don't support separate system role).
 *
 * @param {string} promptText - User message
 * @returns {Promise<{ provider: string, model: string, text: string } | null>}
 */
async function generateText(promptText) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !OPENROUTER_MODEL) {
    return null;
  }

  // Combine system + user into single user message (some models don't support separate system role)
  const combinedPrompt = `${SYSTEM_PROMPT}\n\nNutzeranfrage:\n${promptText}`;

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "user",
          content: combinedPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  // choices[0].message.content can be string or array of parts; extractTextContent normalizes
  const text = extractTextContent(payload?.choices?.[0]?.message?.content);

  return {
    provider: "openrouter",
    model: OPENROUTER_MODEL,
    text: text || "No response text generated.",
  };
}

module.exports = {
  generateText,
};
