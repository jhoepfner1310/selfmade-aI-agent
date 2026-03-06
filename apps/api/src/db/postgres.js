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

// Execute a parameterized SQL query through the shared pool.
async function query(text, params = []) {
  return pool.query(text, params);
}

// Gracefully close all pooled connections (useful for tests/shutdown).
async function closePool() {
  await pool.end();
}

module.exports = {
  query,
  closePool,
};
