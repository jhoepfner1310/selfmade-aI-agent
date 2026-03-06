const { randomUUID } = require("crypto");
const { transitionRunStatus } = require("../domain/runStateMachine");
const { observeStatusTransition } = require("../observers/runObserver");
const runRepository = require("../repositories/runRepository");

/**
 * Service layer for run lifecycle orchestration.
 *
 * Responsibilities:
 * 1) Build new run objects and persist lifecycle updates.
 * 2) Enqueue runs for asynchronous worker processing.
 * 3) Keep controllers free from queue/storage details.
 */
async function enqueueRun(run) {
  const queuedRun = transitionRunStatus(run, "queued", {}, observeStatusTransition);
  await runRepository.writeRun(queuedRun);
  return queuedRun;
}

async function createRun(input) {
  // "created" is the initial persistence state before entering the queue.
  const createdRun = {
    id: randomUUID(),
    status: "created",
    createdAt: new Date().toISOString(),
    input,
  };
  await runRepository.writeRun(createdRun);

  const queuedRun = await enqueueRun(createdRun);
  const { runsQueue } = require("../queue/runQueue");
  // Publish run id to Redis so a dedicated worker can process it asynchronously.
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

async function getRun(runId) {
  return runRepository.getRunById(runId);
}

module.exports = {
  createRun,
  listRuns,
  getRun,
};
