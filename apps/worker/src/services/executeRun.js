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
 * 5. If plan_tool_use: execute tool, append result, loop back to step 2 (agent loop, max 5 iterations)
 * 6. Return result object for persistence
 *
 * @param {Object} input - Run input from the queue
 * @param {string} input.userText - The user's message to process
 * @param {Array<{role: string, content: string}>} [input.conversationHistory] - Prior messages for multi-turn
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
  const conversationHistory = Array.isArray(input.conversationHistory)
    ? input.conversationHistory.map((m) => ({
        role: m.role === "user" || m.role === "assistant" ? m.role : "user",
        content: typeof m.content === "string" ? m.content : "",
      }))
    : [];

  const MAX_AGENT_LOOP_ITERATIONS = 5;
  let toolResults = [];
  let reply = "";
  let lastStructuredOutput = null;
  let lastLlmResult = null;
  let currentPromptText = normalizedText;

  // Agent loop: LLM → tool → LLM → ... until answer_directly or max iterations
  for (let iteration = 0; iteration < MAX_AGENT_LOOP_ITERATIONS; iteration++) {
    const llmResult = await llmProvider.generateText(currentPromptText, { conversationHistory });
    lastLlmResult = llmResult;

    if (!llmResult) break;

    lastStructuredOutput = parseStructuredOutput(llmResult.text);
    const decision = deriveAgentDecision(lastStructuredOutput);
    reply = lastStructuredOutput.reply;

    if (decision.action !== "plan_tool_use") {
      break;
    }

    const toolName = isValidTool(lastStructuredOutput.suggestedTool)
      ? lastStructuredOutput.suggestedTool
      : getDefaultToolForPlan();
    const params =
      lastStructuredOutput.toolParams && typeof lastStructuredOutput.toolParams === "object"
        ? lastStructuredOutput.toolParams
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

    const toolResultsText = toolResults
      .map((r, i) => `${i + 1}. ${r.tool}: ${r.result}`)
      .join("\n");
    currentPromptText = `${normalizedText}\n\n[Bisherige Tool-Ergebnisse:\n${toolResultsText}\n\nBitte gib deine finale Antwort (needsTool: false) oder fordere ein weiteres Tool an.]`;
  }

  if (lastLlmResult && lastStructuredOutput) {
    const lastDecision = deriveAgentDecision(lastStructuredOutput);
    return {
      summary: "Run processed with LLM",
      reply,
      intent: lastStructuredOutput.intent,
      needsTool: lastStructuredOutput.needsTool,
      suggestedTool: lastStructuredOutput.suggestedTool ?? undefined,
      toolParams:
        Object.keys(lastStructuredOutput.toolParams || {}).length
          ? lastStructuredOutput.toolParams
          : undefined,
      confidence: lastStructuredOutput.confidence,
      action: lastDecision.action,
      decisionReason: lastDecision.reason,
      toolResults: toolResults.length ? toolResults : undefined,
      analysis: {
        provider: lastLlmResult.provider,
        model: lastLlmResult.model,
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
