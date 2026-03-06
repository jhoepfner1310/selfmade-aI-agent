/**
 * Factory for the worker run-processing use case.
 *
 * Keeping this logic dependency-injected makes it testable without requiring
 * a real Postgres/Redis environment.
 */
function createProcessQueuedRun({
  sleep,
  transitionRunStatus,
  observeStatusTransition,
  runRepository,
  executeRun,
  RunValidationError,
}) {
  return async function processQueuedRun(runId, options = {}) {
    const attemptsMade = Number.isInteger(options.attemptsMade) ? options.attemptsMade : 0;
    const maxAttempts = Number.isInteger(options.maxAttempts) ? options.maxAttempts : 1;

    try {
      const currentRun = await runRepository.getRunById(runId);

      // First attempt moves queued -> running. Retry attempts can start from running.
      if (currentRun.status === "queued") {
        const runningRun = transitionRunStatus(currentRun, "running", {}, observeStatusTransition);
        await runRepository.writeRun(runningRun);
      } else if (currentRun.status === "completed") {
        // Idempotent safety: a duplicate delivery should not re-process completed runs.
        return;
      } else if (currentRun.status !== "running") {
        throw new Error(`Run ${runId} is in invalid status for processing: ${currentRun.status}`);
      }

      // Simulate background processing latency.
      await sleep(2000);

      const latestRun = await runRepository.getRunById(runId);
      if (latestRun.input?.simulateFailure === true) {
        throw new Error("Simulated run failure");
      }

      const executionResult = await executeRun(latestRun.input);
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

      // Persist "failed" only for non-retryable errors or on final retry attempt.
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
