const { Pool } = require("pg");

/**
 * Shared PostgreSQL pool for the API process.
 *
 * Responsibilities:
 * 1) Read database connection config from environment variables.
 * 2) Create one reusable connection pool for the current Node process.
 * 3) Expose a tiny query API for repositories and tests.
 *
 * Why this module exists:
 * - Centralizes DB connection management in one place.
 * - Keeps repositories focused on SQL, not connection boilerplate.
 */
const connectionString = process.env.DATABASE_URL;

// Fail fast on startup if DB configuration is missing.
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Pool = managed set of reusable DB connections (not just one socket).
const pool = new Pool({
  connectionString,
});

/**
 * Executes a parameterized query. Use $1, $2, etc. for params to prevent SQL injection.
 *
 * @param {string} text - SQL query with $1, $2 placeholders
 * @param {Array} [params=[]] - Parameter values
 * @returns {Promise<Object>} pg result with rows, rowCount, etc.
 */
async function query(text, params = []) {
  return pool.query(text, params);
}

/** Closes the pool. Call during graceful shutdown or in tests. */
async function closePool() {
  await pool.end();
}

module.exports = {
  query,
  closePool,
};
