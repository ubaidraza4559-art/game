// GEGABYTE — Vercel + Neon Postgres version.
// Honest limits (also in README.md):
//  - This is NOT WordPress/WooCommerce/XStore. Those cannot run on
//    Vercel, and Neon is Postgres (WordPress needs MySQL). The
//    WordPress package stays in ~/workspace/gegabyte/ for a WP host.
//  - Unity PLAY/DOWNLOAD buttons render only when a real URL is in
//    the database. Seeded Unity projects have none, so they show
//    "not yet published" — never a fake link.
//  - Checkout creates a real order in Neon, but no payment gateway
//    is connected yet (test mode, labelled in the UI). Do not take
//    real money until Stripe/PayPal is connected.
//  - Scores: session-token (stored in Postgres, so it works across
//    serverless instances), single-use, 5s minimum, range-checked,
//    1 submission per user/game per 60s. This stops casual tampering,
//    not cryptographic cheat-proofing for prize competitions.
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { q, dbReady, ensureDb, getLastDbError } = require('./lib/db');

const app = express();
app.use(express.json({ limit: '3mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(pw, salt, 64).toString('hex');
  return salt + ':' + h;
}
function checkPw(pw, stored) {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), crypto.scryptSync(pw, salt, 64));
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
async function auth(req, res, next) {
  req.user = null;
  const token = parseCookies(req).gb_session;
  if (token) {
    const r = await q('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>NOW()', [token]).catch(() => null);
    if (r && r.rows[0]) { const { password_hash, ...u } = r.rows[0]; req.user = u; }
  }
  next();
}
app.use(auth);
function needAuth(req, res, next) { if (!req.user) return res.status(401).json({ error: 'Log in first.' }); next(); }
function needAdmin(req, res, next) { if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' }); next(); }
function setSession(res, req, token) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.secure;
  res.setHeader('Set-Cookie', `gb_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure ? '; Secure' : ''}`);
}
function clearSession(res) { res.setHeader('Set-Cookie', 'gb_session=; HttpOnly; Path=/; Max-Age=0'); }

// --- Auth ---
app.post('/api/auth/signup', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.displayName || '').trim().slice(0, 80);
    const pw = String(req.body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || pw.length < 8 || !name) return res.status(400).json({ error: 'Valid email, name, and password (8+ chars) required.' });
    const count = await q('SELECT COUNT(*)::int AS c FROM users');
    const role = count.rows[0].c === 0 ? 'admin' : 'user'; // first account = admin, like BizPilot/TravelSphere
    const r = await q('INSERT INTO users(email,password_hash,display_name,role) VALUES($1,$2,$3,$4) RETURNING id,email,display_name,role', [email, hashPw(pw), name, role]);
    const token = crypto.randomBytes(32).toString('hex');
    await q('INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL \'30 days\')', [token, r.rows[0].id]);
    setSession(res, req, token);
    res.json({ user: r.rows[0] });
  } catch (e) { if (String(e.code) === '23505') return res.status(409).json({ error: 'Email already registered.' }); res.status(500).json({ error: 'Signup failed.' }); }
});
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const pw = String(req.body.password || '');
  const r = await q('SELECT * FROM users WHERE email=$1', [email]);
  if (!r.rows[0] || !checkPw(pw, r.rows[0].password_hash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const token = crypto.randomBytes(32).toString('hex');
  await q('INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL \'30 days\')', [token, r.rows[0].id]);
  setSession(res, req, token);
  const { password_hash, ...u } = r.rows[0];
  res.json({ user: u });
});
app.post('/api/auth/logout', async (req, res) => {
  const token = parseCookies(req).gb_session;
  if (token) await q('DELETE FROM sessions WHERE token=$1', [token]).catch(() => {});
  clearSession(res); res.json({ ok: true });
});
app.get('/api/me', (req, res) => res.json({ user: req.user }));

// --- Games / scores ---
app.get('/api/games', async (req, res) => {
  const cat = req.query.category || '';
  const r = await q(cat ? 'SELECT * FROM games WHERE category=$1 ORDER BY featured DESC, plays DESC' : 'SELECT * FROM games ORDER BY featured DESC, plays DESC', cat ? [cat] : []);
  res.json(r.rows);
});
app.get('/api/games/:slug', async (req, res) => {
  await q('UPDATE games SET plays=plays+1 WHERE slug=$1', [req.params.slug]).catch(() => {});
  const r = await q('SELECT * FROM games WHERE slug=$1', [req.params.slug]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Game not found.' });
  res.json(r.rows[0]);
});
app.post('/api/session', needAuth, async (req, res) => {
  const gameId = parseInt(req.body.game_id, 10);
  if (!gameId) return res.status(400).json({ error: 'game_id required.' });
  const g = await q('SELECT id FROM games WHERE id=$1', [gameId]);
  if (!g.rows[0]) return res.status(404).json({ error: 'Game not found.' });
  const cnt = await q("SELECT COUNT(*)::int AS c FROM score_sessions WHERE user_id=$1 AND started_at>NOW()-INTERVAL '1 hour'", [req.user.id]);
  if (cnt.rows[0].c >= 10) return res.status(429).json({ error: 'Too many sessions. Try again later.' });
  const token = crypto.randomBytes(32).toString('hex');
  await q('INSERT INTO score_sessions(token,user_id,game_id) VALUES($1,$2,$3)', [token, req.user.id, gameId]);
  res.json({ token });
});
app.post('/api/score', needAuth, async (req, res) => {
  try {
    const gameId = parseInt(req.body.game_id, 10);
    const score = parseInt(req.body.score, 10);
    const duration = parseInt(req.body.duration, 10) || 0;
    const token = String(req.body.token || '');
    const s = await q('SELECT * FROM score_sessions WHERE token=$1 AND used=false', [token]);
    if (!s.rows[0] || s.rows[0].user_id !== req.user.id || s.rows[0].game_id !== gameId) return res.status(403).json({ error: 'Invalid or expired game session. Start the game again.' });
    await q('UPDATE score_sessions SET used=true WHERE token=$1', [token]);
    const g = await q('SELECT * FROM games WHERE id=$1', [gameId]);
    if (!g.rows[0]) return res.status(404).json({ error: 'Game not found.' });
    if (!Number.isFinite(score) || score < 0 || score > g.rows[0].max_score) return res.status(400).json({ error: 'Score is outside the allowed range for this game.' });
    const age = (Date.now() - new Date(s.rows[0].started_at).getTime()) / 1000;
    if (age < 5) return res.status(400).json({ error: 'Session too short to be a real play.' });
    if (duration > 0 && duration > age + 60) return res.status(400).json({ error: 'Claimed play time does not match the session.' });
    const last = await q("SELECT created_at FROM scores WHERE user_id=$1 AND game_id=$2 ORDER BY created_at DESC LIMIT 1", [req.user.id, gameId]);
    if (last.rows[0] && (Date.now() - new Date(last.rows[0].created_at).getTime()) < 60000) return res.status(429).json({ error: 'Score already submitted recently.' });
    const r = await q('INSERT INTO scores(user_id,game_id,score,verification_status,session_token) VALUES($1,$2,$3,\'verified\',$4) RETURNING id', [req.user.id, gameId, score, token]);
    res.json({ saved: true, score_id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: 'Could not save score.' }); }
});
app.post('/api/rate', needAuth, async (req, res) => {
  const gameId = parseInt(req.body.game_id, 10), rating = parseInt(req.body.rating, 10);
  if (!gameId || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1–5.' });
  await q('INSERT INTO ratings(user_id,game_id,rating) VALUES($1,$2,$3) ON CONFLICT(user_id,game_id) DO UPDATE SET rating=EXCLUDED.rating', [req.user.id, gameId, rating]);
  const avg = await q('SELECT AVG(rating)::numeric(3,2) AS a FROM ratings WHERE game_id=$1', [gameId]);
  await q('UPDATE games SET avg_rating=$1 WHERE id=$2', [avg.rows[0].a || 0, gameId]);
  res.json({ average: Number(avg.rows[0].a || 0), message: 'Thanks — your rating was saved.' });
});
app.get('/api/leaderboard', async (req, res) => {
  const period = ['daily', 'weekly', 'monthly', 'all'].includes(req.query.period) ? req.query.period : 'all';
  const gameId = parseInt(req.query.game_id, 10) || 0;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.count, 10) || 20));
  let periodSql = '';
  if (period === 'daily') periodSql = " AND created_at >= CURRENT_DATE";
  if (period === 'weekly') periodSql = " AND created_at >= NOW() - INTERVAL '7 days'";
  if (period === 'monthly') periodSql = " AND created_at >= NOW() - INTERVAL '30 days'";
  let rows;
  if (gameId) {
    rows = await q(`SELECT user_id, game_id, MAX(score) AS best_score, MAX(created_at) AS created_at FROM scores WHERE verification_status='verified' AND game_id=$1 ${periodSql} GROUP BY user_id, game_id ORDER BY best_score DESC LIMIT $2`, [gameId, limit]);
    rows = rows.rows.map(r => ({ ...r, total_points: Number(r.best_score) }));
  } else {
    const r = await q(`SELECT user_id, SUM(best_per_game) AS total_points, MAX(best_per_game) AS best_score FROM (SELECT user_id, game_id, MAX(score) AS best_per_game FROM scores WHERE verification_status='verified' ${periodSql} GROUP BY user_id, game_id) t GROUP BY user_id ORDER BY total_points DESC, best_score DESC LIMIT $1`, [limit]);
    rows = r.rows;
  }
  // Attach display names (no passwords, no emails in leaderboard output).
  for (const row of rows) {
    const u = await q('SELECT display_name FROM users WHERE id=$1', [row.user_id]);
    row.username = u.rows[0] ? u.rows[0].display_name : 'Player';
  }
  res.json(rows);
});

// --- Team (no fake members seeded — same rule as WordPress version) ---
app.get('/api/team', async (req, res) => { const r = await q('SELECT * FROM teams ORDER BY id'); res.json(r.rows); });

// --- Unity / shop / community ---
app.get('/api/unity', async (req, res) => { const r = await q('SELECT * FROM unity_projects ORDER BY featured DESC, id'); res.json(r.rows); });
app.get('/api/unity/:slug', async (req, res) => {
  const r = await q('SELECT * FROM unity_projects WHERE slug=$1', [req.params.slug]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Project not found.' });
  res.json(r.rows[0]);
});
app.get('/api/products', async (req, res) => {
  const cat = req.query.category || '';
  const r = await q(cat ? 'SELECT * FROM products WHERE category=$1 ORDER BY featured DESC, id' : 'SELECT * FROM products ORDER BY featured DESC, id', cat ? [cat] : []);
  res.json(r.rows);
});
app.get('/api/products/:id', async (req, res) => {
  const r = await q('SELECT * FROM products WHERE id=$1', [req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Product not found.' });
  res.json(r.rows[0]);
});
app.post('/api/orders', async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'Cart is empty.' });
  let total = 0; const detailed = [];
  for (const it of items) {
    const p = await q('SELECT * FROM products WHERE id=$1', [parseInt(it.product_id, 10)]);
    if (!p.rows[0]) return res.status(400).json({ error: 'Product not found.' });
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    const price = Number(p.rows[0].sale_price || p.rows[0].price);
    total += price * qty;
    detailed.push({ product_id: p.rows[0].id, name: p.rows[0].name, price, qty });
  }
  if (req.body.coupon === 'GEGA10') total = Math.round(total * 0.9 * 100) / 100;
  const r = await q('INSERT INTO orders(user_id,items,total,status) VALUES($1,$2,$3,\'processing\') RETURNING id,total,status,created_at', [req.user ? req.user.id : null, JSON.stringify(detailed), total]);
  res.json({ order: r.rows[0], note: 'TEST ORDER — no payment gateway is connected yet. Do not take real money until Stripe/PayPal is added.' });
});
app.get('/api/orders', needAuth, async (req, res) => {
  const r = req.user.role === 'admin'
    ? await q('SELECT * FROM orders ORDER BY created_at DESC LIMIT 50')
    : await q('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.user.id]);
  res.json(r.rows);
});
app.get('/api/gallery', async (req, res) => {
  const r = await q("SELECT g.*, u.display_name AS username FROM gallery g JOIN users u ON u.id=g.user_id WHERE g.moderation_status='approved' ORDER BY g.created_at DESC LIMIT 24");
  res.json(r.rows);
});
app.post('/api/gallery', needAuth, async (req, res) => {
  const img = String(req.body.image_url || '');
  const caption = String(req.body.caption || '').slice(0, 200);
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(img) || img.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Only JPG/PNG/WebP image data up to ~2 MB.' });
  const r = await q('INSERT INTO gallery(user_id,image_url,caption,moderation_status) VALUES($1,$2,$3,\'pending\') RETURNING id', [req.user.id, img, caption]);
  res.json({ id: r.rows[0].id, message: 'Thanks! Your photo is pending moderation.' });
});
app.post('/api/gallery/:id/like', needAuth, async (req, res) => {
  await q("UPDATE gallery SET likes=likes+1 WHERE id=$1 AND moderation_status='approved'", [req.params.id]);
  res.json({ ok: true });
});
app.get('/api/dashboard', needAuth, async (req, res) => {
  const scores = await q("SELECT s.*, g.title AS game_title FROM scores s JOIN games g ON g.id=s.game_id WHERE s.user_id=$1 AND s.verification_status='verified' ORDER BY s.created_at DESC LIMIT 20", [req.user.id]);
  const uploads = await q('SELECT id,caption,moderation_status,created_at FROM gallery WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.user.id]);
  res.json({ scores: scores.rows, uploads: uploads.rows });
});

// --- Admin ---
app.get('/api/admin/overview', needAdmin, async (req, res) => {
  const [u, s, o, g] = await Promise.all([
    q('SELECT COUNT(*)::int AS c FROM users'), q("SELECT COUNT(*)::int AS c FROM scores WHERE verification_status='verified'"),
    q('SELECT COUNT(*)::int AS c FROM orders'), q("SELECT COUNT(*)::int AS c FROM gallery WHERE moderation_status='pending'"),
  ]);
  res.json({ users: u.rows[0].c, verified_scores: s.rows[0].c, orders: o.rows[0].c, pending_gallery: g.rows[0].c });
});
app.get('/api/admin/gallery-pending', needAdmin, async (req, res) => {
  const r = await q("SELECT * FROM gallery WHERE moderation_status='pending' ORDER BY created_at DESC LIMIT 50"); res.json(r.rows);
});
app.post('/api/admin/team', needAdmin, async (req, res) => {
  const r = await q('INSERT INTO teams(name,role,bio) VALUES($1,$2,$3) RETURNING *', [String(req.body.name || '').slice(0, 120), String(req.body.role || ''), String(req.body.bio || '')]); res.json(r.rows[0]);
});
app.post('/api/admin/scores/:id/reject', needAdmin, async (req, res) => {
  await q("UPDATE scores SET verification_status='rejected' WHERE id=$1", [req.params.id]); res.json({ ok: true });
});
app.post('/api/admin/gallery/:id/moderate', needAdmin, async (req, res) => {
  const st = req.body.status === 'approved' ? 'approved' : 'rejected';
  await q('UPDATE gallery SET moderation_status=$1 WHERE id=$2', [st, req.params.id]); res.json({ ok: true });
});
app.post('/api/admin/games', needAdmin, async (req, res) => {
  const b = req.body;
  const r = await q('INSERT INTO games(title,slug,category,description,demo,game_url,max_score,featured) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [String(b.title || '').slice(0, 120), String(b.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-'), String(b.category || 'Retro Games'), String(b.description || ''), String(b.demo || ''), String(b.game_url || ''), parseInt(b.max_score, 10) || 10000, !!b.featured]);
  res.json(r.rows[0]);
});
app.post('/api/admin/unity', needAdmin, async (req, res) => {
  const b = req.body;
  // No URL is ever invented here: empty stays empty, front end hides the button.
  const r = await q('INSERT INTO unity_projects(title,slug,description,genre,platform,status,engine,controls,browser_build_url,download_url,trailer_url,featured) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *', [String(b.title || '').slice(0, 120), String(b.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-'), String(b.description || ''), String(b.genre || ''), String(b.platform || ''), String(b.status || 'Coming Soon'), String(b.engine || 'Unity'), String(b.controls || ''), String(b.browser_build_url || ''), String(b.download_url || ''), String(b.trailer_url || ''), !!b.featured]);
  res.json(r.rows[0]);
});
app.post('/api/admin/products', needAdmin, async (req, res) => {
  const b = req.body;
  const r = await q('INSERT INTO products(name,slug,price,sale_price,category,description,emoji,stock,featured) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [String(b.name || '').slice(0, 120), String(b.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-'), parseFloat(b.price) || 0, b.sale_price ? parseFloat(b.sale_price) : null, String(b.category || 'T-Shirts'), String(b.description || ''), String(b.emoji || '👕'), parseInt(b.stock, 10) || 50, !!b.featured]);
  res.json(r.rows[0]);
});

app.get('/api/health', async (req, res) => {
  try { await ensureDb(); await q('SELECT 1'); res.json({ ok: true, db: 'postgres' }); }
  catch (e) { res.status(503).json({ ok: false, db: 'unavailable', detail: getLastDbError() || String(e.message || e).slice(0, 300) }); }
});

// SPA fallback: every non-API route serves the app.
// On Vercel, public/ files are served statically by Vercel itself,
// but they are NOT included in the serverless function bundle, so
// sendFile() inside the function fails with 500 for "/". Redirect
// to /index.html instead — that URL is served statically (200)
// and the app's hash routing (#/arcade, #/shop, ...) works from
// there. Locally, express.static already serves /index.html, so
// this redirect is only reached on Vercel for the root route.
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.redirect('/index.html');
});

if (process.argv.includes('--create-user')) {
  (async () => {
    await ensureDb();
    const email = process.argv[process.argv.indexOf('--create-user') + 1];
    const pw = process.argv[process.argv.indexOf('--create-user') + 2];
    const name = process.argv[process.argv.indexOf('--create-user') + 3] || 'Admin';
    if (!email || !pw) { console.error('Usage: node server.js --create-user <email> <password> [name]'); process.exit(1); }
    const count = await q('SELECT COUNT(*)::int AS c FROM users');
    await q('INSERT INTO users(email,password_hash,display_name,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING', [email, hashPw(pw), name, count.rows[0].c === 0 ? 'admin' : 'user']);
    console.log('User created (or already existed):', email); process.exit(0);
  })();
} else if (require.main === module) {
  const port = process.env.PORT || 3000;
  ensureDb().then(() => app.listen(port, () => console.log('GEGABYTE Vercel version on http://localhost:' + port)))
    .catch(e => { console.error('Database not ready:', e.message); process.exit(1); });
}
module.exports = { app, dbReady, ensureDb, getLastDbError };
