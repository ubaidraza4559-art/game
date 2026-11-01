const { Pool } = require('pg');

// Neon (and Vercel Postgres) require SSL. Local Postgres does not.
// Detect by host: neon.tech / vercel / sslmode in the URL.
function poolConfig() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!url) return null;
  const needsSsl = /neon\.tech|sslmode=require|vercel/i.test(url);
  return { connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : false, max: 5, connectionTimeoutMillis: 8000, idleTimeoutMillis: 30000 };
}
const cfg = poolConfig();
const pool = cfg ? new Pool(cfg) : null;
async function q(text, params = []) {
  if (!pool) throw new Error('DATABASE_URL is not set');
  return pool.query(text, params);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS games(id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', demo TEXT NOT NULL DEFAULT '', game_url TEXT NOT NULL DEFAULT '', max_score INT NOT NULL DEFAULT 10000, featured BOOLEAN NOT NULL DEFAULT FALSE, plays INT NOT NULL DEFAULT 0, avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS unity_projects(id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT NOT NULL DEFAULT '', genre TEXT NOT NULL DEFAULT '', platform TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Coming Soon', engine TEXT NOT NULL DEFAULT 'Unity', controls TEXT NOT NULL DEFAULT '', browser_build_url TEXT NOT NULL DEFAULT '', download_url TEXT NOT NULL DEFAULT '', trailer_url TEXT NOT NULL DEFAULT '', featured BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS products(id SERIAL PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, price NUMERIC(10,2) NOT NULL, sale_price NUMERIC(10,2), category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', emoji TEXT NOT NULL DEFAULT '👕', stock INT NOT NULL DEFAULT 50, rating NUMERIC(3,2) NOT NULL DEFAULT 4.5, featured BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS scores(id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE, score BIGINT NOT NULL DEFAULT 0, verification_status TEXT NOT NULL DEFAULT 'verified', session_token TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game_id, verification_status, score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_user ON scores(user_id, game_id);
CREATE TABLE IF NOT EXISTS score_sessions(token TEXT PRIMARY KEY, user_id INT NOT NULL, game_id INT NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), used BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS ratings(id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE, rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5), UNIQUE(user_id, game_id));
CREATE TABLE IF NOT EXISTS gallery(id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, image_url TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', moderation_status TEXT NOT NULL DEFAULT 'pending', likes INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS orders(id SERIAL PRIMARY KEY, user_id INT, items JSONB NOT NULL, total NUMERIC(10,2) NOT NULL, status TEXT NOT NULL DEFAULT 'processing', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS teams(id SERIAL PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
`;

async function seed() {
  const g = await q('SELECT COUNT(*)::int AS c FROM games');
  if (g.rows[0].c === 0) {
    await q(`INSERT INTO games(title,slug,category,description,demo,max_score,featured) VALUES
      ('Coin Rush Arcade','coin-rush-arcade','Retro Games','Collect as many gold coins as you can in 60 seconds. Arrow keys / WASD. DEMO game.','coin-rush',10000,true),
      ('Neon Space Shooter','neon-space-shooter','Space Shooters','Move left/right and shoot descending enemies. Space shoots. DEMO game.','neon-shooter',10000,true),
      ('Pixel Memory Puzzle','pixel-memory-puzzle','Puzzle Games','Flip cards and match all pairs. Each match scores 100. DEMO game.','pixel-memory',10000,false)`);
  }
  const u = await q('SELECT COUNT(*)::int AS c FROM unity_projects');
  if (u.rows[0].c === 0) {
    // Intentionally NO browser_build_url / download_url / trailer_url.
    // Front end shows "not yet published" instead of a fake button.
    await q(`INSERT INTO unity_projects(title,slug,description,genre,platform,status,featured) VALUES
      ('Coin Rush','coin-rush','SAMPLE DESCRIPTION — replace with official studio copy before launch. No browser build or download is linked yet.','Arcade','Web, Windows, macOS','Prototype',true),
      ('Alienteen','alienteen','SAMPLE DESCRIPTION — replace with official studio copy before launch. No browser build or download is linked yet.','Sci-Fi Adventure','Web, Windows, macOS','In Development',true),
      ('Alientech','alientech','SAMPLE DESCRIPTION — replace with official studio copy before launch. No browser build or download is linked yet.','Sci-Fi Action','Web, Windows, macOS','Coming Soon',true)`);
  }
  const p = await q('SELECT COUNT(*)::int AS c FROM products');
  if (p.rows[0].c === 0) {
    await q(`INSERT INTO products(name,slug,price,sale_price,category,description,emoji,featured) VALUES
      ('SAMPLE GEGABYTE Gold Logo Tee','gold-logo-tee',49.00,NULL,'T-Shirts','SAMPLE product — replace image, price and stock before real orders.','👕',true),
      ('SAMPLE GEGABYTE Arcade Tee','arcade-tee',59.00,39.00,'T-Shirts','SAMPLE product — replace before real orders.','👕',false),
      ('SAMPLE GEGABYTE Metallic Hoodie','metallic-hoodie',89.00,NULL,'Hoodies','SAMPLE product — replace before real orders.','🧥',true),
      ('SAMPLE GEGABYTE Connect Hoodie','connect-hoodie',79.00,69.00,'Hoodies','SAMPLE product — replace before real orders.','🧥',false),
      ('SAMPLE GEGABYTE Crew Sweatshirt','crew-sweatshirt',69.00,NULL,'Sweatshirts','SAMPLE product — replace before real orders.','👚',false),
      ('SAMPLE GEGABYTE Snapback Cap','snapback-cap',35.00,NULL,'Gaming Accessories','SAMPLE product — replace before real orders.','🧢',false)`);
  }
}

const dbReady = (async () => {
  if (!pool) throw new Error('DATABASE_URL is not set');
  await q(SCHEMA);
  await seed();
})();

module.exports = { q, pool, dbReady };
