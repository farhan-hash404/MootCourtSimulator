# Deploying CourtSimulator (Vercel + Render)

This is the live-hosting recipe: the React SPA on **Vercel**, the Express API and
the Python AI service on **Render**, and PostgreSQL on **Supabase** (already set
up). It mirrors the local topology exactly — the browser only ever talks to
`/api/*` on its own origin, and Vercel proxies that to Express, which is the one
service that calls the Python reasoner.

```
  Browser ──HTTPS──▶ Vercel (static SPA)
                       │  /api/*  (rewrite, same-origin cookie preserved)
                       ▼
                 Render: courtsim-api  (Express)
                       │  AI_SERVICE_URL
                       ▼
                 Render: courtsim-ai   (FastAPI + LangGraph)
                       │
                       ▼
                 Supabase Postgres (pgvector-free; jsonb embeddings + pg_trgm)
```

The config lives in two files, both already in the repo:

- [`render.yaml`](../render.yaml) — the two backend services (Docker, built from
  the existing `artifacts/*/Dockerfile`).
- [`vercel.json`](../vercel.json) — the static build command, output dir, and the
  `/api/*` → Render rewrite plus the SPA fallback.

---

## 0. Before you start

You need three accounts: **Supabase** (done — the DB is live and seeded), **Render**,
and **Vercel**. Push this repo to GitHub; both platforms deploy from a Git remote.

Have these three secrets ready — they are the same values your local `.env` uses:

| Secret | What it is |
|---|---|
| `DATABASE_URL` | The Supabase **pooler** connection string (`...pooler.supabase.com:5432/postgres`). |
| `OPENAI_API_KEY` | Your OpenAI key. |
| `AUTH_SECRET` | 32+ chars, signs the session cookie. Generate a fresh one for production: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

> The Supabase pooler is why `artifacts/ai-service/app/db.py` sets
> `statement_cache_size=0` — the pooler rejects asyncpg's prepared statements.
> That fix is already in the code; nothing to do here, just don't revert it.

---

## 1. Deploy the backends to Render (do this first)

Vercel needs the API's public URL, so Render goes first.

1. In Render: **New +** → **Blueprint** → connect this GitHub repo. Render reads
   `render.yaml` and proposes two services: **courtsim-ai** and **courtsim-api**.
2. It will prompt for the `sync:false` values. Set them on **both** services where
   they appear:
   - `courtsim-ai`: `DATABASE_URL`, `OPENAI_API_KEY`
   - `courtsim-api`: `DATABASE_URL`, `OPENAI_API_KEY`, `AUTH_SECRET`
   `AI_SERVICE_URL` is wired automatically from the AI service — leave it alone.
3. **Apply**. Render builds both Docker images (a few minutes; the AI image is
   ~750 MB). `courtsim-ai` becomes healthy at `/healthz`; `courtsim-api` at
   `/api/healthz`.
4. **Copy the API service's URL** from its Render page — e.g.
   `https://courtsim-api.onrender.com`. If the name `courtsim-api` was taken
   globally, Render appends a suffix (`courtsim-api-a1b2.onrender.com`) — use
   whatever it actually shows.

Quick check once both are green:

```bash
curl https://<your-courtsim-api-host>/api/healthz
curl https://<your-courtsim-api-host>/api/cases
```

The first should be `200`; the second should return the five seeded cases as JSON.

---

## 2. Point the frontend at your API

Open [`vercel.json`](../vercel.json) and replace the host in the `/api/*` rewrite
with the API URL you copied:

```json
{
  "source": "/api/:path*",
  "destination": "https://<your-courtsim-api-host>/api/:path*"
}
```

Commit and push. (The placeholder in the repo is `courtsim-api.onrender.com`; it
only works if Render gave you exactly that name.)

---

## 3. Deploy the frontend to Vercel

1. In Vercel: **Add New… → Project** → import this repo.
2. Leave **Root Directory** as the repo root. Vercel reads `vercel.json`, so the
   install command, build command (`pnpm --filter @workspace/adalat-ai run build`),
   and output directory (`artifacts/adalat-ai/dist/public`) are already set —
   don't override them.
3. No environment variables are needed for the web build: the SPA calls the
   relative `/api`, which the rewrite handles.
4. **Deploy.** When it finishes, open the Vercel URL, register an account, pick a
   case, and deliver an opening statement — the bench should respond.

---

## 4. Verify end-to-end

On the deployed Vercel URL:

1. **Register** → you land on the dashboard (the session cookie was set — proof
   the same-origin proxy + cookie chain works over HTTPS).
2. **Start a session** on *State v. Bilal Hussain* as petitioner.
3. **Opening statement** (typed via the Address control) → the judge replies.

If the judge does not reply, check `courtsim-api`'s logs on Render for an
`AI service unreachable` / timeout line, then confirm `courtsim-ai` is awake
(hit its `/healthz`).

---

## Caveats to know before a live demo

- **Free-tier cold starts.** Free Render services spin down after ~15 min idle.
  The first request wakes `courtsim-api`, and the first *courtroom turn* also
  triggers the AI service's ~49 s LangGraph import on top of its own cold start —
  so the very first turn after idle can take a minute or more. `AI_SERVICE_TIMEOUT_MS`
  is set to 120 s in `render.yaml` to tolerate this. **Warm both services by
  hitting their health URLs a minute before you present**, or move them to the
  `starter` plan ($7/mo each) to stop the spin-down.
- **Voice turns through the Vercel proxy are unverified.** Voice uploads up to
  25 MB of audio and streams the reply back as it is spoken. Small JSON calls
  (auth, cases, sessions, **typed** turns) go through the Vercel rewrite fine;
  the large-body streaming voice path may hit Vercel's proxy limits. The demo is
  fully deliverable with typed turns — treat voice as best-effort here, or call
  the Render API host directly for that path.
- **The AI service is a public web service on the free tier.** Render's private
  services need a paid plan, so `courtsim-ai` gets a public `.onrender.com` URL.
  It has no auth, so anyone who learns the URL could spend your OpenAI credits.
  For anything beyond a demo, make it a private service (`type: pserv`) on a paid
  plan; `AI_SERVICE_URL`'s `fromService` wiring keeps working unchanged.

---

## One-time database setup (only for a fresh Postgres)

The Supabase DB is already migrated, seeded and embedded (53 provisions, 5
cases), so you can skip this. If you ever repoint the services at an empty
database, run these once from your machine with `DATABASE_URL` pointing at it:

```bash
pnpm run db:push          # create the schema (Drizzle)
pnpm run db:seed          # load the practice cases
pnpm run statutes:ingest  # embed the statute corpus (spends OpenAI embedding calls)
```
