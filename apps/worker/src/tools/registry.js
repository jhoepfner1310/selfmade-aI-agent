const getCurrentTime = require("./getCurrentTime");

const TOOLS = {
  [getCurrentTime.name]: getCurrentTime,
};

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
 * Get the first available tool for plan_tool_use.
 * Later we can let the LLM specify which tool it needs.
 */
function getDefaultToolForPlan() {
  return getCurrentTime.name;
}

module.exports = {
  executeTool,
  getDefaultToolForPlan,
};
