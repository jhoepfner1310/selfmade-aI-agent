const openaiProvider = require("./providers/openaiProvider");
const openrouterProvider = require("./providers/openrouterProvider");

/**
 * Provider selection from env. Defaults to "openai" if not set.
 */
const LLM_PROVIDER = (process.env.LLM_PROVIDER || "openai").toLowerCase();

/**
 * Returns the configured LLM provider module.
 * Each provider must expose generateText(promptText) -> { provider, model, text }.
 *
 * @returns {Object} Provider with generateText method
 */
function getLlmProvider() {
  switch (LLM_PROVIDER) {
    case "openai":
      return openaiProvider;
    case "openrouter":
      return openrouterProvider;
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${LLM_PROVIDER}`);
  }
}

module.exports = {
  getLlmProvider,
};
