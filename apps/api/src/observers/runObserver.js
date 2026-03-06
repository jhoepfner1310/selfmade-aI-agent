/**
 * Observer hook for run lifecycle transitions.
 *
 * This keeps side effects (currently logging) decoupled from state-machine logic.
 */
function observeStatusTransition({ runId, from, to }) {
  console.log(`[Status changed: run:${runId}] ${from} -> ${to}`);
}

module.exports = {
  observeStatusTransition,
};
