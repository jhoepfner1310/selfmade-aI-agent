const { buildResponseFormatInstructions } = require("./structuredOutput");
const { getToolListForPrompt } = require("../tools/registry");

const RESPONSE_FORMAT_INSTRUCTIONS = buildResponseFormatInstructions(getToolListForPrompt());

const SYSTEM_PROMPT = [
  "Du bist ein hilfreicher Assistent fuer einen selbstgebauten KI-Agenten.",
  "Antworte kurz, klar und auf Deutsch.",
  "Erfinde keine Fakten. Wenn etwas unklar ist, sage das offen.",
  RESPONSE_FORMAT_INSTRUCTIONS,
].join(" ");

module.exports = {
  SYSTEM_PROMPT,
};
