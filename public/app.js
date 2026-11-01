/* GEGABYTE Vercel app — same theme as the WordPress child theme:
   #090A0D / #12151B / #191D24, gold #D6A94B / #F5CC70, translucent
   sticky header, hero + 4 tiles, arcade cabinet cards, Unity cards,
   WooCommerce-style product cards. Only the backend changed
   (Postgres instead of MySQL) so it can run on Vercel + Neon. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var me = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '$' + Number(n).toFixed(2); }
  function stars(avg) { var r = Math.round(Number(avg) || 0); return '★'.repeat(r) + '☆'.repeat(5 - r) + ' ' + (Number(avg) || 0).toFixed(1) + '/5'; }
  async function api(path, opts) {
    opts = opts || {};
    var res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  async function refreshMe() {
    try { var d = await api('/api/me'); me = d.user; } catch (e) { me = null; }
    var al = document.getElementById('auth-link');
    if (al) al.innerHTML = me ? '<a href="#/dashboard">' + esc(me.display_name) + '</a> <a href="#/logout">Logout</a>' : '<a href="#/login">Login</a> <a class="btn" href="#/login">MY ACCOUNT</a>';
    var cl = document.getElementById('cart-link');
    if (cl) { var cart = getCart(); cl.innerHTML = '<a href="#/cart">Cart (' + cart.reduce(function (a, i) { return a + i.qty; }, 0) + ')</a>'; }
  }
  function getCart() { try { return JSON.parse(localStorage.getItem('gb_cart') || '[]'); } catch (e) { return []; } }
  function setCart(c) { localStorage.setItem('gb_cart', JSON.stringify(c)); refreshMe(); }
  function getWish() { try { return JSON.parse(localStorage.getItem('gb_wish') || '[]'); } catch (e) { return []; } }
  function gameCard(g) {
    return '<article class="card"><div class="thumb">🕹️</div><div class="card-b"><h3><a href="#/game/' + esc(g.slug) + '">' + esc(g.title) + '</a></h3><p class="muted">' + esc(g.category) + ' · ' + g.plays + ' plays</p><p class="stars">' + stars(g.avg_rating) + '</p><p><a class="btn" href="#/game/' + esc(g.slug) + '">Play Now</a></p></div></article>';
  }
  function unityCard(u) {
    return '<article class="card"><div class="thumb">🎮</div><div class="card-b"><h3><a href="#/unity/' + esc(u.slug) + '">' + esc(u.title) + '</a></h3><p>' + (u.featured ? '<span class="badge">Featured</span>' : '') + '<span class="badge">' + esc(u.status) + '</span></p><p class="muted">' + esc(u.description).slice(0, 110) + '</p><p><a class="btn" href="#/unity/' + esc(u.slug) + '">View Project</a></p></div></article>';
  }
  function productCard(p) {
    var price = p.sale_price ? '<s class="muted">' + money(p.price) + '</s> <b>' + money(p.sale_price) + '</b>' : '<b>' + money(p.price) + '</b>';
    var wished = getWish().indexOf(p.id) !== -1;
    return '<article class="card"><div class="thumb">' + esc(p.emoji) + '</div><div class="card-b"><h3><a href="#/product/' + p.id + '">' + esc(p.name) + '</a></h3><p>' + price + ' · <span class="stars">' + stars(p.rating) + '</span></p><p>' + (p.featured ? '<span class="badge">Featured</span>' : '') + '<span class="badge">' + esc(p.category) + '</span></p><p><button class="btn" onclick="gbAddCart(' + p.id + ',1)">Add to Cart</button> <button class="btn-o" onclick="gbWish(' + p.id + ')">' + (wished ? '♥ Wishlisted' : '♡ Wishlist') + '</button></p><p><a href="#/product/' + p.id + '">Quick View</a></p></div></article>';
  }
  window.gbAddCart = function (id, qty) { var c = getCart(); var f = c.find(function (i) { return i.product_id === id; }); if (f) f.qty += qty; else c.push({ product_id: id, qty: qty }); setCart(c); alert('Added to cart'); };
  window.gbWish = function (id) { var w = getWish(); var i = w.indexOf(id); if (i === -1) w.push(id); else w.splice(i, 1); localStorage.setItem('gb_wish', JSON.stringify(w)); render(); };
  async function leaderboardHTML(period, gameId, count) {
    try {
      var rows = await api('/api/leaderboard?period=' + period + (gameId ? '&game_id=' + gameId : '') + '&count=' + (count || 20));
      if (!rows.length) return '<p class="muted">No verified scores yet for this period. Log in, play a game, and your score will appear here.</p>';
      var h = '<table><thead><tr><th>Rank</th><th>Player</th>' + (gameId ? '<th>High Score</th>' : '<th>Total Points</th><th>Best Score</th>') + '<th>Date</th></tr></thead><tbody>';
      rows.forEach(function (r, i) {
        h += '<tr><td>' + (i + 1) + '</td><td>' + esc(r.username) + '</td>';
        if (gameId) h += '<td>' + Number(r.best_score).toLocaleString() + '</td>';
        else h += '<td>' + Number(r.total_points).toLocaleString() + '</td><td>' + Number(r.best_score).toLocaleString() + '</td>';
        h += '<td>' + (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—') + '</td></tr>';
      });
      return h + '</tbody></table>';
    } catch (e) { return '<p class="notice">' + esc(e.message) + '</p>'; }
  }

  async function viewHome() {
    var games = await api('/api/games').catch(function () { return []; });
    var unity = await api('/api/unity').catch(function () { return []; });
    var products = await api('/api/products').catch(function () { return []; });
    var lb = await leaderboardHTML('all', 0, 5);
    app.innerHTML = '<section class="hero"><div class="wrap"><div style="font-size:56px">🪙</div><h1 class="logo3d">GEGABYTE</h1><p class="tag">PLAY. COMPETE. CONNECT.</p>' +
      '<div class="tiles">' +
      '<a class="tile" href="#/arcade"><div style="font-size:30px">🕹️</div><h3>PLAY</h3><p>Open the Arcade Hub — retro, space, puzzle and action games.</p></a>' +
      '<a class="tile" href="#/shop"><div style="font-size:30px">👕</div><h3>SHOP</h3><p>Premium streetwear, hoodies and limited drops.</p></a>' +
      '<a class="tile" href="#/unity"><div style="font-size:30px">🎮</div><h3>UNITY</h3><p>Unity releases from the studio — browser and PC/Mac.</p></a>' +
      '<a class="tile" href="#/community"><div style="font-size:30px">👥</div><h3>CONNECT</h3><p>Leaderboards, fits gallery and the community.</p></a></div>' +
      '<p style="margin-top:28px"><a class="btn" href="#/arcade">Start Playing</a> <a class="btn-o" href="#/shop">Shop the Drop</a></p></div></section>' +
      '<section class="sec"><div class="wrap"><h2>Featured Arcade</h2><p class="muted">Real playable demo games. MyArcadeLite feed games live in the WordPress version — see the WordPress package docs.</p><div class="grid">' + games.filter(function (g) { return g.featured; }).slice(0, 4).map(gameCard).join('') + '</div></div></section>' +
      '<section class="sec" style="background:var(--bg2)"><div class="wrap"><h2>Unity Studio</h2><p class="muted">Coin Rush, Alienteen and Alientech are listed as studio projects. Browser and download buttons appear only when a verified build URL is set in admin — no fake links are generated.</p><div class="grid">' + unity.slice(0, 3).map(unityCard).join('') + '</div></div></section>' +
      '<section class="sec"><div class="wrap"><h2>Streetwear Store</h2><p class="muted">Real products, cart and checkout in Neon. Sample products are clearly labelled SAMPLE until replaced.</p><div class="grid">' + products.slice(0, 4).map(productCard).join('') + '</div></div></section>' +
      '<section class="sec" style="background:var(--bg2)"><div class="wrap"><h2>Top Players</h2>' + lb + '</div></section>';
  }

  async function viewArcade() {
    var games = await api('/api/games');
    var cats = ['All', 'Retro Games', 'Space Shooters', 'Puzzle Games', 'Action Games', 'Adventure Games'];
    var state = { cat: 'All', q: '', sort: 'popular' };
    function renderList() {
      var list = games.filter(function (g) { return (state.cat === 'All' || g.category === state.cat) && g.title.toLowerCase().indexOf(state.q.toLowerCase()) !== -1; });
      if (state.sort === 'rating') list.sort(function (a, b) { return b.avg_rating - a.avg_rating; });
      if (state.sort === 'latest') list.sort(function (a, b) { return b.id - a.id; });
      if (state.sort === 'popular') list.sort(function (a, b) { return b.plays - a.plays; });
      document.getElementById('gb-list').innerHTML = list.length ? list.map(gameCard).join('') : '<p class="notice">No games match. Add one in Admin, or check back later.</p>';
    }
    app.innerHTML = '<section class="sec"><div class="wrap"><h1>Arcade Hub</h1><p class="muted">Play in your browser. Scores count only when you are logged in and play through a server session.</p>' +
      '<p><input id="gb-q" placeholder="Search games by title"> <select id="gb-sort"><option value="popular">Most played</option><option value="rating">Top rated</option><option value="latest">Latest</option></select></p>' +
      '<p>' + cats.map(function (c) { return '<button class="btn-o" data-cat="' + esc(c) + '">' + esc(c) + '</button> '; }).join('') + '</p>' +
      '<div class="grid" id="gb-list"></div></div></section>';
    renderList();
    document.getElementById('gb-q').addEventListener('input', function (e) { state.q = e.target.value; renderList(); });
    document.getElementById('gb-sort').addEventListener('change', function (e) { state.sort = e.target.value; renderList(); });
    document.querySelectorAll('[data-cat]').forEach(function (b) { b.addEventListener('click', function () { state.cat = b.getAttribute('data-cat'); renderList(); }); });
  }

  async function viewGame(slug) {
    var g = await api('/api/games/' + encodeURIComponent(slug));
    var lb = await leaderboardHTML('all', g.id, 20);
    var products = await api('/api/products').catch(function () { return []; });
    var games = await api('/api/games').catch(function () { return []; });
    var share = encodeURIComponent(location.href), titleEnc = encodeURIComponent(g.title);
    app.innerHTML = '<section class="sec"><div class="wrap"><p><a href="#/arcade">← Arcade Hub</a></p><h1>' + esc(g.title) + '</h1><p class="muted">' + esc(g.category) + ' · <span class="stars">' + stars(g.avg_rating) + '</span> · ' + g.plays + ' plays</p>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px"><div><div id="gb-stage" data-demo="' + esc(g.demo) + '" data-game-id="' + g.id + '"></div>' +
      '<p><button class="btn-o" onclick="document.getElementById(\'gb-canvas\') && document.getElementById(\'gb-canvas\').requestFullscreen && document.getElementById(\'gb-canvas\').requestFullscreen()">Fullscreen</button></p>' +
      '<h2>How to play</h2><p>' + esc(g.description) + '</p>' +
      '<h2>Rate this game</h2><p id="gb-rate">' + [1, 2, 3, 4, 5].map(function (i) { return '<button class="btn-o" data-star="' + i + '">★</button>'; }).join(' ') + ' <span id="gb-rate-msg"></span></p>' +
      '<h2>Share</h2><p><a target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + share + '">Facebook</a> · <a target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + titleEnc + '&url=' + share + '">X</a> · <a target="_blank" rel="noopener" href="https://www.reddit.com/submit?url=' + share + '&title=' + titleEnc + '">Reddit</a> · Discord (copy link)</p>' +
      '<h2>High Scores — verified only</h2>' + lb + '</div>' +
      '<aside><div class="card"><div class="card-b"><h3>Featured games</h3><div class="grid">' + games.filter(function (x) { return x.featured; }).slice(0, 3).map(gameCard).join('') + '</div></div></div>' +
      '<div class="card" style="margin-top:16px"><div class="card-b"><h3>Latest streetwear</h3><div class="grid">' + products.slice(0, 3).map(productCard).join('') + '</div></div></div>' +
      '<div class="card" style="margin-top:16px"><div class="card-b"><h3>Community</h3><p class="muted">See the master leaderboard and fits gallery.</p><p><a class="btn" href="#/community">Community Hub</a></p></div></div></aside></div></div></section>';
    document.querySelectorAll('#gb-rate button').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!me) { location.hash = '#/login'; return; }
        try { var d = await api('/api/rate', { method: 'POST', body: JSON.stringify({ game_id: g.id, rating: parseInt(b.getAttribute('data-star'), 10) }) }); document.getElementById('gb-rate-msg').textContent = 'Average: ' + d.average + ' / 5'; }
        catch (e) { document.getElementById('gb-rate-msg').textContent = e.message; }
      });
    });
    loadDemoGame(g);
  }

  function loadDemoGame(g) {
    var stage = document.getElementById('gb-stage');
    if (!stage || !g.demo) { if (stage) stage.innerHTML = '<p class="notice">No playable demo is linked for this game yet. An admin must set a Demo in Admin. No fake game is shown.</p>'; return; }
    stage.innerHTML = '<div><canvas id="gb-canvas" width="800" height="480"></canvas><p><button id="gb-start" class="btn">Start Game</button> <span id="gb-status" class="muted"></span></p><p id="gb-score" style="font-weight:800;color:#F5CC70">Score: 0</p></div>';
    var canvas = document.getElementById('gb-canvas'), ctx = canvas.getContext('2d'), score = 0, running = false, token = null, startedAt = 0;
    function setScore(v) { score = v; document.getElementById('gb-score').textContent = 'Score: ' + score; }
    function setStatus(t) { document.getElementById('gb-status').textContent = t; }
    var keys = {};
    document.addEventListener('keydown', function (e) { keys[e.key] = true; if (e.key === ' ') e.preventDefault(); });
    document.addEventListener('keyup', function (e) { keys[e.key] = false; });
    async function startSession(cb) {
      if (!me) { setStatus('Guest mode — log in to save your score.'); cb(); return; }
      try { var d = await api('/api/session', { method: 'POST', body: JSON.stringify({ game_id: g.id }) }); token = d.token; startedAt = Date.now(); setStatus('Session started — good luck!'); }
      catch (e) { setStatus('Session failed; playing in guest mode.'); }
      cb();
    }
    async function submitScore() {
      if (!token) { setStatus('Game over! Final score: ' + score + ' (not saved — log in and start again for a scored run).'); return; }
      var duration = Math.round((Date.now() - startedAt) / 1000), t = token; token = null;
      try { await api('/api/score', { method: 'POST', body: JSON.stringify({ game_id: g.id, score: score, token: t, duration: duration }) }); setStatus('Game over! Score saved: ' + score); }
      catch (e) { setStatus('Game over! Score not saved: ' + e.message); }
    }
    document.getElementById('gb-start').addEventListener('click', function () {
      if (running) return; running = true; setScore(0);
      startSession(function () {
        if (g.demo === 'coin-rush') {
          var px = 400, py = 240, coin = { x: 200, y: 120 }, left = 60;
          var loop = setInterval(function () {
            if (keys.ArrowLeft || keys.a) px -= 6; if (keys.ArrowRight || keys.d) px += 6; if (keys.ArrowUp || keys.w) py -= 6; if (keys.ArrowDown || keys.s) py += 6;
            px = Math.max(16, Math.min(784, px)); py = Math.max(16, Math.min(464, py));
            if (Math.abs(px - coin.x) < 34 && Math.abs(py - coin.y) < 34) { setScore(score + 100); coin = { x: 40 + Math.random() * 720, y: 40 + Math.random() * 400 }; }
            ctx.fillStyle = '#0b0e13'; ctx.fillRect(0, 0, 800, 480); ctx.fillStyle = '#F5CC70'; ctx.beginPath(); ctx.arc(coin.x, coin.y, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#D6A94B'; ctx.fillRect(px - 16, py - 16, 32, 32); ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.fillText('Time: ' + left + 's', 16, 28);
          }, 33);
          var clock = setInterval(function () { left--; if (left <= 0) { clearInterval(loop); clearInterval(clock); running = false; submitScore(); } }, 1000);
        } else if (g.demo === 'neon-shooter') {
          var sx = 400, bullets = [], enemies = [], et = 0;
          for (var i = 0; i < 5; i++) enemies.push({ x: 80 + i * 140, y: 60, d: 1 });
          var loop2 = setInterval(function () {
            if (keys.ArrowLeft || keys.a) sx -= 7; if (keys.ArrowRight || keys.d) sx += 7; sx = Math.max(20, Math.min(780, sx));
            if (keys[' '] && et % 8 === 0) bullets.push({ x: sx, y: 420 }); et++;
            bullets.forEach(function (b) { b.y -= 10; }); bullets = bullets.filter(function (b) { return b.y > 0; });
            enemies.forEach(function (e) { e.x += e.d * 2; if (e.x > 760 || e.x < 40) e.d *= -1; e.y += 0.2; });
            bullets.forEach(function (b) { enemies.forEach(function (e) { if (Math.abs(b.x - e.x) < 26 && Math.abs(b.y - e.y) < 26 && e.y < 9000) { e.y = 9999; setScore(score + 50); } }); });
            if (enemies.every(function (e) { return e.y > 9000; }) || enemies.some(function (e) { return e.y > 420; })) { clearInterval(loop2); running = false; submitScore(); return; }
            ctx.fillStyle = '#0b0e13'; ctx.fillRect(0, 0, 800, 480); ctx.fillStyle = '#F5CC70'; ctx.fillRect(sx - 18, 430, 36, 18); ctx.fillStyle = '#fff'; bullets.forEach(function (b) { ctx.fillRect(b.x - 2, b.y, 4, 12); }); ctx.fillStyle = '#ff5a5a'; enemies.forEach(function (e) { if (e.y < 9000) ctx.fillRect(e.x - 20, e.y, 40, 24); });
          }, 33);
        } else if (g.demo === 'pixel-memory') {
          var symbols = ['🪙', '🎮', '👾', '⭐', '🚀', '💎', '🕹️', '👑'];
          var cards = symbols.concat(symbols).sort(function () { return Math.random() - 0.5; });
          var flipped = [], matched = [], lock = false;
          function draw() {
            ctx.fillStyle = '#0b0e13'; ctx.fillRect(0, 0, 800, 480);
            cards.forEach(function (s, i) { var x = 80 + (i % 4) * 170, y = 40 + Math.floor(i / 4) * 115; ctx.fillStyle = (flipped.indexOf(i) !== -1 || matched.indexOf(i) !== -1) ? '#191D24' : '#D6A94B'; ctx.fillRect(x, y, 140, 95); if (flipped.indexOf(i) !== -1 || matched.indexOf(i) !== -1) { ctx.fillStyle = '#fff'; ctx.font = '40px sans-serif'; ctx.fillText(s, x + 45, y + 62); } });
          }
          canvas.addEventListener('click', function (e) {
            if (!running || lock) return; var r = canvas.getBoundingClientRect(), mx = (e.clientX - r.left) * 800 / r.width, my = (e.clientY - r.top) * 480 / r.height;
            var col = Math.floor((mx - 80) / 170), row = Math.floor((my - 40) / 115); if (col < 0 || col > 3 || row < 0 || row > 1) return; var idx = row * 4 + col;
            if (flipped.indexOf(idx) !== -1 || matched.indexOf(idx) !== -1) return; flipped.push(idx); draw();
            if (flipped.length === 2) { lock = true; setTimeout(function () { if (cards[flipped[0]] === cards[flipped[1]]) { matched = matched.concat(flipped); setScore(score + 100); if (matched.length === 16) { running = false; submitScore(); } } flipped = []; lock = false; draw(); }, 600); }
          });
          draw();
        }
      });
    });
  }

  async function viewUnity() {
    var unity = await api('/api/unity');
    var team = await api('/api/team').catch(function () { return []; });
    app.innerHTML = '<section class="sec"><div class="wrap"><h1>Unity Studio</h1><p class="muted">Releases, prototypes and the people building them. All projects are managed in Admin — no hard-coded game list.</p><h2>Featured Releases</h2><div class="grid">' + unity.filter(function (u) { return u.featured; }).map(unityCard).join('') + '</div><h2 style="margin-top:40px">All Projects</h2><div class="grid">' + unity.map(unityCard).join('') + '</div><h2 style="margin-top:40px">Studio Team</h2><p class="muted">Team profiles are created in Admin only. No team member is invented in code — if none are added, this section stays empty rather than showing fake people.</p><div class="grid">' + team.map(function (t) { return '<article class="card"><div class="card-b"><h3>' + esc(t.name) + '</h3><p class="muted">' + esc(t.role) + '</p><p>' + esc(t.bio) + '</p></div></article>'; }).join('') + '</div></div></section>';
  }
  async function viewUnityProject(slug) {
    var u = await api('/api/unity/' + encodeURIComponent(slug));
    var all = await api('/api/unity');
    app.innerHTML = '<section class="sec"><div class="wrap"><p><a href="#/unity">← Unity Studio</a></p><div class="thumb" style="aspect-ratio:21/9">🎮</div><h1>' + esc(u.title) + '</h1><p><span class="badge">' + esc(u.status) + '</span>' + (u.genre ? '<span class="badge">' + esc(u.genre) + '</span>' : '') + '</p><p>' +
      (u.browser_build_url ? '<a class="btn" href="' + esc(u.browser_build_url) + '" target="_blank" rel="noopener">PLAY NOW (BROWSER)</a>' : '<span class="notice" style="display:inline-block">Browser build not yet published — check back soon.</span>') +
      (u.download_url ? ' <a class="btn-o" href="' + esc(u.download_url) + '">DOWNLOAD FREE (PC/MAC)</a>' : ' <span class="muted">PC/Mac download not yet published.</span>') + '</p>' +
      (u.trailer_url ? '<h2>Trailer</h2><p><a href="' + esc(u.trailer_url) + '" target="_blank" rel="noopener">Watch trailer</a></p>' : '') +
      '<p>' + esc(u.description) + '</p><h2>Game Information</h2><table><tbody><tr><th>Engine</th><td>' + esc(u.engine) + '</td></tr><tr><th>Genre</th><td>' + esc(u.genre) + '</td></tr><tr><th>Controls</th><td>' + esc(u.controls) + '</td></tr><tr><th>Platforms</th><td>' + esc(u.platform) + '</td></tr><tr><th>Release status</th><td>' + esc(u.status) + '</td></tr></tbody></table><h2>Related Projects</h2><div class="grid">' + all.filter(function (x) { return x.slug !== u.slug; }).slice(0, 4).map(unityCard).join('') + '</div></div></section>';
  }

  async function viewShop() {
    var products = await api('/api/products');
    var cats = ['All', 'T-Shirts', 'Hoodies', 'Sweatshirts', 'Gaming Accessories', 'Limited Edition Drops', 'New Arrivals'];
    app.innerHTML = '<section class="sec"><div class="wrap"><h1>Streetwear Shop</h1><p class="muted">Real products, cart and checkout in Neon. Use coupon <b>GEGA10</b> for 10% off (test coupon).</p><p>' + cats.map(function (c) { return '<button class="btn-o" data-cat="' + esc(c) + '">' + esc(c) + '</button> '; }).join('') + '</p><div class="grid" id="gb-shop">' + products.map(productCard).join('') + '</div></div></section>';
    document.querySelectorAll('[data-cat]').forEach(function (b) { b.addEventListener('click', function () { var cat = b.getAttribute('data-cat'); document.getElementById('gb-shop').innerHTML = products.filter(function (p) { return cat === 'All' || p.category === cat; }).map(productCard).join('') || '<p class="notice">No products in this category yet.</p>'; }); });
  }
  async function viewProduct(id) {
    var p = await api('/api/products/' + id);
    var all = await api('/api/products');
    app.innerHTML = '<section class="sec"><div class="wrap"><p><a href="#/shop">← Shop</a></p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px"><div class="thumb" style="font-size:120px">' + esc(p.emoji) + '</div><div><h1>' + esc(p.name) + '</h1><p>' + (p.sale_price ? '<s class="muted">' + money(p.price) + '</s> <b>' + money(p.sale_price) + '</b>' : '<b>' + money(p.price) + '</b>') + '</p><p class="stars">' + stars(p.rating) + '</p><p class="muted">' + esc(p.description) + '</p><p><label>Size</label><select id="gb-size"><option>S</option><option selected>M</option><option>L</option><option>XL</option><option>XXL</option></select><label>Colour</label><select id="gb-color"><option>Black</option><option>Gold</option><option>White</option><option>Grey</option></select><label>Quantity</label><input id="gb-qty" type="number" value="1" min="1" max="99"></p><p><button class="btn" id="gb-add">Add to Cart</button> <button class="btn-o" onclick="gbWish(' + p.id + ')">♡ Wishlist</button></p><p class="muted">Stock: ' + p.stock + ' · Reviews: WooCommerce-style reviews are in the WordPress version; here ratings show on the card.</p></div></div><h2>Related products</h2><div class="grid">' + all.filter(function (x) { return x.id !== p.id; }).slice(0, 4).map(productCard).join('') + '</div></div></section>';
    document.getElementById('gb-add').addEventListener('click', function () { gbAddCart(p.id, parseInt(document.getElementById('gb-qty').value, 10) || 1); location.hash = '#/cart'; });
  }
  function viewCart() {
    var cart = getCart();
    app.innerHTML = '<section class="sec"><div class="wrap"><h1>Cart</h1><div id="gb-cart"></div><p><a class="btn" href="#/checkout">Checkout</a> <a class="btn-o" href="#/shop">Continue shopping</a></p></div></section>';
    (async function () {
      if (!cart.length) { document.getElementById('gb-cart').innerHTML = '<p class="muted">Your cart is empty.</p>'; return; }
      var rows = '';
      for (var i = 0; i < cart.length; i++) {
        var p = await api('/api/products/' + cart[i].product_id).catch(function () { return null; });
        if (p) rows += '<p>' + esc(p.emoji) + ' ' + esc(p.name) + ' × ' + cart[i].qty + ' — ' + money((p.sale_price || p.price) * cart[i].qty) + ' <button class="btn-o" data-rm="' + i + '">Remove</button></p>';
      }
      document.getElementById('gb-cart').innerHTML = rows;
      document.querySelectorAll('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { var c = getCart(); c.splice(parseInt(b.getAttribute('data-rm'), 10), 1); setCart(c); viewCart(); }); });
    })();
  }
  function viewCheckout() {
    var cart = getCart();
    if (!cart.length) { app.innerHTML = '<section class="sec"><div class="wrap"><h1>Checkout</h1><p class="muted">Your cart is empty.</p><p><a class="btn" href="#/shop">Shop now</a></p></div></section>'; return; }
    app.innerHTML = '<section class="sec"><div class="wrap"><h1>Checkout</h1><p class="notice">TEST MODE — no payment gateway is connected yet. This creates a real order in Neon, but no money is charged.</p><form id="gb-co"><label>Full name</label><input name="name" required><label>Billing address</label><input name="billing" required><label>Shipping address</label><input name="shipping" required><label>Coupon (optional, try GEGA10)</label><input name="coupon"><button class="btn" type="submit">Place Order</button></form><p id="gb-co-msg"></p></div></section>';
    document.getElementById('gb-co').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      try { var d = await api('/api/orders', { method: 'POST', body: JSON.stringify({ items: cart, coupon: fd.get('coupon') }) }); setCart([]); document.getElementById('gb-co-msg').innerHTML = '<p class="notice">Order confirmed! Order #' + d.order.id + ' — Total ' + money(d.order.total) + ' — Status: ' + esc(d.order.status) + '. ' + esc(d.note) + ' <a href="#/dashboard">See My Orders</a></p>'; }
      catch (err) { document.getElementById('gb-co-msg').textContent = err.message; }
    });
  }
  async function viewCommunity() {
    var gallery = await api('/api/gallery').catch(function () { return []; });
    var lb = await leaderboardHTML('weekly', 0, 5);
    app.innerHTML = '<section class="sec"><div class="wrap"><h1>Community Hub</h1><p class="muted">Leaderboards, player fits and active members. Uploads are moderated before they appear publicly.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px"><div><h2>Master Leaderboard</h2><p><a class="btn-o" href="#/leaderboard">Daily / Weekly / Monthly / All-time</a></p>' + await leaderboardHTML('all', 0, 20) +
      '<h2 style="margin-top:40px">Streetwear Fits Gallery</h2><div class="grid">' + (gallery.length ? gallery.map(function (it) { return '<article class="card"><div class="thumb" style="aspect-ratio:1/1"><img src="' + esc(it.image_url) + '" alt=""></div><div class="card-b"><p>' + esc(it.caption) + '</p><p class="muted">by ' + esc(it.username) + ' · ❤ ' + it.likes + '</p></div></article>'; }).join('') : '<p class="muted">No approved fits yet. Uploads appear here after admin moderation.</p>') + '</div>' +
      '<h2 style="margin-top:40px">Share your fit</h2><div id="gb-up">' + (me ? '<form id="gb-upf"><label>Photo (JPG/PNG/WebP, max ~2 MB)</label><input type="file" id="gb-file" accept="image/jpeg,image/png,image/webp" required><label>Caption</label><input id="gb-cap" maxlength="200"><button class="btn" type="submit">Submit for moderation</button></form><p id="gb-up-msg"></p>' : '<p>Please <a href="#/login">log in</a> to upload a fit photo.</p>') + '</div></div>' +
      '<aside><div class="card"><div class="card-b"><h3>Featured players</h3>' + lb + '</div></div><div class="card" style="margin-top:16px"><div class="card-b"><h3>Follow GEGABYTE</h3><p class="muted">Replace these with the studio\'s real social URLs before launch — they are not linked to fake accounts.</p><p>Instagram · Discord · YouTube</p></div></div></aside></div></div></section>';
    var f = document.getElementById('gb-upf');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      var file = document.getElementById('gb-file').files[0];
      if (!file) return;
      var rd = new FileReader();
      rd.onload = async function () {
        try { var d = await api('/api/gallery', { method: 'POST', body: JSON.stringify({ image_url: rd.result, caption: document.getElementById('gb-cap').value }) }); document.getElementById('gb-up-msg').textContent = d.message; }
        catch (err) { document.getElementById('gb-up-msg').textContent = err.message; }
      };
      rd.readAsDataURL(file);
    });
  }
  async function viewLeaderboard() {
    var params = new URLSearchParams(location.hash.split('?')[1] || '');
    var period = params.get('period') || 'all';
    app.innerHTML = '<section class="sec"><div class="wrap"><h1>Master Leaderboard — ' + esc(period) + '</h1><p class="muted">Verified scores only. Daily = today, Weekly = last 7 days, Monthly = last 30 days, All-time = everything verified.</p><p><a class="btn-o" href="#/leaderboard?period=daily">Daily</a> <a class="btn-o" href="#/leaderboard?period=weekly">Weekly</a> <a class="btn-o" href="#/leaderboard?period=monthly">Monthly</a> <a class="btn-o" href="#/leaderboard">All-time</a></p>' + await leaderboardHTML(period, 0, 50) + '</div></section>';
  }
  function viewLogin() {
    app.innerHTML = '<section class="sec"><div class="wrap"><h1>My Account</h1><p class="muted">First account created on a fresh database becomes Admin. No default password exists.</p><form id="gb-login"><label>Email</label><input name="email" type="email" required><label>Password</label><input name="password" type="password" required><button class="btn" type="submit">Login</button></form><p id="gb-msg"></p><h2>Register</h2><form id="gb-signup"><label>Display name</label><input name="name" required><label>Email</label><input name="email" type="email" required><label>Password (8+ chars)</label><input name="password" type="password" required><button class="btn" type="submit">Create account</button></form><p id="gb-msg2"></p><p class="muted">Forgot password / email verification: not in v1 — reset via Admin (create a new account or use --create-user on the server). This is stated honestly, not faked with a dead reset form.</p></div></section>';
    document.getElementById('gb-login').addEventListener('submit', async function (e) { e.preventDefault(); var fd = new FormData(e.target); try { await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }) }); await refreshMe(); location.hash = '#/dashboard'; } catch (err) { document.getElementById('gb-msg').textContent = err.message; } });
    document.getElementById('gb-signup').addEventListener('submit', async function (e) { e.preventDefault(); var fd = new FormData(e.target); try { await api('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email: fd.get('email'), password: fd.get('password'), displayName: fd.get('name') }) }); await refreshMe(); location.hash = '#/dashboard'; } catch (err) { document.getElementById('gb-msg2').textContent = err.message; } });
  }
  async function viewDashboard() {
    if (!me) { location.hash = '#/login'; return; }
    var d = await api('/api/dashboard').catch(function () { return { scores: [], uploads: [] }; });
    var orders = await api('/api/orders').catch(function () { return []; });
    var wish = getWish();
    var wishHtml = '';
    if (wish.length) { var prods = await api('/api/products'); wishHtml = prods.filter(function (p) { return wish.indexOf(p.id) !== -1; }).map(productCard).join(''); }
    app.innerHTML = '<section class="sec"><div class="wrap"><h1>Hi, ' + esc(me.display_name) + '</h1><p class="muted">Your games, scores, orders and uploads. ' + (me.role === 'admin' ? '<a href="#/admin">Admin Dashboard →</a>' : '') + '</p><h2>Your high scores</h2>' + (d.scores.length ? '<table><thead><tr><th>Game</th><th>Score</th><th>Date</th></tr></thead><tbody>' + d.scores.map(function (s) { return '<tr><td>' + esc(s.game_title) + '</td><td>' + Number(s.score).toLocaleString() + '</td><td>' + new Date(s.created_at).toLocaleDateString() + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">No verified scores yet.</p>') +
      '<h2 style="margin-top:32px">Order history</h2>' + (orders.length ? '<ul>' + orders.map(function (o) { return '<li>#' + o.id + ' — ' + esc(o.status) + ' — ' + money(o.total) + '</li>'; }).join('') + '</ul>' : '<p class="muted">No orders yet.</p>') +
      '<h2 style="margin-top:32px">Your uploads</h2>' + (d.uploads.length ? d.uploads.map(function (u) { return '<p>' + esc(u.caption) + ' — <em>' + esc(u.moderation_status) + '</em></p>'; }).join('') : '<p class="muted">No uploads yet.</p>') +
      '<h2 style="margin-top:32px">Wishlist (this browser)</h2><div class="grid">' + (wishHtml || '<p class="muted">No wishlist items yet.</p>') + '</div></div></section>';
  }
  async function viewAdmin() {
    if (!me || me.role !== 'admin') { app.innerHTML = '<section class="sec"><div class="wrap"><h1>Admin</h1><p class="notice">Admin only. Log in with the first account created on this database.</p></div></section>'; return; }
    var ov = await api('/api/admin/overview').catch(function () { return {}; });
    var pending = await api('/api/admin/gallery-pending').catch(function () { return []; });
    app.innerHTML = '<section class="sec"><div class="wrap"><h1>Admin Dashboard</h1><p class="muted">Users: ' + ov.users + ' · Verified scores: ' + ov.verified_scores + ' · Orders: ' + ov.orders + ' · Pending gallery: ' + ov.pending_gallery + '</p>' +
      '<h2>Add Unity project</h2><form id="gb-au"><label>Title</label><input name="title" required><label>Slug</label><input name="slug" required><label>Status</label><select name="status"><option>Released</option><option>Prototype</option><option>In Development</option><option>Coming Soon</option></select><label>Browser build URL (ONLY a real build — leave empty if none)</label><input name="browser_build_url"><label>Download URL (ONLY a real file — leave empty if none)</label><input name="download_url"><label>Genre / Platform</label><input name="genre"><input name="platform"><button class="btn" type="submit">Add Unity project</button></form><p id="gb-au-msg"></p>' +
      '<h2>Add Arcade game (demo)</h2><form id="gb-ag"><label>Title</label><input name="title" required><label>Slug</label><input name="slug" required><label>Category</label><input name="category" value="Retro Games"><label>Demo (coin-rush / neon-shooter / pixel-memory)</label><input name="demo"><label>Description</label><input name="description"><button class="btn" type="submit">Add game</button></form><p id="gb-ag-msg"></p>' +
      '<h2>Add Product</h2><form id="gb-ap"><label>Name</label><input name="name" required><label>Slug</label><input name="slug" required><label>Price</label><input name="price" type="number" step="0.01" required><label>Category</label><input name="category" value="T-Shirts"><button class="btn" type="submit">Add product</button></form><p id="gb-ap-msg"></p>' +
      '<h2>Add Team member</h2><form id="gb-at"><label>Name</label><input name="name" required><label>Role</label><input name="role"><label>Bio</label><input name="bio"><button class="btn" type="submit">Add team member</button></form><p id="gb-at-msg"></p>' +
      '<h2>Pending gallery</h2><div id="gb-pending">' + (pending.length ? pending.map(function (it) { return '<p><img src="' + esc(it.image_url) + '" style="width:120px"> ' + esc(it.caption) + ' <button class="btn" data-approve="' + it.id + '">Approve</button> <button class="btn-o" data-reject="' + it.id + '">Reject</button></p>'; }).join('') : '<p class="muted">No pending uploads.</p>') + '</div></div></section>';
    function bind(formId, url, msgId) {
      document.getElementById(formId).addEventListener('submit', async function (e) { e.preventDefault(); var fd = new FormData(e.target); var body = {}; fd.forEach(function (v, k) { body[k] = v; }); try { await api(url, { method: 'POST', body: JSON.stringify(body) }); document.getElementById(msgId).textContent = 'Saved.'; } catch (err) { document.getElementById(msgId).textContent = err.message; } });
    }
    bind('gb-au', '/api/admin/unity', 'gb-au-msg'); bind('gb-ag', '/api/admin/games', 'gb-ag-msg'); bind('gb-ap', '/api/admin/products', 'gb-ap-msg'); bind('gb-at', '/api/admin/team', 'gb-at-msg');
    document.querySelectorAll('[data-approve]').forEach(function (b) { b.addEventListener('click', async function () { await api('/api/admin/gallery/' + b.getAttribute('data-approve') + '/moderate', { method: 'POST', body: JSON.stringify({ status: 'approved' }) }); render(); }); });
    document.querySelectorAll('[data-reject]').forEach(function (b) { b.addEventListener('click', async function () { await api('/api/admin/gallery/' + b.getAttribute('data-reject') + '/moderate', { method: 'POST', body: JSON.stringify({ status: 'rejected' }) }); render(); }); });
  }
  function viewStatic(title, body) { app.innerHTML = '<section class="sec"><div class="wrap"><h1>' + title + '</h1><p>' + body + '</p></div></section>'; }
  async function render() {
    await refreshMe();
    var hash = location.hash.replace(/^#/, '') || '/';
    var path = hash.split('?')[0];
    try {
      if (path === '/') await viewHome();
      else if (path === '/arcade') await viewArcade();
      else if (path.indexOf('/game/') === 0) await viewGame(decodeURIComponent(path.slice(6)));
      else if (path === '/unity') await viewUnity();
      else if (path.indexOf('/unity/') === 0) await viewUnityProject(decodeURIComponent(path.slice(7)));
      else if (path === '/shop') await viewShop();
      else if (path.indexOf('/product/') === 0) await viewProduct(path.slice(9));
      else if (path === '/cart') viewCart();
      else if (path === '/checkout') viewCheckout();
      else if (path === '/community') await viewCommunity();
      else if (path === '/leaderboard') await viewLeaderboard();
      else if (path === '/login') viewLogin();
      else if (path === '/logout') { await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(function () {}); await refreshMe(); location.hash = '#/'; }
      else if (path === '/dashboard') await viewDashboard();
      else if (path === '/admin') await viewAdmin();
      else if (path === '/contact') viewStatic('Contact Us', 'Contact form: use the form in the WordPress version, or email the studio directly. No contact details are invented here — add the studio\'s real email / address in Admin before launch.');
      else if (path === '/about') viewStatic('About Us', 'SAMPLE — replace with the real studio story, team and mission before launch.');
      else if (path === '/privacy') viewStatic('Privacy Policy', 'SAMPLE — have this reviewed before launch. It must describe what this site, Neon and any payment provider actually collect.');
      else if (path === '/terms') viewStatic('Terms and Conditions', 'SAMPLE — have this reviewed before launch.');
      else app.innerHTML = '<section class="sec"><div class="wrap"><h1>Page not found</h1><p><a href="#/">Back home</a></p></div></section>';
    } catch (e) { app.innerHTML = '<section class="sec"><div class="wrap"><p class="notice">' + esc(e.message) + '</p><p class="muted">If this says Database not ready, set DATABASE_URL (Neon) in Vercel and redeploy — see README.md.</p></div></section>'; }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  render();
})();
