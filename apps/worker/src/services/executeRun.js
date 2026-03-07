const { getLlmProvider } = require("../llm/providerFactory");
const { deriveAgentDecision } = require("../llm/agentDecision");
const { parseStructuredOutput } = require("../llm/structuredOutput");
const { executeTool, getDefaultToolForPlan, isValidTool } = require("../tools/registry");

/**
 * Custom error for input validation failures.
 * Used to signal non-retryable errors (e.g. missing userText) so BullMQ
 * does not waste retries on invalid payloads.
 */
class RunValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RunValidationError";
  }
}

/**
 * Core execution use case: processes a single run by calling the LLM,
 * parsing its structured output, optionally invoking tools, and returning
 * the final result.
 *
 * Flow:
 * 1. Validate input (userText required)
 * 2. Call LLM provider with user text
 * 3. Parse JSON response into structured output (reply, intent, needsTool, suggestedTool, toolParams)
 * 4. Derive agent decision (plan_tool_use, answer_directly, etc.)
 * 5. If plan_tool_use: execute suggested tool (or fallback) with toolParams, append result to reply
 * 6. Return result object for persistence
 *
 * @param {Object} input - Run input from the queue
 * @param {string} input.userText - The user's message to process
 * @returns {Promise<Object>} Execution result with reply, intent, action, toolResults, etc.
 */
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
  const llmProvider = getLlmProvider();
  const llmResult = await llmProvider.generateText(normalizedText);

  if (llmResult) {
    const structuredOutput = parseStructuredOutput(llmResult.text);
    const decision = deriveAgentDecision(structuredOutput);

    let reply = structuredOutput.reply;
    let toolResults = [];

    // When the agent decides to use a tool, resolve which tool to run and with what params.
    if (decision.action === "plan_tool_use") {
      const toolName = isValidTool(structuredOutput.suggestedTool)
        ? structuredOutput.suggestedTool
        : getDefaultToolForPlan();
      const params = structuredOutput.toolParams && typeof structuredOutput.toolParams === "object"
        ? structuredOutput.toolParams
        : {};
      const toolOutcome = await executeTool(toolName, params);
      toolResults.push({
        tool: toolOutcome.toolName,
        success: toolOutcome.success,
        result: toolOutcome.result ?? toolOutcome.error,
      });
      if (toolOutcome.success && toolOutcome.result) {
        reply = `${reply}\n\n(Tool-Ergebnis [${toolOutcome.toolName}]: ${toolOutcome.result})`;
      } else if (!toolOutcome.success) {
        reply = `${reply}\n\n(Tool-Fehler: ${toolOutcome.error})`;
      }
    }

    return {
      summary: "Run processed with LLM",
      reply,
      intent: structuredOutput.intent,
      needsTool: structuredOutput.needsTool,
      suggestedTool: structuredOutput.suggestedTool ?? undefined,
      toolParams: Object.keys(structuredOutput.toolParams || {}).length ? structuredOutput.toolParams : undefined,
      confidence: structuredOutput.confidence,
      action: decision.action,
      decisionReason: decision.reason,
      toolResults: toolResults.length ? toolResults : undefined,
      analysis: {
        provider: llmResult.provider,
        model: llmResult.model,
        wordCount: words.length,
        charCount: normalizedText.length,
        hasQuestion: normalizedText.includes("?"),
      },
    };
  }

  // Fallback when LLM returns no result (e.g. provider unavailable).
  return {
    summary: "Run processed successfully (mock fallback)",
    reply: `Processed text: "${normalizedText}"`,
    intent: "other",
    needsTool: false,
    confidence: "medium",
    action: "answer_directly",
    decisionReason: "Mock-Fallback ohne echte Agentenentscheidung.",
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
