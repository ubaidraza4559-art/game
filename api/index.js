// Vercel serverless entry point. All state lives in Postgres (Neon on
// Vercel, local Postgres for dev) — never in /tmp or in-memory, so
// data does not vanish between serverless instances (the BizPilot
// /tmp lesson). If DATABASE_URL is missing or Postgres is down,
// the API returns 503 instead of silently serving another store.
const { app, dbReady } = require('../server.js');
module.exports = async (req, res) => {
  try { await dbReady; } catch (e) {
    return res.status(503).json({ error: 'Database not ready. Set DATABASE_URL (Neon) in Vercel env vars and redeploy.' });
  }
  return app(req, res);
};
