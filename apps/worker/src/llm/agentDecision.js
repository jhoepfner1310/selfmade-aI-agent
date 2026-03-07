/**
 * Derives the agent's next action from the LLM's structured output.
 * Priority order: needsTool (plan_tool_use) > ask_clarifying_question > perform_task > answer_directly.
 *
 * @param {Object} structuredOutput - Parsed output from parseStructuredOutput
 * @returns {{ action: string, reason: string }} Action and human-readable reason
 */
function deriveAgentDecision(structuredOutput) {
  // Highest priority: LLM says it needs a tool → we will run one (plan_tool_use)
  if (structuredOutput?.needsTool === true) {
    return {
      action: "plan_tool_use",
      reason: "Das Modell signalisiert, dass ein Tool oder externer Zugriff noetig ist.",
    };
  }

  // Second: LLM wants to ask a clarifying question before answering
  if (structuredOutput?.intent === "ask_clarifying_question") {
    return {
      action: "request_clarification",
      reason: "Die Nutzeranfrage ist aus Modellsicht noch nicht klar genug.",
    };
  }

  // Third: LLM sees a task it can do directly (e.g. summarize, explain) without tools
  if (structuredOutput?.intent === "perform_task") {
    return {
      action: "perform_task_directly",
      reason: "Das Modell bewertet die Anfrage als direkt bearbeitbare Aufgabe ohne Toolbedarf.",
    };
  }

  // Default: answer directly (covers answer_question, other, or any fallback)
  return {
    action: "answer_directly",
    reason: "Das Modell kann direkt mit einer normalen Antwort reagieren.",
  };
}

module.exports = {
  deriveAgentDecision,
};
