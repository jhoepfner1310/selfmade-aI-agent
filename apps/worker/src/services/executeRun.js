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
    // Set name so error type can be checked with instanceof and error.name.
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
  // Reject non-object input (null, array, primitive) to avoid downstream errors.
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new RunValidationError("Run input must be an object");
  }

  // userText is required; LLM needs a string to process.
  if (typeof input.userText !== "string") {
    throw new RunValidationError("Run input.userText must be a string");
  }

  // Trim leading/trailing whitespace from user input.
  const userText = input.userText.trim();
  // Fallback for empty string so we always have something to send to the LLM.
  const normalizedText = userText || "No userText provided.";
  // Split on whitespace, filter empty strings; used later for analysis (word count, etc.).
  const words = normalizedText.split(/\s+/).filter(Boolean);
  // Resolve provider from env (openai | openrouter); returns first available.
  const llmProvider = getLlmProvider();
  const llmResult = await llmProvider.generateText(normalizedText);

  // LLM returned a result; parse structured output and optionally run tools.
  if (llmResult) {
    // Extract JSON from LLM text and normalize to { reply, intent, needsTool, suggestedTool, toolParams }.
    const structuredOutput = parseStructuredOutput(llmResult.text);
    // Decide action: plan_tool_use | answer_directly | request_clarification | perform_task_directly.
    const decision = deriveAgentDecision(structuredOutput);

    // Start with the LLM's reply; we may append tool output to it when plan_tool_use.
    let reply = structuredOutput.reply;
    // Collect tool invocations for the result payload (for logging and API response).
    let toolResults = [];

    if (decision.action === "plan_tool_use") {
      // Use LLM's suggested tool if valid; otherwise fallback to get_current_time.
      const toolName = isValidTool(structuredOutput.suggestedTool)
        ? structuredOutput.suggestedTool
        : getDefaultToolForPlan();
      // Pass toolParams from LLM (e.g. { city: "Berlin" }) or empty object; sanitized in parseStructuredOutput.
      const params = structuredOutput.toolParams && typeof structuredOutput.toolParams === "object"
        ? structuredOutput.toolParams
        : {};
      const toolOutcome = await executeTool(toolName, params);
      // Store for result payload and logging; use error message if tool failed.
      toolResults.push({
        tool: toolOutcome.toolName,
        success: toolOutcome.success,
        result: toolOutcome.result ?? toolOutcome.error,
      });
      // Append tool result or error to the reply shown to the user.
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
      // Use undefined instead of null so the key is omitted when null (cleaner JSON).
      suggestedTool: structuredOutput.suggestedTool ?? undefined,
      // Only include toolParams in result if the object has at least one key.
      toolParams: Object.keys(structuredOutput.toolParams || {}).length ? structuredOutput.toolParams : undefined,
      confidence: structuredOutput.confidence,
      action: decision.action,
      decisionReason: decision.reason,
      // Omit toolResults if no tools were run.
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

  // LLM returned null (e.g. provider unavailable, no API key); return mock result.
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
