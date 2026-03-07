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
 * Generates text using the OpenAI Responses API.
 * Uses instructions (system prompt) + input (user message).
 *
 * @param {string} promptText - User message
 * @returns {Promise<{ provider: string, model: string, text: string } | null>}
 */
async function generateText(promptText) {
  const client = getOpenAIClient();
  if (!client) {
    return null;
  }

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    instructions: SYSTEM_PROMPT,
    input: promptText,
  });

  return {
    provider: "openai",
    model: OPENAI_MODEL,
    text: response.output_text?.trim() || "No response text generated.",
  };
}

module.exports = {
  generateText,
};
