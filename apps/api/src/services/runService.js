const { randomUUID } = require("crypto");
const { transitionRunStatus } = require("../domain/runStateMachine");
const { observeStatusTransition } = require("../observers/runObserver");
const runRepository = require("../repositories/runRepository");

/**
 * Transitions a run to "queued" and persists. Used internally by createRun.
 *
 * @param {Object} run - Run with status "created"
 * @returns {Promise<Object>} Run with status "queued", queuedAt set
 */
async function enqueueRun(run) {
  const queuedRun = transitionRunStatus(run, "queued", {}, observeStatusTransition);
  await runRepository.writeRun(queuedRun);
  return queuedRun;
}

/**
 * Creates a new run: persists with status "created", transitions to "queued",
 * and publishes a job to the BullMQ runs queue. Worker picks it up asynchronously.
 *
 * @param {Object} input - { userText?: string, ... } - stored as run.input
 * @returns {Promise<Object>} The queued run
 */
async function createRun(input) {
  const createdRun = {
    id: randomUUID(),
    status: "created",
    createdAt: new Date().toISOString(),
    input,
  };
  await runRepository.writeRun(createdRun);

  const queuedRun = await enqueueRun(createdRun);
  const { runsQueue } = require("../queue/runQueue");
  await runsQueue.add(
    "process-run",
    { runId: queuedRun.id },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    },
  );
  return queuedRun;
}

async function listRuns() {
  return runRepository.getAllRuns();
}

/** Returns a single run by ID. Throws ENOENT if not found. */
async function getRun(runId) {
  return runRepository.getRunById(runId);
}

module.exports = {
  createRun,
  listRuns,
  getRun,
};
