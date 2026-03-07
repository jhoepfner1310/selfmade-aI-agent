require("dotenv").config();

const IORedis = require("ioredis");
const { Worker, UnrecoverableError } = require("bullmq");
const runRepository = require("../../api/src/repositories/runRepository");
const conversationRepository = require("../../api/src/repositories/conversationRepository");
const { processQueuedRun } = require("./services/processQueuedRun");
const { RunValidationError } = require("./services/executeRun");
const { createWorkerMetrics } = require("./observability/workerMetrics");
const { RUNS_QUEUE_NAME } = require("../../api/src/queue/constants");

// Redis URL from env; required for BullMQ queue connection
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

/**
 * BullMQ requires maxRetriesPerRequest=null for blocking Redis commands
 * (e.g. BLPOP used by the worker to wait for jobs).
 */
const workerConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

/**
 * Worker process entrypoint. Subscribes to the runs queue, processes jobs
 * via processQueuedRun, and logs lifecycle events. Handles SIGINT/SIGTERM
 * for graceful shutdown.
 */
async function startRunWorker() {
  await runRepository.ensureRunsDir();
  await conversationRepository.ensureTables();
  const metrics = createWorkerMetrics();

  // Logs structured JSON events (worker_ready, job_active, job_completed, job_failed, etc.)
  function logWorkerEvent(level, event, details = {}) {
    const payload = {
      ts: new Date().toISOString(),
      level,
      event,
      queue: RUNS_QUEUE_NAME,
      ...details,
      metrics: metrics.snapshot(),
    };
    const line = JSON.stringify(payload);
    if (level === "error") {
      console.error(line);
      return;
    }
    console.log(line);
  }

  // Create BullMQ Worker: listens to RUNS_QUEUE_NAME and invokes handler for each job
  const worker = new Worker(
    RUNS_QUEUE_NAME,
    async (job) => {
      // Increment metrics counter for each processing attempt (for observability)
      metrics.markAttemptStarted();

      // Only "process-run" jobs are supported; reject any other job type
      if (job.name !== "process-run") {
        throw new Error(`Unknown job name: ${job.name}`);
      }

      // Extract runId from job payload; required to load and process the run
      const runId = job.data?.runId;
      if (!runId) {
        throw new Error("Job payload is missing runId");
      }

      // Max retries from job options; used by processQueuedRun for idempotency checks
      const maxAttempts = Number(job.opts?.attempts || 1);

      try {
        // Delegate to processQueuedRun: load run, transition status, execute LLM, persist result
        await processQueuedRun(runId, {
          attemptsMade: job.attemptsMade,
          maxAttempts,
        });
      } catch (error) {
        // RunValidationError = invalid input; mark as UnrecoverableError so BullMQ won't retry
        if (error instanceof RunValidationError) {
          throw new UnrecoverableError(error.message);
        }
        // Re-throw other errors so BullMQ can retry according to queue config
        throw error;
      }
    },
    {
      connection: workerConnection,
    },
  );

  // Worker connected to Redis and ready to accept jobs
  worker.on("ready", () => {
    logWorkerEvent("info", "worker_ready");
  });

  // Job picked up and handler is about to run
  worker.on("active", (job) => {
    logWorkerEvent("info", "job_active", {
      jobId: job.id,
      jobName: job.name,
      runId: job.data?.runId,
      attemptsMade: job.attemptsMade,
      maxAttempts: Number(job.opts?.attempts || 1),
    });
  });

  // Job finished successfully
  worker.on("completed", (job) => {
    metrics.markCompletedJob();
    logWorkerEvent("info", "job_completed", {
      jobId: job.id,
      jobName: job.name,
      runId: job.data?.runId,
      attemptsMade: job.attemptsMade,
      maxAttempts: Number(job.opts?.attempts || 1),
    });
  });

  // Job failed (handler threw); may retry depending on attempts
  worker.on("failed", (job, error) => {
    const attemptsMade = Number(job?.attemptsMade || 0);
    const maxAttempts = Number(job?.opts?.attempts || 1);
    const willRetry = attemptsMade < maxAttempts;

    if (willRetry) {
      metrics.markRetriedAttempt();
    } else {
      metrics.markFailedJob();
    }

    logWorkerEvent("error", "job_failed", {
      jobId: job?.id || "unknown",
      jobName: job?.name || "unknown",
      runId: job?.data?.runId,
      attemptsMade,
      maxAttempts,
      willRetry,
      errorName: error?.name || "Error",
      errorMessage: error?.message || "Unknown worker error",
    });
  });

  // Graceful shutdown: close worker, disconnect Redis, exit cleanly
  const shutdown = async (signal) => {
    logWorkerEvent("info", "worker_shutdown_requested", { signal });
    await worker.close();
    await workerConnection.quit();
    process.exit(0);
  };

  // Handle Ctrl+C: trigger shutdown; on error log and exit with code 1
  process.on("SIGINT", () => {
    shutdown("SIGINT").catch((error) => {
      logWorkerEvent("error", "worker_shutdown_error", {
        signal: "SIGINT",
        errorName: error?.name || "Error",
        errorMessage: error?.message || "Unknown shutdown error",
      });
      process.exit(1);
    });
  });

  // Handle kill/terminate (e.g. Docker stop): same as SIGINT
  process.on("SIGTERM", () => {
    shutdown("SIGTERM").catch((error) => {
      logWorkerEvent("error", "worker_shutdown_error", {
        signal: "SIGTERM",
        errorName: error?.name || "Error",
        errorMessage: error?.message || "Unknown shutdown error",
      });
      process.exit(1);
    });
  });
}

// Start worker; on failure (e.g. Redis unreachable) log and exit with code 1
startRunWorker().catch((error) => {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      event: "worker_start_error",
      queue: RUNS_QUEUE_NAME,
      errorName: error?.name || "Error",
      errorMessage: error?.message || "Unknown startup error",
    }),
  );
  process.exit(1);
});
