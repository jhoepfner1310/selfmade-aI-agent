const getCurrentTime = require("./getCurrentTime");

/**
 * Registry of available tools. Each tool must expose:
 * - name: string (unique identifier)
 * - description: string (for LLM prompt)
 * - execute: async (params) => { success, result, toolName }
 */
const TOOLS = {
  [getCurrentTime.name]: getCurrentTime,
};

/**
 * Returns a semicolon-separated list of "name - description" for injection
 * into the LLM system prompt. Enables the LLM to know which tools exist.
 *
 * @returns {string} e.g. "get_current_time - Ermittelt die aktuelle Systemzeit."
 */
function getToolListForPrompt() {
  return Object.entries(TOOLS)
    .map(([name, tool]) => `${name} - ${tool.description || "Keine Beschreibung"}`)
    .join("; ");
}

/**
 * Returns array of valid tool names for validation.
 *
 * @returns {string[]}
 */
function getAvailableToolNames() {
  return Object.keys(TOOLS);
}

/**
 * Checks whether a tool name is registered and valid.
 *
 * @param {string} toolName - Tool name from LLM (suggestedTool)
 * @returns {boolean}
 */
function isValidTool(toolName) {
  return typeof toolName === "string" && toolName.trim() && toolName in TOOLS;
}

/**
 * Executes a registered tool by name with the given parameters.
 *
 * @param {string} toolName - Name of the tool (must be in TOOLS)
 * @param {Object} [params={}] - Parameters passed to tool.execute()
 * @returns {Promise<{ success: boolean, result?: *, error?: string, toolName: string }>}
 */
async function executeTool(toolName, params = {}) {
  const tool = TOOLS[toolName];
  if (!tool || typeof tool.execute !== "function") {
    return {
      success: false,
      error: `Unknown or invalid tool: ${toolName}`,
      toolName: toolName || "unknown",
    };
  }

  try {
    const outcome = await tool.execute(params);
    return {
      success: outcome?.success !== false,
      result: outcome?.result,
      toolName: outcome?.toolName ?? tool.name,
    };
  } catch (err) {
    return {
      success: false,
      error: err?.message || "Tool execution failed",
      toolName: tool.name,
    };
  }
}

/**
 * Returns the default tool name when the LLM suggests an invalid or missing tool.
 * Used as fallback in executeRun when suggestedTool is not in the registry.
 *
 * @returns {string} Tool name (e.g. "get_current_time")
 */
function getDefaultToolForPlan() {
  return getCurrentTime.name;
}

module.exports = {
  executeTool,
  getDefaultToolForPlan,
  getToolListForPrompt,
  getAvailableToolNames,
  isValidTool,
};
