const openaiProvider = require("./providers/openaiProvider");

const LLM_PROVIDER = (process.env.LLM_PROVIDER || "openai").toLowerCase();

function getLlmProvider() {
  switch (LLM_PROVIDER) {
    case "openai":
      return openaiProvider;
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${LLM_PROVIDER}`);
  }
}

module.exports = {
  getLlmProvider,
};
