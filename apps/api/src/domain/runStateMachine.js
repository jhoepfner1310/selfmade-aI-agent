const ALLOWED_STATUS_TRANSITIONS = {
  created: ["queued"],
  queued: ["running"],
  running: ["completed", "failed"],
  completed: [],
  failed: [],
};

const STATUS_TIMESTAMP_FIELDS = {
  queued: "queuedAt",
  running: "runningAt",
  completed: "completedAt",
  failed: "failedAt",
};

/**
 * Transition a run to the next status with validation.
 *
 * Guarantees:
 * 1) Illegal transitions throw immediately.
 * 2) Status-specific timestamps are written automatically.
 * 3) Optional transition observer is notified after state change is built.
 */
function transitionRunStatus(run, nextStatus, extraFields = {}, observeStatusTransition) {
  const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[run.status] || [];
  if (!allowedNextStatuses.includes(nextStatus)) {
    throw new Error(`Invalid status transition: ${run.status} -> ${nextStatus}`);
  }

  const timestampField = STATUS_TIMESTAMP_FIELDS[nextStatus];
  const transitionedRun = {
    ...run,
    status: nextStatus,
    ...(timestampField ? { [timestampField]: new Date().toISOString() } : {}),
    ...extraFields,
  };

  if (typeof observeStatusTransition === "function") {
    observeStatusTransition({
      runId: run.id,
      from: run.status,
      to: nextStatus,
    });
  }

  return transitionedRun;
}

module.exports = {
  transitionRunStatus,
};
