require("dotenv").config();

const IORedis = require("ioredis");
const { Worker, UnrecoverableError } = require("bullmq");
const runRepository = require("../../api/src/repositories/runRepository");
const { processQueuedRun } = require("./services/processQueuedRun");
const { RunValidationError } = require("./services/executeRun");
const { createWorkerMetrics } = require("./observability/workerMetrics");
const { RUNS_QUEUE_NAME } = require("../../api/src/queue/constants");

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
  const metrics = createWorkerMetrics();

  /** Logs a structured JSON event with metrics snapshot. */
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

  const worker = new Worker(
    RUNS_QUEUE_NAME,
    async (job) => {
      metrics.markAttemptStarted();

      if (job.name !== "process-run") {
        throw new Error(`Unknown job name: ${job.name}`);
      }

      const runId = job.data?.runId;
      if (!runId) {
        throw new Error("Job payload is missing runId");
      }

      const maxAttempts = Number(job.opts?.attempts || 1);

      try {
        await processQueuedRun(runId, {
          attemptsMade: job.attemptsMade,
          maxAttempts,
        });
      } catch (error) {
        if (error instanceof RunValidationError) {
          throw new UnrecoverableError(error.message);
        }
        throw error;
      }
    },
    {
      connection: workerConnection,
    },
  );

  worker.on("ready", () => {
    logWorkerEvent("info", "worker_ready");
  });

  worker.on("active", (job) => {
    logWorkerEvent("info", "job_active", {
      jobId: job.id,
      jobName: job.name,
      runId: job.data?.runId,
      attemptsMade: job.attemptsMade,
      maxAttempts: Number(job.opts?.attempts || 1),
    });
  });

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

  const shutdown = async (signal) => {
    logWorkerEvent("info", "worker_shutdown_requested", { signal });
    await worker.close();
    await workerConnection.quit();
    process.exit(0);
  };

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
