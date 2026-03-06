const INTENTS = new Set([
  "answer_question",
  "ask_clarifying_question",
  "perform_task",
  "other",
]);

const CONFIDENCE_LEVELS = new Set(["low", "medium", "high"]);

const RESPONSE_FORMAT_INSTRUCTIONS = [
  "Gib deine finale Antwort ausschliesslich als gueltiges JSON ohne Markdown-Codeblock zurueck.",
  'Nutze exakt dieses Schema: {"reply":"string","intent":"answer_question|ask_clarifying_question|perform_task|other","needsTool":boolean,"confidence":"low|medium|high"}',
  "reply soll der eigentliche Antworttext fuer den Nutzer sein.",
].join(" ");

function normalizeStructuredOutput(value) {
  const reply =
    typeof value?.reply === "string" && value.reply.trim()
      ? value.reply.trim()
      : "Keine Antwort erzeugt.";

  const intent = INTENTS.has(value?.intent) ? value.intent : "other";
  const needsTool = typeof value?.needsTool === "boolean" ? value.needsTool : false;
  const confidence = CONFIDENCE_LEVELS.has(value?.confidence) ? value.confidence : "medium";

  return {
    reply,
    intent,
    needsTool,
    confidence,
  };
}

function extractJsonObject(text) {
  if (typeof text !== "string") {
    return null;
  }

  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function parseStructuredOutput(text) {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return normalizeStructuredOutput({ reply: text });
  }

  try {
    return normalizeStructuredOutput(JSON.parse(jsonText));
  } catch {
    return normalizeStructuredOutput({ reply: text });
  }
}

module.exports = {
  RESPONSE_FORMAT_INSTRUCTIONS,
  parseStructuredOutput,
};
