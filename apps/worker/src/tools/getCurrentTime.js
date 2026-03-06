/**
 * Simple tool: returns current system time in ISO format.
 * Used as first demo tool when the agent signals plan_tool_use.
 */
async function execute() {
  return {
    success: true,
    result: new Date().toISOString(),
    toolName: "get_current_time",
  };
}

module.exports = {
  execute,
  name: "get_current_time",
  description: "Ermittelt die aktuelle Systemzeit.",
};
