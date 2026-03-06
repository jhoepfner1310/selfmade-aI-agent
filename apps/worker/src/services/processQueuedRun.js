const { sleep } = require("../../../api/src/utils/sleep");
const { transitionRunStatus } = require("../../../api/src/domain/runStateMachine");
const { observeStatusTransition } = require("../../../api/src/observers/runObserver");
const runRepository = require("../../../api/src/repositories/runRepository");
const { executeRun, RunValidationError } = require("./executeRun");
const { createProcessQueuedRun } = require("./processQueuedRunCore");

/**
 * Worker-side run processing use case.
 *
 * Responsibilities:
 * 1) Move queued runs through running/completed or failed states.
 * 2) Persist lifecycle changes to the shared run repository.
 * 3) Keep worker entrypoint thin by isolating processing logic here.
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
