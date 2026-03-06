const test = require("node:test");
const assert = require("node:assert/strict");

const { createProcessQueuedRun } = require("./processQueuedRunCore");

class RunValidationErrorMock extends Error {
  constructor(message) {
    super(message);
    this.name = "RunValidationErrorMock";
  }
}

function createRunRepositoryMock(initialRun) {
  let state = { ...initialRun };

  return {
    async getRunById(runId) {
      if (runId !== state.id) {
        throw new Error("Run not found");
      }
      return { ...state };
    },
    async writeRun(nextRun) {
      state = { ...nextRun };
    },
    getState() {
      return { ...state };
    },
  };
}

function transitionRunStatusMock(run, nextStatus, extraFields = {}) {
  const allowed = {
    queued: ["running"],
    running: ["completed", "failed"],
  };
  const allowedNext = allowed[run.status] || [];
  if (!allowedNext.includes(nextStatus)) {
    throw new Error(`Invalid status transition: ${run.status} -> ${nextStatus}`);
  }
  return {
    ...run,
    status: nextStatus,
    ...extraFields,
  };
}

function buildSut({ initialRun, executeRunImpl }) {
  const runRepository = createRunRepositoryMock(initialRun);
  const processQueuedRun = createProcessQueuedRun({
    sleep: async () => {},
    transitionRunStatus: transitionRunStatusMock,
    observeStatusTransition: () => {},
    runRepository,
    executeRun: executeRunImpl,
    RunValidationError: RunValidationErrorMock,
  });
  return { processQueuedRun, runRepository };
}

test("processQueuedRun marks run as completed on success", async () => {
  const { processQueuedRun, runRepository } = buildSut({
    initialRun: {
      id: "run-1",
      status: "queued",
      input: { userText: "hello" },
    },
    executeRunImpl: async () => ({ summary: "ok" }),
  });

  await processQueuedRun("run-1", { attemptsMade: 0, maxAttempts: 3 });

  const state = runRepository.getState();
  assert.equal(state.status, "completed");
  assert.deepEqual(state.result, { summary: "ok" });
});

test("processQueuedRun persists failed on validation errors without waiting for last attempt", async () => {
  const { processQueuedRun, runRepository } = buildSut({
    initialRun: {
      id: "run-2",
      status: "queued",
      input: { userText: 123 },
    },
    executeRunImpl: async () => {
      throw new RunValidationErrorMock("Run input.userText must be a string");
    },
  });

  await assert.rejects(
    processQueuedRun("run-2", { attemptsMade: 0, maxAttempts: 3 }),
    (error) => error instanceof RunValidationErrorMock,
  );

  const state = runRepository.getState();
  assert.equal(state.status, "failed");
  assert.match(state.error, /^VALIDATION_ERROR:/);
});

test("processQueuedRun does not persist failed for retryable error before last attempt", async () => {
  const { processQueuedRun, runRepository } = buildSut({
    initialRun: {
      id: "run-3",
      status: "queued",
      input: { userText: "hello", simulateFailure: true },
    },
    executeRunImpl: async () => ({ summary: "unused" }),
  });

  await assert.rejects(
    processQueuedRun("run-3", { attemptsMade: 0, maxAttempts: 3 }),
    /Simulated run failure/,
  );

  const state = runRepository.getState();
  assert.equal(state.status, "running");
  assert.equal(state.error, undefined);
});

test("processQueuedRun persists failed for retryable error on final attempt", async () => {
  const { processQueuedRun, runRepository } = buildSut({
    initialRun: {
      id: "run-4",
      status: "queued",
      input: { userText: "hello", simulateFailure: true },
    },
    executeRunImpl: async () => ({ summary: "unused" }),
  });

  await assert.rejects(
    processQueuedRun("run-4", { attemptsMade: 2, maxAttempts: 3 }),
    /Simulated run failure/,
  );

  const state = runRepository.getState();
  assert.equal(state.status, "failed");
  assert.match(state.error, /^PROCESSING_ERROR:/);
});
