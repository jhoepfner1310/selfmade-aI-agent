const { randomUUID } = require("crypto");
const conversationRepository = require("../repositories/conversationRepository");
const runRepository = require("../repositories/runRepository");
const { transitionRunStatus } = require("../domain/runStateMachine");
const { observeStatusTransition } = require("../observers/runObserver");
const { runsQueue } = require("../queue/runQueue");

/**
 * Creates a new conversation.
 * @param {string|null} [sessionId] - Optional session for scoping
 * @returns {Promise<{ id: string, createdAt: string }>}
 */
async function createConversation(sessionId = null) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await conversationRepository.createConversation(id, createdAt, sessionId);
  return { id, createdAt };
}

/**
 * Adds a user message to a conversation, creates a run, and enqueues for processing.
 * @param {string} conversationId - Conversation ID
 * @param {string} userText - User message
 * @returns {Promise<{ runId: string, messageId: string }>}
 */
async function addMessage(conversationId, userText) {
  await conversationRepository.getConversation(conversationId);

  const messageId = randomUUID();
  const now = new Date().toISOString();
  await conversationRepository.addMessage(messageId, conversationId, "user", userText, now);

  const run = {
    id: randomUUID(),
    status: "created",
    createdAt: now,
    input: { userText, conversationId },
  };
  await runRepository.writeRun(run);

  const queuedRun = transitionRunStatus(run, "queued", {}, observeStatusTransition);
  await runRepository.writeRun(queuedRun);

  await runsQueue.add(
    "process-run",
    { runId: queuedRun.id },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: false,
      removeOnFail: false,
    }
  );

  return { runId: queuedRun.id, messageId };
}

/**
 * Returns a conversation with all messages.
 * @param {string} conversationId
 * @returns {Promise<{ id: string, createdAt: string, messages: Array }>}
 */
async function getConversation(conversationId) {
  const conv = await conversationRepository.getConversation(conversationId);
  const messages = await conversationRepository.getMessages(conversationId);
  return { ...conv, messages };
}

/**
 * Lists conversations with preview, newest first.
 * @param {string|null} [sessionId] - Optional session filter
 * @returns {Promise<Array<{ id: string, createdAt: string, preview: string }>>}
 */
async function listConversations(sessionId = null) {
  return conversationRepository.listConversations(sessionId);
}

module.exports = {
  createConversation,
  addMessage,
  getConversation,
  listConversations,
};
