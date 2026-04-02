# SweetPOS Deployment Guide

Deploy SweetPOS for free using **Supabase** (PostgreSQL), **Render** (backend API), and **Vercel** (frontend).

---

## Architecture

```
Browser → Vercel (React frontend)
              ↓ API calls
         Render (Express backend)
              ↓ SQL
         Supabase (PostgreSQL)
```

---

## Step 1 — Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (pick the **Singapore** region for lowest latency from Malaysia)
3. Wait for the project to finish provisioning (~2 minutes)
4. Go to **Project Settings → Database → Connection string → URI**
5. Copy the URI — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
6. Keep this — it's your `DATABASE_URL`

> **Note:** The app auto-creates all tables and seeds real product data on first startup. No manual migrations needed.

---

## Step 2 — Render (Backend API)

### Create the service

1. Go to [render.com](https://render.com) and sign up (free)
2. Click **New → Web Service**
3. Connect your GitHub repository (push this project to GitHub first via Replit's Git panel)
4. Configure:
   - **Name:** `sweetpos-api`
   - **Region:** Singapore
   - **Runtime:** Node
   - **Build command:**
     ```
     npm install -g pnpm && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build
     ```
   - **Start command:**
     ```
     node --enable-source-maps artifacts/api-server/dist/index.mjs
     ```
   - **Plan:** Free

### Environment variables (set in Render dashboard)

| Variable | Value | Where to get it |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | Supabase → Project Settings → Database |
| `SESSION_SECRET` | Any long random string | Generate at [randomkeygen.com](https://randomkeygen.com) |
| `NODE_ENV` | `production` | Type this manually |
| `CORS_ORIGIN` | `https://your-app.vercel.app` | Set after Step 3, then update |
| `RENDER_EXTERNAL_URL` | `https://sweetpos-api.onrender.com` | Render shows this after first deploy |

### After deploying

- Render gives you a URL like `https://sweetpos-api.onrender.com`
- Test it: visit `https://sweetpos-api.onrender.com/api/healthz` — should return `{ "status": "ok" }`
- The keep-alive cron job will automatically ping this URL every 10 minutes between 8 AM–11 PM MYT

---

## Step 3 — Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) and sign up (free)
2. Click **Add New → Project** and import your GitHub repository
3. Set the **Root Directory** to `artifacts/sweet-pos`
4. Vercel will auto-detect Vite. Confirm:
   - **Framework:** Vite
   - **Build command:** (leave blank — `vercel.json` handles it)
   - **Output directory:** `dist/public`
5. Add environment variable:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://sweetpos-api.onrender.com` (your Render URL) |

6. Click **Deploy**

### After deploying

- Vercel gives you a URL like `https://sweetpos.vercel.app`
- Go back to **Render → sweetpos-api → Environment** and update `CORS_ORIGIN` to this URL
- Trigger a redeploy on Render so the new CORS setting takes effect

---

## Step 4 — End-to-End Test

1. Open your Vercel URL in the browser
2. Log in as owner: username `owner`, password `sweetpos2024`
3. Confirm the POS loads products
4. Place a test order and confirm it appears in Orders
5. Check Inventory and Reports

---

## Environment Variable Summary

### Backend (`artifacts/api-server`) — set in Render dashboard

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL connection URI |
| `SESSION_SECRET` | ✅ | Random string for session signing (min 32 chars) |
| `NODE_ENV` | ✅ | Must be `production` |
| `CORS_ORIGIN` | ✅ | Your Vercel frontend URL (e.g. `https://yourapp.vercel.app`) |
| `RENDER_EXTERNAL_URL` | ✅ | Your Render service URL (for keep-alive pings) |
| `PORT` | auto | Render sets this automatically — do not override |

### Frontend (`artifacts/sweet-pos`) — set in Vercel dashboard

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Your Render backend URL (e.g. `https://sweetpos-api.onrender.com`) |

---

## Troubleshooting

**Login works but pages show no data**
- Check `CORS_ORIGIN` on Render matches your Vercel URL exactly (no trailing slash)
- Open browser DevTools → Network and look for CORS errors on API calls

**Database connection error on Render**
- Confirm `DATABASE_URL` is correct (copy it fresh from Supabase)
- SSL is enabled automatically when the URL contains `supabase`

**Render service sleeping (first request takes 30+ seconds)**
- This is normal on the free tier for the first request after sleeping
- The keep-alive cron (8 AM–11 PM MYT) prevents sleeping during shop hours
- Upgrade to Render's Starter plan ($7/month) for always-on

**Vercel build fails**
- Ensure `VITE_API_URL` is set in Vercel environment variables before building
- Check that the GitHub repo has all files committed
