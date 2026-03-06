function createWorkerMetrics() {
  const state = {
    startedAt: new Date().toISOString(),
    attemptsStarted: 0,
    completedJobs: 0,
    retriedAttempts: 0,
    failedJobs: 0,
  };

  return {
    markAttemptStarted() {
      state.attemptsStarted += 1;
    },
    markCompletedJob() {
      state.completedJobs += 1;
    },
    markRetriedAttempt() {
      state.retriedAttempts += 1;
    },
    markFailedJob() {
      state.failedJobs += 1;
    },
    snapshot() {
      return { ...state };
    },
  };
}

module.exports = {
  createWorkerMetrics,
};
