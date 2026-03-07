const { getLlmProvider } = require("../llm/providerFactory");
const { deriveAgentDecision } = require("../llm/agentDecision");
const { parseStructuredOutput } = require("../llm/structuredOutput");
const { executeTool, getDefaultToolForPlan, isValidTool } = require("../tools/registry");

/**
 * Worker-side execution use case.
 *
 * This function encapsulates the actual "run execution" behavior so that
 * the orchestration flow in processQueuedRun stays focused on state updates.
 * For now this is a deterministic mock implementation and can later be
 * replaced by real LLM/tool invocation logic without changing worker flow.
 */
class RunValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RunValidationError";
  }
}

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
