const test = require("node:test");
const assert = require("node:assert/strict");

const { createWorkerMetrics } = require("./workerMetrics");

test("workerMetrics tracks attempt and outcome counters", () => {
  const metrics = createWorkerMetrics();

  metrics.markAttemptStarted();
  metrics.markAttemptStarted();
  metrics.markCompletedJob();
  metrics.markRetriedAttempt();
  metrics.markFailedJob();

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.attemptsStarted, 2);
  assert.equal(snapshot.completedJobs, 1);
  assert.equal(snapshot.retriedAttempts, 1);
  assert.equal(snapshot.failedJobs, 1);
  assert.equal(typeof snapshot.startedAt, "string");
});
