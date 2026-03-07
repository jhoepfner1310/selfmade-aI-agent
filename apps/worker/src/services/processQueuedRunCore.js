/**
 * Factory that creates the processQueuedRun function with injected dependencies.
 * This pattern allows unit tests to mock sleep, runRepository, executeRun, etc.
 * without needing a real Postgres/Redis setup.
 *
 * @param {Object} deps - Injected dependencies
 * @param {Function} deps.sleep - Async delay (ms)
 * @param {Function} deps.transitionRunStatus - State machine transition
 * @param {Function} deps.observeStatusTransition - Observer for status changes
 * @param {Object} deps.runRepository - getRunById, writeRun
 * @param {Function} deps.executeRun - Core execution logic
 * @param {typeof RunValidationError} deps.RunValidationError - Validation error class
 * @returns {Function} processQueuedRun(runId, options)
 */
function createProcessQueuedRun({
  sleep,
  transitionRunStatus,
  observeStatusTransition,
  runRepository,
  executeRun,
  RunValidationError,
}) {
  /**
   * Processes a single queued run: transitions to running, executes via executeRun,
   * persists result or failure. Handles retries and idempotency (e.g. duplicate
   * deliveries when run is already completed).
   *
   * @param {string} runId - ID of the run to process
   * @param {Object} options - BullMQ job metadata
   * @param {number} options.attemptsMade - Current attempt count
   * @param {number} options.maxAttempts - Max retries before giving up
   */
  return async function processQueuedRun(runId, options = {}) {
    const attemptsMade = Number.isInteger(options.attemptsMade) ? options.attemptsMade : 0;
    const maxAttempts = Number.isInteger(options.maxAttempts) ? options.maxAttempts : 1;

    try {
      let currentRun = await runRepository.getRunById(runId);

      // First attempt: transition queued -> running. Retries may find run already running.
      if (currentRun.status === "queued") {
        try {
          const runningRun = transitionRunStatus(currentRun, "running", {}, observeStatusTransition);
          await runRepository.writeRun(runningRun);
          currentRun = runningRun;
        } catch (error) {
          // Race condition: another worker/retry may have already transitioned this run.
          const latestRun = await runRepository.getRunById(runId);
          if (latestRun.status === "running") {
            currentRun = latestRun;
          } else if (latestRun.status === "completed") {
            return;
          } else {
            throw error;
          }
        }
      } else if (currentRun.status === "completed") {
        // Idempotent safety: a duplicate delivery should not re-process completed runs.
        return;
      } else if (currentRun.status !== "running") {
        throw new Error(`Run ${runId} is in invalid status for processing: ${currentRun.status}`);
      }

      // Simulated processing delay (e.g. for rate limiting or UX).
      await sleep(2000);

      const latestRun = await runRepository.getRunById(runId);
      if (latestRun.input?.simulateFailure === true) {
        throw new Error("Simulated run failure");
      }

      const executionResult = await executeRun(latestRun.input);
      // Log result for observability (structured JSON for log aggregation).
      const reply = typeof executionResult?.reply === "string" ? executionResult.reply : "";
      const replyPreview = reply.slice(0, 280);

      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "info",
          event: "run_execution_result",
          runId,
          hasReply: Boolean(reply),
          replyPreview,
          replyLength: reply.length,
          intent: executionResult?.intent,
          needsTool: executionResult?.needsTool,
          action: executionResult?.action,
          toolResults: executionResult?.toolResults,
        }),
      );

      const completedRun = transitionRunStatus(
        latestRun,
        "completed",
        {
          result: executionResult,
        },
        observeStatusTransition,
      );
      await runRepository.writeRun(completedRun);
    } catch (error) {
      const errorCode = error instanceof RunValidationError ? "VALIDATION_ERROR" : "PROCESSING_ERROR";
      const errorMessage = error?.message || "Unknown processing error";
      const isLastAttempt = attemptsMade + 1 >= maxAttempts;
      const shouldPersistFailure = error instanceof RunValidationError || isLastAttempt;

      // Only persist "failed" when: validation error (no retry) or final retry exhausted.
      if (shouldPersistFailure) {
        try {
          const latestRun = await runRepository.getRunById(runId);

          if (latestRun.status === "running") {
            const failedRun = transitionRunStatus(
              latestRun,
              "failed",
              {
                error: `${errorCode}: ${errorMessage}`,
              },
              observeStatusTransition,
            );
            await runRepository.writeRun(failedRun);
          }
        } catch (innerError) {
          console.error("Failed to mark run as failed:", innerError);
        }
      }

      // Re-throw so BullMQ can apply retry policy.
      throw error;
    }
  };
}

module.exports = {
  createProcessQueuedRun,
};
