// Vercel serverless entry point. All state lives in Postgres (Neon on
// Vercel, local Postgres for dev) — never in /tmp or in-memory, so
// data does not vanish between serverless instances (the BizPilot
// /tmp lesson). If DATABASE_URL is missing or Postgres is down,
// the API returns 503 with the sanitized DB error (no password,
// no URL) instead of silently serving another store, and the
// NEXT request retries init instead of staying broken.
const { app, ensureDb, getLastDbError } = require('../server.js');
module.exports = async (req, res) => {
  try { await ensureDb(); } catch (e) {
    return res.status(503).json({ error: 'Database not ready: ' + (getLastDbError() || e.message) + '. Check DATABASE_URL (Neon) in Vercel env vars.' });
  }
  return app(req, res);
};
