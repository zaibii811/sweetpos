# SweetPOS Deployment Guide

## Services Used
- Frontend: Vercel (free)
- Backend: Render (free)
- Database: Supabase (free)

---

## Environment Variables

### Backend (set in Render dashboard)

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection String (URI mode) |
| `SESSION_SECRET` | Any random 32-character string |
| `NODE_ENV` | Set to: `production` |
| `CORS_ORIGIN` | Your Vercel frontend URL e.g. `https://sweetpos.vercel.app` |
| `RENDER_EXTERNAL_URL` | Your Render service URL e.g. `https://sweetpos-api.onrender.com` |
| `PORT` | Leave blank — Render sets this automatically |

### Frontend (set in Vercel dashboard)

| Variable | Where to get it |
|---|---|
| `VITE_API_URL` | Your Render backend URL e.g. `https://sweetpos-api.onrender.com` |

---

## Deployment Steps (in order)
1. Push this repo to GitHub
2. Set up Supabase database
3. Deploy backend to Render
4. Deploy frontend to Vercel
5. Test full connection

---

## Step-by-Step: Supabase

1. Go to [supabase.com](https://supabase.com) → Sign up free
2. New Project → give it a name → set a database password
3. Wait for project to provision (~2 min)
4. Go to **Project Settings → Database**
5. Copy the Connection String in **URI mode**
6. Replace `[YOUR-PASSWORD]` with your actual password
7. Use this as `DATABASE_URL` in Render

> The app auto-creates all tables and seeds staff + product data on first startup. No manual migrations needed.

---

## Step-by-Step: Render

1. Go to [render.com](https://render.com) → Sign up free with GitHub
2. **New → Web Service** → Connect your GitHub repo
3. Configure:
   - **Region:** Singapore (closest to Malaysia)
   - **Build command:**
     ```
     npm install -g pnpm && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build
     ```
   - **Start command:**
     ```
     node --enable-source-maps artifacts/api-server/dist/index.mjs
     ```
4. Add all backend environment variables listed above
5. Click **Deploy**
6. Copy your Render URL when deployment completes (e.g. `https://sweetpos-api.onrender.com`)
7. Test: visit `https://sweetpos-api.onrender.com/api/healthz` — should return `{"status":"ok"}`

---

## Step-by-Step: Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up free with GitHub
2. **New Project** → Import your GitHub repo
3. Set **Root Directory** to `artifacts/sweet-pos`
4. Framework will be auto-detected as **Vite**
5. Add environment variable: `VITE_API_URL` = your Render URL
6. Click **Deploy**
7. Copy your Vercel URL (e.g. `https://sweetpos.vercel.app`)
8. Go back to **Render → Environment** and set `CORS_ORIGIN` to this Vercel URL, then redeploy

---

## Step-by-Step: Test the connection

1. Open your Vercel URL in browser
2. Try logging in — if it works, the backend is connected
   - Owner login: username `owner`, password `sweetpos2024` (change this after first login!)
3. Add a test product in Inventory
4. Confirm it saves and reloads correctly
5. Open the same URL on your phone — confirm it works remotely

---

## Keep-Alive (Render free tier)

The backend includes an automatic keep-alive service that pings `/api/healthz` every 10 minutes **between 8 AM and 11 PM Malaysia time**. This prevents the Render free tier from sleeping during shop hours. Outside those hours the server sleeps normally.

The keep-alive activates automatically when `RENDER_EXTERNAL_URL` is set.

---

## Default Login Credentials (change after first deploy)

| Role | Username | Password | PIN |
|---|---|---|---|
| Owner | `owner` | `sweetpos2024` | `1234` |
| Manager (Siti) | — | — | `2222` |
| Cashier (Ahmad) | — | — | `3333` |
| Cashier (Nur Ain) | — | — | `4444` |
| Cashier (Farah) | — | — | `5555` |

> Change the owner password via **Staff → Edit → Password** after your first login in production.
