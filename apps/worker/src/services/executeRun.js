const OpenAI = require("openai");

/**
 * Worker-side execution use case.
 *
 * This function encapsulates the actual "run execution" behavior so that
 * the orchestration flow in processQueuedRun stays focused on state updates.
 * For now this is a deterministic mock implementation and can later be
 * replaced by real LLM/tool invocation logic without changing worker flow.
 */
class RunValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RunValidationError";
  }
}

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

async function executeRun(input = {}) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new RunValidationError("Run input must be an object");
  }

  if (typeof input.userText !== "string") {
    throw new RunValidationError("Run input.userText must be a string");
  }

  const userText = input.userText.trim();
  const normalizedText = userText || "No userText provided.";
  const words = normalizedText.split(/\s+/).filter(Boolean);
  const client = getOpenAIClient();

  if (client) {
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: normalizedText,
    });

    const reply = response.output_text?.trim() || "No response text generated.";

    return {
      summary: "Run processed with LLM",
      reply,
      analysis: {
        provider: "openai",
        model: OPENAI_MODEL,
        wordCount: words.length,
        charCount: normalizedText.length,
        hasQuestion: normalizedText.includes("?"),
      },
    };
  }

  return {
    summary: "Run processed successfully (mock fallback)",
    reply: `Processed text: "${normalizedText}"`,
    analysis: {
      wordCount: words.length,
      charCount: normalizedText.length,
      hasQuestion: normalizedText.includes("?"),
    },
  };
}

module.exports = {
  executeRun,
  RunValidationError,
};
