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

  return {
    summary: "Run processed successfully",
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
