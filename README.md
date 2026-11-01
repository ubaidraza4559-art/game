# GEGABYTE — Vercel Version (same theme as WordPress, Vercel backend)

**Theme same hai, backend alag hai — ye zaroori tha, warna Vercel par chalta hi nahi:**
- Theme / design / pages / content WordPress version jaisa hi hai: dark metallic `#090A0D`, gold `#D6A94B / #F5CC70`, translucent sticky header, hero "PLAY. COMPETE. CONNECT.", 4 tiles (PLAY / SHOP / UNITY / CONNECT), arcade cards, Unity cards, product cards, leaderboards, community, dashboard, admin.
- Backend WordPress nahi hai, kyun ke WordPress PHP + MySQL par chalta hai, Vercel par nahi, aur Neon Postgres hai (MySQL nahi). Is liye ye version Node + Postgres hai, taake Vercel + Neon par sahi chale.
- WordPress package alag se maujood hai: `~/workspace/gegabyte/` — agar aap ko kabhi WordPress host chahiye to wohi use karein.

## Features (sab kaam karte hain, sirf test mode / no-fake limits ke saath)
- Home, Arcade Hub (category filter, search, sort), single game player (3 real demo games: Coin Rush, Neon Shooter, Pixel Memory), ratings, share, verified high scores
- Unity Studio + single project (Coin Rush, Alienteen, Alientech) — browser/download button SIRF tab dikhta hai jab admin ne real URL dala ho, warna "not yet published"
- Shop (6 SAMPLE products), product detail (size/color/qty), wishlist (browser), cart, checkout, coupon `GEGA10` (10% off, test)
- Community (fits gallery, moderation pending → admin approve), leaderboards (daily/weekly/monthly/all-time), dashboard (scores, orders, uploads), admin (games/Unity/products/team add, gallery moderate, score reject via API)
- Auth: signup/login/logout, pehla account Admin banta hai, koi default password nahi

## Honest limits
1. **Payment:** checkout Neon mein real order banata hai, lekin koi payment gateway connected nahi hai. Real paise mat lein jab tak Stripe/PayPal connect na ho.
2. **Scores:** session token Postgres mein store hota hai (serverless instances ke across kaam karta hai), single-use, 5s minimum, range-checked, rate-limited. Casual tampering rokta hai, prize competition ke liye cryptographic anti-cheat nahi hai.
3. **Forgot password / email verification:** v1 mein nahi hai — dead form nahi banaya. Admin `node server.js --create-user` se account bana sakta hai.
4. **Team / social / contact:** koi fake member, fake social account ya fake contact detail nahi hai. Admin se real data add karein.

## Local run
```bash
npm install
DATABASE_URL=postgresql://<local-user>:<local-password>@localhost:5432/gegabyte node server.js
# http://localhost:3000 — pehla signup Admin banega
```

## Vercel + Neon deploy (ye steps dashboard se honge, kyun ke Vercel MCP se Neon database create nahi hota)
1. GitHub par naya repo banayein (Muse GitHub App repo create nahi kar sakta — BizPilot mein bhi aap ne manually banaya tha), is folder ka code push karein, koi secret repo mein mat dalein.
2. Vercel → New Project → woh repo connect karein → Deploy.
3. Vercel dashboard → Storage → Create Database → Neon → **Free plan only, koi payment nahi** → us database ko `gegabyte` project se connect karein. Is se `DATABASE_URL` / `POSTGRES_URL` env vars automatically project mein aa jayengi.
4. Vercel → Project → Settings → Environment Variables mein `AUTH_SECRET` (koi lambi random string) add karein agar chahiye — is version mein sessions DB mein hain, is liye AUTH_SECRET zaroori nahi, lekin future ke liye rakh sakte hain.
5. Redeploy karein, phir live verify karein: signup → game khel kar score → leaderboard → shop order → admin.
6. **BizPilot ka Neon database (neon-charcoal-engine) dobara use mat karein** — us mein BizPilot ka data hai. GEGABYTE ke liye alag Neon database banayein.

## Env vars
- `DATABASE_URL` — Neon Postgres connection string (Vercel Neon integration se auto)
- `PORT` — local only
See `.env.example`. Kabhi bhi real `DATABASE_URL` chat, repo ya file mein mat likhein.
