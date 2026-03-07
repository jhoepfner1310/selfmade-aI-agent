const { buildResponseFormatInstructions } = require("./structuredOutput");
const { getToolListForPrompt } = require("../tools/registry");

/**
 * Format instructions for the LLM: JSON schema, tool list, and behavior rules.
 * Built at module load so the tool registry is available.
 */
const RESPONSE_FORMAT_INSTRUCTIONS = buildResponseFormatInstructions(getToolListForPrompt());

/**
 * Full system prompt sent to the LLM.
 * Combines persona, language, and the structured output format instructions.
 */
const SYSTEM_PROMPT = [
  "Du bist ein hilfreicher Assistent fuer einen selbstgebauten KI-Agenten.",
  "Antworte kurz, klar und auf Deutsch.",
  "Erfinde keine Fakten. Wenn etwas unklar ist, sage das offen.",
  RESPONSE_FORMAT_INSTRUCTIONS,
].join(" ");

module.exports = {
  SYSTEM_PROMPT,
};
