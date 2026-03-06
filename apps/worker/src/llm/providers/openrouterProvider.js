const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL;
const { SYSTEM_PROMPT } = require("../systemPrompt");

function extractTextContent(content) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

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

async function generateText(promptText) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !OPENROUTER_MODEL) {
    return null;
  }

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
