const OpenAI = require("openai");

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

async function generateText(promptText) {
  const client = getOpenAIClient();
  if (!client) {
    return null;
  }

  const response = await client.responses.create({
    model: OPENAI_MODEL,
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
