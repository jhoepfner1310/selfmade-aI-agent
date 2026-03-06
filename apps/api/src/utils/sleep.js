/**
 * Promise-based delay helper for async flows.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  sleep,
};
