const OpenAI = require("openai");
const { SYSTEM_PROMPT } = require("../systemPrompt");

// Model ID; defaults to gpt-4.1-mini if OPENAI_MODEL not set
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
let openaiClient = null;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

/**
 * Generates text using OpenAI Chat Completions API.
 * Supports single prompt or full conversation history (multi-turn).
 *
 * @param {string} promptText - Current user message
 * @param {Object} [options] - Optional settings
 * @param {Array<{role: string, content: string}>} [options.conversationHistory] - Prior messages
 * @returns {Promise<{ provider: string, model: string, text: string } | null>}
 */
async function generateText(promptText, options = {}) {
  const client = getOpenAIClient();
  if (!client) {
    return null;
  }

  let messages;
  if (options.conversationHistory && options.conversationHistory.length > 0) {
    messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...options.conversationHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: promptText },
    ];
  } else {
    messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: promptText },
    ];
  }

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages,
  });

  const text = response.choices?.[0]?.message?.content?.trim();
  return {
    provider: "openai",
    model: OPENAI_MODEL,
    text: text || "No response text generated.",
  };
}

module.exports = {
  generateText,
};
