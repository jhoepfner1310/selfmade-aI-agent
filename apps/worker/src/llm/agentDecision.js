/**
 * Derives the agent's next action from the LLM's structured output.
 * Priority order: needsTool (plan_tool_use) > ask_clarifying_question > perform_task > answer_directly.
 *
 * @param {Object} structuredOutput - Parsed output from parseStructuredOutput
 * @returns {{ action: string, reason: string }} Action and human-readable reason
 */
function deriveAgentDecision(structuredOutput) {
  if (structuredOutput?.needsTool === true) {
    return {
      action: "plan_tool_use",
      reason: "Das Modell signalisiert, dass ein Tool oder externer Zugriff noetig ist.",
    };
  }

  if (structuredOutput?.intent === "ask_clarifying_question") {
    return {
      action: "request_clarification",
      reason: "Die Nutzeranfrage ist aus Modellsicht noch nicht klar genug.",
    };
  }

  if (structuredOutput?.intent === "perform_task") {
    return {
      action: "perform_task_directly",
      reason: "Das Modell bewertet die Anfrage als direkt bearbeitbare Aufgabe ohne Toolbedarf.",
    };
  }

  return {
    action: "answer_directly",
    reason: "Das Modell kann direkt mit einer normalen Antwort reagieren.",
  };
}

module.exports = {
  deriveAgentDecision,
};
