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
 * @param {Object} [deps.conversationRepository] - getMessages, addMessage (for multi-turn)
 * @param {Function} deps.executeRun - Core execution logic
 * @param {typeof RunValidationError} deps.RunValidationError - Validation error class
 * @returns {Function} processQueuedRun(runId, options)
 */
function createProcessQueuedRun({
  sleep,
  transitionRunStatus,
  observeStatusTransition,
  runRepository,
  conversationRepository,
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

      // First-time processing: transition queued -> running.
      if (currentRun.status === "queued") {
        try {
          const runningRun = transitionRunStatus(currentRun, "running", {}, observeStatusTransition);
          await runRepository.writeRun(runningRun);
          currentRun = runningRun;
        } catch (error) {
          // transitionRunStatus may throw if another process already transitioned (invalid transition).
          // Race: another worker/retry may have already transitioned; reload to get latest state.
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
        return;
      } else if (currentRun.status !== "running") {
        // Invalid: e.g. created, failed, or unknown status; cannot process.
        throw new Error(`Run ${runId} is in invalid status for processing: ${currentRun.status}`);
      }

      await sleep(2000);

      const latestRun = await runRepository.getRunById(runId);
      // Test hook: input.simulateFailure triggers a failure for testing retry logic.
      if (latestRun.input?.simulateFailure === true) {
        throw new Error("Simulated run failure");
      }

      let runInput = { ...latestRun.input };
      if (runInput.conversationId && conversationRepository) {
        const messages = await conversationRepository.getMessages(runInput.conversationId);
        runInput.conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }));
      }

      const executionResult = await executeRun(runInput);
      const reply = typeof executionResult?.reply === "string" ? executionResult.reply : "";
      const replyPreview = reply.slice(0, 280);

      // Log execution result for observability (reply preview, intent, tool results)
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
        { result: executionResult },
        observeStatusTransition,
      );
      await runRepository.writeRun(completedRun);

      if (runInput.conversationId && conversationRepository && executionResult?.reply) {
        const { randomUUID } = require("crypto");
        await conversationRepository.addMessage(
          randomUUID(),
          runInput.conversationId,
          "assistant",
          executionResult.reply,
          new Date().toISOString()
        );
      }
    } catch (error) {
      // Distinguish validation errors (non-retryable) from processing errors (may retry)
      const errorCode = error instanceof RunValidationError ? "VALIDATION_ERROR" : "PROCESSING_ERROR";
      const errorMessage = error?.message || "Unknown processing error";
      const isLastAttempt = attemptsMade + 1 >= maxAttempts;
      const shouldPersistFailure = error instanceof RunValidationError || isLastAttempt;

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

      throw error;
    }
  };
}

module.exports = {
  createProcessQueuedRun,
};
