const { sleep } = require("../../../api/src/utils/sleep");
const { transitionRunStatus } = require("../../../api/src/domain/runStateMachine");
const { observeStatusTransition } = require("../../../api/src/observers/runObserver");
const runRepository = require("../../../api/src/repositories/runRepository");
const { executeRun, RunValidationError } = require("./executeRun");
const { createProcessQueuedRun } = require("./processQueuedRunCore");

/**
 * Worker-side run processing use case.
 *
 * Wires the processQueuedRunCore factory with real implementations:
 * - sleep: delay between state transitions
 * - transitionRunStatus: run state machine (queued -> running -> completed/failed)
 * - runRepository: Postgres persistence
 * - executeRun: LLM + tool invocation logic
 *
 * The worker entrypoint (runWorker.js) subscribes to the BullMQ queue and
 * calls this function for each job.
 */
const processQueuedRun = createProcessQueuedRun({
  sleep,
  transitionRunStatus,
  observeStatusTransition,
  runRepository,
  executeRun,
  RunValidationError,
});

module.exports = {
  processQueuedRun,
};
