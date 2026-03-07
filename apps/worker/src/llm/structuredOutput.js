/**
 * Valid intent values the LLM may return.
 * Used to validate and normalize the parsed structured output.
 */
const INTENTS = new Set([
  "answer_question",
  "ask_clarifying_question",
  "perform_task",
  "other",
]);

/**
 * Valid confidence levels for the LLM's self-assessment.
 */
const CONFIDENCE_LEVELS = new Set(["low", "medium", "high"]);

/**
 * Builds the JSON schema and format instructions for the LLM.
 * Injects the available tool list so the LLM knows which tools exist and can
 * suggest one via suggestedTool + toolParams when needsTool is true.
 *
 * @param {string} [toolListForPrompt] - Semicolon-separated "name - description" list
 * @returns {string} Instructions to append to the system prompt
 */
function buildResponseFormatInstructions(toolListForPrompt) {
  const toolPart = toolListForPrompt
    ? ` Verfuegbare Tools: ${toolListForPrompt}. Wenn needsTool true ist, setze suggestedTool auf den exakten Tool-Namen aus dieser Liste; sonst null. Wenn ein Tool Parameter braucht (z.B. Ort fuer Wetter), setze toolParams als Objekt (z.B. {"city":"Berlin"}); sonst null oder {}.`
    : "";
  return [
    "Gib deine finale Antwort ausschliesslich als gueltiges JSON ohne Markdown-Codeblock zurueck.",
    'Nutze exakt dieses Schema: {"reply":"string","intent":"answer_question|ask_clarifying_question|perform_task|other","needsTool":boolean,"confidence":"low|medium|high","suggestedTool":"string|null","toolParams":"object|null"}',
    "reply soll der eigentliche Antworttext fuer den Nutzer sein.",
    "Wenn needsTool true ist: Formuliere reply als Einleitung, die das Tool-Ergebnis erwartet (z.B. 'Hier ist die aktuelle Uhrzeit:' oder 'Einen Moment.'). Sage NICHT, dass du keinen Zugriff hast – das System fuehrt das Tool aus und haengt das Ergebnis an deine reply an.",
    "Setze intent auf answer_question fuer normale Wissensfragen, ask_clarifying_question bei fehlenden Angaben und perform_task bei konkreten Arbeitsauftraegen.",
    "Setze needsTool auf true, wenn du fuer eine gute Antwort ein externes Tool, aktuelle Daten oder Systemzugriff brauchen wuerdest.",
    `Setze confidence passend zu deiner Sicherheit auf low, medium oder high.${toolPart}`,
  ].join(" ");
}

/**
 * Normalizes raw parsed JSON into a consistent structured output shape.
 * Validates intent, confidence, suggestedTool; sanitizes toolParams.
 * Provides safe defaults for missing or invalid fields.
 *
 * @param {Object} value - Raw parsed object from LLM response
 * @returns {Object} Normalized { reply, intent, needsTool, confidence, suggestedTool, toolParams }
 */
function normalizeStructuredOutput(value) {
  const reply =
    typeof value?.reply === "string" && value.reply.trim()
      ? value.reply.trim()
      : "Keine Antwort erzeugt.";

  const intent = INTENTS.has(value?.intent) ? value.intent : "other";
  const needsTool = typeof value?.needsTool === "boolean" ? value.needsTool : false;
  const confidence = CONFIDENCE_LEVELS.has(value?.confidence) ? value.confidence : "medium";
  const suggestedTool =
    typeof value?.suggestedTool === "string" && value.suggestedTool.trim()
      ? value.suggestedTool.trim()
      : null;

  const toolParams = sanitizeToolParams(value?.toolParams);

  return {
    reply,
    intent,
    needsTool,
    confidence,
    suggestedTool,
    toolParams,
  };
}

/**
 * Sanitizes toolParams from the LLM to prevent injection or unexpected types.
 * Only allows plain string keys and primitive values (string, number, boolean).
 * Rejects nested objects, arrays, and functions.
 *
 * @param {*} value - Raw toolParams from LLM
 * @returns {Object} Safe key-value object for tool execution
 */
function sanitizeToolParams(value) {
  if (value === null || value === undefined) return {};
  if (typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof k === "string" && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Extracts a JSON object from LLM response text.
 * Handles markdown code blocks (```json ... ```) and strips surrounding noise.
 *
 * @param {string} text - Raw LLM response
 * @returns {string|null} JSON string or null if no object found
 */
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

/**
 * Parses LLM response text into normalized structured output.
 * Extracts JSON, parses it, and normalizes. Falls back to using raw text as reply
 * if JSON extraction or parsing fails.
 *
 * @param {string} text - Raw LLM response
 * @returns {Object} Normalized { reply, intent, needsTool, confidence, suggestedTool, toolParams }
 */
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
  buildResponseFormatInstructions,
  parseStructuredOutput,
};
