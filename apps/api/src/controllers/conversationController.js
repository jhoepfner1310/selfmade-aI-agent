const { sendJson } = require("../utils/http");
const conversationService = require("../services/conversationService");
const { readJsonBody } = require("../utils/readJsonBody");

/**
 * Creates a new conversation.
 * POST /conversations
 */
async function createConversation(req, res) {
  const conversation = await conversationService.createConversation();
  return sendJson(res, 201, conversation);
}

/**
 * Adds a message to a conversation and enqueues for processing.
 * POST /conversations/:id/messages
 * Body: { userText: string }
 */
async function addMessage(req, res, conversationId) {
  if (!conversationId) {
    return sendJson(res, 400, { error: "Conversation id is required" });
  }
  const body = await readJsonBody(req);
  const userText = typeof body?.userText === "string" ? body.userText.trim() : "";
  if (!userText) {
    return sendJson(res, 400, { error: "userText is required" });
  }
  try {
    const { runId, messageId } = await conversationService.addMessage(conversationId, userText);
    return sendJson(res, 202, { runId, messageId });
  } catch (err) {
    if (err.code === "ENOENT") {
      return sendJson(res, 404, { error: "Conversation not found" });
    }
    throw err;
  }
}

/**
 * Returns a conversation with all messages.
 * GET /conversations/:id
 */
async function getConversation(req, res, conversationId) {
  if (!conversationId) {
    return sendJson(res, 400, { error: "Conversation id is required" });
  }
  try {
    const conversation = await conversationService.getConversation(conversationId);
    return sendJson(res, 200, conversation);
  } catch (err) {
    if (err.code === "ENOENT") {
      return sendJson(res, 404, { error: "Conversation not found" });
    }
    throw err;
  }
}

module.exports = {
  createConversation,
  addMessage,
  getConversation,
};
