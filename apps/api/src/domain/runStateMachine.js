/**
 * Valid state transitions. Keys are current status, values are allowed next statuses.
 */
const ALLOWED_STATUS_TRANSITIONS = {
  created: ["queued"],
  queued: ["running"],
  running: ["completed", "failed"],
  completed: [],
  failed: [],
};

/**
 * Maps status to the timestamp field to set when transitioning (e.g. running -> runningAt).
 */
const STATUS_TIMESTAMP_FIELDS = {
  queued: "queuedAt",
  running: "runningAt",
  completed: "completedAt",
  failed: "failedAt",
};

/**
 * Transitions a run to the next status. Validates against ALLOWED_STATUS_TRANSITIONS,
 * sets the appropriate timestamp, merges extraFields (e.g. result, error), and
 * optionally notifies an observer.
 *
 * @param {Object} run - Current run object
 * @param {string} nextStatus - Target status
 * @param {Object} [extraFields={}] - Additional fields to merge (e.g. { result }, { error })
 * @param {Function} [observeStatusTransition] - Callback({ runId, from, to })
 * @returns {Object} New run object with updated status and fields
 */
function transitionRunStatus(run, nextStatus, extraFields = {}, observeStatusTransition) {
  const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[run.status] || [];
  // Validate: e.g. queued->running ok, queued->completed invalid
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
