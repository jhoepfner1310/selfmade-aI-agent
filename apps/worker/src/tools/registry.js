const getCurrentTime = require("./getCurrentTime");

const TOOLS = {
  [getCurrentTime.name]: getCurrentTime,
};

/**
 * Returns tool names and descriptions for the LLM prompt.
 */
function getToolListForPrompt() {
  return Object.entries(TOOLS)
    .map(([name, tool]) => `${name} - ${tool.description || "Keine Beschreibung"}`)
    .join("; ");
}

/**
 * Returns array of valid tool names for validation.
 */
function getAvailableToolNames() {
  return Object.keys(TOOLS);
}

function isValidTool(toolName) {
  return typeof toolName === "string" && toolName.trim() && toolName in TOOLS;
}

/**
 * Execute a registered tool by name.
 * Returns { success, result, toolName } or { success: false, error }.
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
 * Fallback tool when LLM does not suggest a valid tool.
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
