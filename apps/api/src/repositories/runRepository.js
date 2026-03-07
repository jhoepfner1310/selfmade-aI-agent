const db = require("../db/postgres");

/**
 * PostgreSQL repository for persisted run records.
 *
 * Responsibilities:
 * 1) Ensure the `runs` table exists at startup.
 * 2) Persist lifecycle updates via upsert semantics.
 * 3) Return run objects in the same shape expected by services/controllers.
 */
/**
 * Ensures the runs table exists. Called at API and worker startup.
 * Method name kept for compatibility with bootstrap flow.
 */
async function ensureRunsDir() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      queued_at TIMESTAMPTZ,
      running_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ,
      input JSONB NOT NULL DEFAULT '{}'::jsonb,
      result JSONB,
      error TEXT
    );
  `);
}

/** Maps a Postgres row (snake_case, Date) to API shape (camelCase, ISO strings). */
function mapRowToRun(row) {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    queuedAt: row.queued_at ? row.queued_at.toISOString() : undefined,
    runningAt: row.running_at ? row.running_at.toISOString() : undefined,
    completedAt: row.completed_at ? row.completed_at.toISOString() : undefined,
    failedAt: row.failed_at ? row.failed_at.toISOString() : undefined,
    input: row.input || {},
    result: row.result || undefined,
    error: row.error || undefined,
  };
}

/**
 * Upserts a run. Inserts if new, updates if id exists.
 * Single method for both create and update.
 */
async function writeRun(run) {
  await db.query(
    `
      INSERT INTO runs (
        id, status, created_at, queued_at, running_at, completed_at, failed_at, input, result, error
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id)
      DO UPDATE SET
        status = EXCLUDED.status,
        created_at = EXCLUDED.created_at,
        queued_at = EXCLUDED.queued_at,
        running_at = EXCLUDED.running_at,
        completed_at = EXCLUDED.completed_at,
        failed_at = EXCLUDED.failed_at,
        input = EXCLUDED.input,
        result = EXCLUDED.result,
        error = EXCLUDED.error;
    `,
    [
      run.id,
      run.status,
      run.createdAt,
      run.queuedAt || null,
      run.runningAt || null,
      run.completedAt || null,
      run.failedAt || null,
      run.input || {},
      run.result || null,
      run.error || null,
    ],
  );
}

/**
 * Fetches a run by ID. Throws with code ENOENT if not found (for app.js 404 mapping).
 */
async function getRunById(id) {
  const { rows } = await db.query("SELECT * FROM runs WHERE id = $1 LIMIT 1;", [id]);
  const row = rows[0];
  if (!row) {
    const notFoundError = new Error("Run not found");
    notFoundError.code = "ENOENT";
    throw notFoundError;
  }
  return mapRowToRun(row);
}

/** Returns all runs, newest first. */
async function getAllRuns() {
  const { rows } = await db.query("SELECT * FROM runs ORDER BY created_at DESC;");
  return rows.map(mapRowToRun);
}

module.exports = {
  ensureRunsDir,
  writeRun,
  getRunById,
  getAllRuns,
};
