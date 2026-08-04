# ProEd Coder AI — Deployment Guide

> Built by AXCEL · Phase 5.1 (Auth + Deploy)

This guide covers two deployment paths:

- **Path A** — Vercel + Neon + Voyage AI embeddings (recommended for demo speed)
- **Path B** — Railway all-in-one (Next.js + Postgres, no cold starts)

Path C (Vercel frontend + Railway Postgres + Xenova) is possible but requires switching embeddings anyway, so it collapses into Path A.

---

## Before You Start — Prerequisites

- Neon or Railway Postgres already provisioned with pgvector extension
- Data seeded (`seed:icd10`, `seed:hcc`, `seed:hcpcs`, `seed:cpt`, `seed:hedis`, `seed:policies`)
- Groq API key (free from https://console.groq.com)
- A working local dev — before deploying, confirm `npm run dev` works with your latest code

Generate a strong `AUTH_SECRET`:
```powershell
# Windows PowerShell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```
Or use https://generate-secret.vercel.app/32

---

## Path A — Vercel + Neon + Voyage AI

### Step 1 — Get a Voyage AI API key

1. Go to https://www.voyageai.com and sign up (free tier: 10 M tokens/mo — you'll use ~50k/mo)
2. Create an API key, copy it. Format: `pa-xxxxxxxxxx`

### Step 2 — Push code to a Git repo

```powershell
cd D:\proed-coder-ai
git init
git add .
git commit -m "Initial deploy"
git remote add origin https://github.com/YOUR-ORG/proed-coder-ai.git
git push -u origin main
```

Make sure `.env` is in `.gitignore` (it should be).

### Step 3 — Create a Vercel project

1. Go to https://vercel.com/new and import the repo
2. Framework preset: Next.js (auto-detected)
3. Root directory: `.` (default)
4. Build & Output settings: leave default — `vercel.json` handles them
5. Don't click Deploy yet — first configure environment variables

### Step 4 — Set environment variables in Vercel

In the "Environment Variables" section of the project setup, add each of these:

| Key | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string (from Neon dashboard → Connection details) |
| `AUTH_SECRET` | Generated 32-byte string |
| `APP_PASSWORD` | The team password |
| `AUTH_TRUST_HOST` | `true` |
| `GROQ_API_KEY` | From Groq console |
| `LLM_PROVIDER` | `groq` |
| `EMBEDDING_PROVIDER` | `voyage` |
| `VOYAGE_API_KEY` | From Voyage AI dashboard |

**Important:** For the DB URL, use Neon's **pooled** connection string (has `-pooler` in the host). Vercel serverless connects/disconnects rapidly and the pooled connection handles it better.

### Step 5 — Deploy

Click **Deploy**. Wait ~2 minutes.

If the build fails with a Prisma error, check that:
- `postinstall` script runs (`prisma generate`)
- `DATABASE_URL` is set correctly

### Step 6 — Test the live deployment

1. Vercel gives you a URL like `https://proed-coder-ai.vercel.app`
2. Open it — you should be redirected to `/login`
3. Enter the `APP_PASSWORD` you set
4. Try a search: `Type 2 diabetes with neuropathy`
5. Try a query form draft

Also test the health endpoint publicly:
```
https://proed-coder-ai.vercel.app/api/health
```
Should return `{"status":"ok","db":"reachable",...}`

### Step 7 — Custom domain (optional but recommended)

1. Vercel project → Settings → Domains
2. Add `coder.axcelworld.com` (or similar)
3. Add the CNAME record in your DNS provider as instructed
4. Vercel auto-provisions SSL

**No code change needed** — `AUTH_TRUST_HOST=true` and NextAuth handles the domain automatically.

---

## Path B — Railway All-in-One (Next.js + Postgres)

Simpler infrastructure, no cold starts, Xenova works. Best if you want the simplest possible operational story.

### Step 1 — Create a Railway project

1. Go to https://railway.app and create a new project
2. Deploy from GitHub — connect your repo
3. Railway detects Next.js and sets up the build

### Step 2 — Add a Postgres service

1. In the project, click **New Service** → **Database** → **Add PostgreSQL**
2. Railway spins up a Postgres 16 instance ($5/mo hobby tier)
3. Enable pgvector:
   - Railway Postgres UI → Data → SQL Editor
   - Run: `CREATE EXTENSION IF NOT EXISTS vector;`

### Step 3 — Copy the connection string

Railway Postgres service → **Variables** tab → copy `DATABASE_URL`.

### Step 4 — Set environment variables on the Next.js service

Next.js service → **Variables** tab. Add:

| Key | Value |
|---|---|
| `DATABASE_URL` | From Postgres service (or use Railway's variable reference: `${{Postgres.DATABASE_URL}}`) |
| `AUTH_SECRET` | Generated 32-byte string |
| `APP_PASSWORD` | Team password |
| `AUTH_TRUST_HOST` | `true` |
| `GROQ_API_KEY` | From Groq console |
| `LLM_PROVIDER` | `groq` |
| `EMBEDDING_PROVIDER` | `xenova` (works fine on Railway) |

### Step 5 — Generate schema + seed data

You need to run `db:push` and the seed scripts against the new Railway DB.

**Option 1 — Run locally against Railway DB (fastest):**
1. Copy Railway `DATABASE_URL` to your local `.env` temporarily
2. `npm run db:push`
3. `npm run seed:icd10` (2 hours)
4. `npm run seed:hcc`
5. `npm run seed:hcpcs`
6. `npm run seed:cpt`
7. `npm run seed:hedis`
8. `npm run seed:policies`
9. Restore your local `.env` to point back at Neon (or leave pointing at Railway if you're migrating)

**Option 2 — Migrate data from Neon:**
```powershell
# Dump from Neon
pg_dump "$NEON_DATABASE_URL" > proed-dump.sql

# Restore to Railway
psql "$RAILWAY_DATABASE_URL" < proed-dump.sql
```

### Step 6 — Deploy the Next.js service

Push to GitHub, Railway auto-deploys. Or click **Deploy** in the dashboard.

### Step 7 — Public URL

Railway gives you a URL like `https://proed-coder-ai-production.up.railway.app`. Test the same way as Path A Step 6.

### Step 8 — Custom domain

Railway → Service → Settings → Networking → Custom Domain. Add CNAME to your DNS.

---

## Post-Deploy Checklist

- [ ] `/api/health` returns `{"status":"ok"}` when hit without auth
- [ ] Any protected page (`/`, `/query-forms`) redirects to `/login` when logged out
- [ ] Login with team password succeeds and redirects to home
- [ ] `Type 2 diabetes with neuropathy` search returns results in under 3 seconds
- [ ] Query form drafting works and shows policy citations
- [ ] Sign-out button works
- [ ] Custom domain (if set) resolves with valid SSL

---

## What's Not Yet In Phase 5

- **Email magic link auth** — Phase 5.2 (Resend integration)
- **Multi-user + roles** (Admin / Coder / Auditor) — Phase 5.3
- **Multi-tenant workspaces** — Phase 6 (per-client data isolation)
- **HIPAA hardening** (encryption at rest, audit log immutability) — Phase 6

For an MVP demo with ProEd, the current setup is sufficient. Full production hardening is Phase 6 (only worth building if ProEd signs).

---

## Rollback Plan

If something breaks after a deploy:

**On Vercel:**
- Deployments tab → click a previous working deployment → three-dot menu → **Promote to Production**

**On Railway:**
- Deployments tab → previous working deployment → **Redeploy**

---

## Cost Summary

| Component | Free tier | Paid tier |
|---|---|---|
| Vercel Hobby | $0 | Pro: $20/mo |
| Neon | $0 (0.5 GB) | Launch: $19/mo (10 GB) |
| Railway | — | Hobby: $5/mo Postgres + $5/mo app |
| Groq | $0 (rate-limited) | Dev tier: pay as you go |
| Voyage AI | $0 (10 M tokens/mo) | Paid: $0.10/M tokens |
| **Path A total** | **$0/mo** | **$39/mo** (Pro Vercel + Launch Neon) |
| **Path B total** | — | **$10/mo** (Railway app + Postgres) |

For a ProEd pilot: **Path A free tier works.** Upgrade only after signed contract.

---

Built by AXCEL · Questions: kamal@axcelworld.com
