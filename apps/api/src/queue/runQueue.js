const IORedis = require("ioredis");
const { Queue } = require("bullmq");
const { RUNS_QUEUE_NAME } = require("./constants");

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

/**
 * Shared Redis connection + BullMQ queue for run jobs.
 *
 * This module only defines queue infrastructure.
 * Job publishing/processing will be wired in follow-up steps.
 */
const redisConnection = new IORedis(redisUrl);

const runsQueue = new Queue(RUNS_QUEUE_NAME, {
  connection: redisConnection,
});

async function closeRunsQueue() {
  await runsQueue.close();
  await redisConnection.quit();
}

module.exports = {
  RUNS_QUEUE_NAME,
  runsQueue,
  closeRunsQueue,
};
