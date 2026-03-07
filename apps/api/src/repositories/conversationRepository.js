const db = require("../db/postgres");

/**
 * Ensures conversations and messages tables exist.
 */
async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL,
      session_id TEXT
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
  `);
  try {
    await db.query(`ALTER TABLE conversations ADD COLUMN session_id TEXT`);
  } catch (e) {
    if (e.code !== "42701") throw e;
  }
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
  `);
}

/**
 * @param {Object} row - DB row
 * @returns {Object} API shape
 */
function mapRowToMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at.toISOString(),
  };
}

async function createConversation(id, createdAt, sessionId = null) {
  await db.query(
    `INSERT INTO conversations (id, created_at, session_id) VALUES ($1, $2, $3)`,
    [id, createdAt, sessionId]
  );
}

async function getConversation(id) {
  const { rows } = await db.query("SELECT * FROM conversations WHERE id = $1 LIMIT 1;", [id]);
  const row = rows[0];
  if (!row) {
    const err = new Error("Conversation not found");
    err.code = "ENOENT";
    throw err;
  }
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
  };
}

async function addMessage(id, conversationId, role, content, createdAt) {
  await db.query(
    `INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [id, conversationId, role, content, createdAt]
  );
}

async function getMessages(conversationId) {
  const { rows } = await db.query(
    "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC;",
    [conversationId]
  );
  return rows.map(mapRowToMessage);
}

/**
 * Lists conversations, newest first, with latest message preview.
 * When sessionId is provided, only returns conversations for that session.
 * @param {string|null} [sessionId] - Optional session filter
 * @returns {Promise<Array<{ id: string, createdAt: string, preview: string }>>}
 */
async function listConversations(sessionId = null) {
  const query = sessionId
    ? `SELECT c.id, c.created_at,
      (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS latest_content
    FROM conversations c
    WHERE c.session_id = $1
    ORDER BY c.created_at DESC`
    : `SELECT c.id, c.created_at,
      (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS latest_content
    FROM conversations c
    ORDER BY c.created_at DESC`;
  const params = sessionId ? [sessionId] : [];
  const { rows } = await db.query(query, params);
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at.toISOString(),
    preview: r.latest_content ? String(r.latest_content).slice(0, 80) : "",
  }));
}

module.exports = {
  ensureTables,
  createConversation,
  getConversation,
  addMessage,
  getMessages,
  listConversations,
};
