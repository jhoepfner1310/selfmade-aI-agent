/**
 * Tool: returns current system time in ISO 8601 format.
 * Does not use params; included as the first demo tool for plan_tool_use.
 *
 * @param {Object} [_params] - Ignored (tool has no parameters)
 * @returns {Promise<{ success: boolean, result: string, toolName: string }>}
 */
async function execute() {
  // Return ISO 8601 string (e.g. "2025-03-06T14:30:00.000Z"); registry expects success, result, toolName
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
