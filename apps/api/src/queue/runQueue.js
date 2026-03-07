const IORedis = require("ioredis");
const { Queue } = require("bullmq");
const { RUNS_QUEUE_NAME } = require("./constants");

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

/**
 * Shared Redis connection and BullMQ queue for run jobs.
 * API publishes jobs via runsQueue.add(); worker subscribes via BullMQ Worker.
 */
const redisConnection = new IORedis(redisUrl);

const runsQueue = new Queue(RUNS_QUEUE_NAME, {
  connection: redisConnection,
});

/** Closes the queue and Redis connection. For tests/shutdown. */
async function closeRunsQueue() {
  await runsQueue.close();
  await redisConnection.quit();
}

module.exports = {
  RUNS_QUEUE_NAME,
  runsQueue,
  closeRunsQueue,
};
