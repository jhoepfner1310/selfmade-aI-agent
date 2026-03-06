const db = require("../db/postgres");

/**
 * PostgreSQL repository for persisted run records.
 *
 * Responsibilities:
 * 1) Ensure the `runs` table exists at startup.
 * 2) Persist lifecycle updates via upsert semantics.
 * 3) Return run objects in the same shape expected by services/controllers.
 */
async function ensureRunsDir() {
  // Kept method name for compatibility with existing bootstrap flow.
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

function mapRowToRun(row) {
  // Normalize DB row shape (snake_case + Date objects) to API shape (camelCase + ISO strings).
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

async function writeRun(run) {
  // Upsert keeps repository contract simple: one method handles both "create" and "update".
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
    // Parameter order must match VALUES ($1...$10) exactly.
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

async function getRunById(id) {
  const { rows } = await db.query("SELECT * FROM runs WHERE id = $1 LIMIT 1;", [id]);
  const row = rows[0];
  if (!row) {
    // Preserve legacy not-found signal so app-level error mapping remains unchanged.
    const notFoundError = new Error("Run not found");
    notFoundError.code = "ENOENT";
    throw notFoundError;
  }
  // Return normalized object so service/controller layers stay storage-agnostic.
  return mapRowToRun(row);
}

async function getAllRuns() {
  // Keep list endpoint behavior deterministic (newest runs first).
  const { rows } = await db.query("SELECT * FROM runs ORDER BY created_at DESC;");
  return rows.map(mapRowToRun);
}

module.exports = {
  ensureRunsDir,
  writeRun,
  getRunById,
  getAllRuns,
};
