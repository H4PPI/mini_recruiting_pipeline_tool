# Mini Recruiting Pipeline Tool

A small end-to-end recruiting pipeline: resumes get ingested from PDF, parsed and PII-masked, matched against job descriptions with AI, and tracked by HR through an application pipeline (Pre-Screen → First Interview → Offer → Hired/Rejected) with auto-scheduled Google Meet interviews.

Built with Next.js (App Router) + TypeScript, Prisma/Postgres (Neon), Vercel Blob storage, Google Gemini for AI screening, and the Google Calendar API for interview scheduling.

## 1. Setup Instructions

### Prerequisites
- Node.js 20+
- A [Neon](https://neon.tech) Postgres database (or any Postgres instance)
- A [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store (for resume/JD PDF storage)
- A Google Gemini API key
- (Optional, for auto-scheduled Google Meet links) a Google Cloud service account with Calendar API access

### Install

```bash
npm install
```

`postinstall` automatically runs `prisma generate` to generate the Prisma Client into `generated/prisma`.

### Environment variables

Create a `.env` file in the project root:

```bash
# Postgres (Neon)
DATABASE_URL="postgresql://...?pgbouncer=true"   # pooled connection, used at runtime
DIRECT_URL="postgresql://..."                     # direct connection, used only by Prisma CLI (migrate/generate/studio)

# Vercel Blob
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."

# AI screening
GEMINI_API_KEY="..."

# ETL cron endpoint auth
CRON_SECRET="a-long-random-string"

# Google Calendar / Meet auto-scheduling (optional)
GOOGLE_SERVICE_ACCOUNT_EMAIL="...@...gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID="primary"
```

> `DATABASE_URL` (pooled, used via the `@prisma/adapter-pg` driver adapter at runtime) and `DIRECT_URL` (direct, used only by the Prisma CLI — see `prisma.config.ts`) are intentionally different connection strings against the same Neon database.

### Database

```bash
npm run db:migrate          # applies migrations locally (prisma migrate dev)
npm run db:studio           # optional: browse data with Prisma Studio
```

For production/CI, apply pending migrations with:

```bash
npm run db:migrate:deploy   # prisma migrate deploy
```

> Note: the Vercel build (`next build`) does **not** run migrations automatically. Run `db:migrate:deploy` against the production database whenever the schema changes, before or as part of deploying.

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- `/job` — Jobs page: create job postings (with JD PDF upload), trigger resume ETL sync, review AI-matched candidates per job, approve into the tracker.
- `/application-tracker` — Kanban-style pipeline board (Pre-Screen → First Interview → Offer → Hired/Rejected), assignees, interview scheduling.
- `/interview-schedule` — Aggregated view of all upcoming scheduled interviews across candidates.

### Resume ingestion (ETL)

Resumes are ingested from PDFs uploaded to Vercel Blob and processed by `app/api/cron/etl-resumes/route.ts`, which:
1. Lists new PDF blobs not yet processed (tracked via `EtlRunLog` / `Candidate.sourceBlobPath`).
2. Extracts text (`lib/etl/pdf-extractor.ts`), parses structured fields (`lib/etl/resume-parser.ts`).
3. Masks PII (`lib/etl/pii-masker.ts`) before ever sending text to the AI screener.
4. Runs an AI evaluation (`lib/etl/ai-screener.ts`, Gemini) for a candidate-level score/summary.
5. Persists the candidate row, raw resume text, and masked draft text as separate Blob objects.

This runs automatically once a day via the Vercel Cron defined in `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/etl-resumes", "schedule": "0 15 * * *" }] }
```

(`0 15 * * *` = 15:00 UTC = 22:00 ICT daily — cron schedules in `vercel.json` are always UTC.)

You can also trigger it manually:

```bash
npm run etl:trigger    # calls scripts/trigger-etl.js against the cron endpoint with CRON_SECRET
```

Or upload sample/mock resumes for local testing via `POST /api/mock-resumes/upload`.

### Deploy

Deployed on Vercel. `vercel.json` only configures the ETL cron job — the build itself uses the default `next build`. Make sure all environment variables above are set in the Vercel project settings (they are separate from your local `.env`), and that migrations have been applied to whatever database `DATABASE_URL`/`DIRECT_URL` point to in that environment.

## 2. Architecture Decisions

### Next.js App Router + Route Handlers as the whole backend
No separate backend service — all API logic lives under `app/api/**/route.ts` as Next.js Route Handlers, colocated with the frontend in one deployable Vercel project. Keeps the project simple for its scope (a single small internal tool) while still allowing server-only code (Prisma, Blob, Gemini, Google APIs) to run securely, never exposed to the client.

### Postgres (Neon) + Prisma, with a pooled/direct connection split
- **Runtime queries** use `DATABASE_URL` (pooled, via Neon's PgBouncer) through `@prisma/adapter-pg`'s driver adapter (`lib/db.ts`), which is required for serverless functions that open many short-lived connections.
- **Prisma CLI operations** (`migrate`, `generate`, `studio`) use `DIRECT_URL` (a non-pooled connection), configured in `prisma.config.ts`, since schema-altering operations shouldn't go through a connection pooler.
- Prisma Client is generated to a custom `generated/prisma` output directory (not `node_modules/.prisma`) to make the generated client explicit and easy to inspect/commit-ignore intentionally.

### Two-entity data model: `Candidate` vs `CandidateJob`
- `Candidate` holds identity, resume content (raw/masked text + blob paths), and pipeline-tracker state (`pipelineStatus`, `assignees`, `scheduledAt`, Google Meet fields) — i.e. everything that's true about the *person* regardless of which job they're being considered for.
- `CandidateJob` is a join table holding the **per-job** AI match: `matchScore`, `matchDetails`, `aiEvaluation`. A single candidate can be matched against multiple jobs, each with its own independent score — this shape avoids duplicating candidate/resume data per job and lets the Jobs page rank/filter candidates per posting independently of their tracker status.
- A candidate only "exists" in the Application Tracker once approved (`pipelineStatus` moves from `"pending"` to `"Pre-Screen Pending"` — see `lib/pipeline/stages.ts`); until then they only show up on the relevant Job's candidate list.

### PII masking before any AI call
Full PII (`fullName`, `email`, `phone`, `address`) is stored in Postgres for HR's use, but `lib/etl/pii-masker.ts` strips/tokenizes PII (emails, phone numbers, national IDs, passport numbers) out of resume text *before* it is ever sent to Gemini — both during ETL ingestion and per-job re-matching. `lib/etl/ai-screener.ts` additionally re-checks the masked text against the same PII regexes and logs a redacted preview of every outbound AI payload (`logOutboundPayload`, toggled via `AI_SCREENER_LOG_PAYLOAD`), so masking failures are auditable rather than silently trusted.

### Vercel Blob for file storage, not the database
Resume PDFs, extracted raw text, masked draft text, and job description PDFs are all stored in Vercel Blob (`access: "private"`, fetched server-side only) rather than as `bytea`/large text columns in Postgres. Only lightweight metadata and blob *paths* are stored in the DB. This keeps Postgres rows small and cheap to query, and lets large binary/text content be streamed on-demand only when actually needed (e.g. "Open Resume").

### Lazy-loading `pdf-parse`
`lib/etl/pdf-extractor.ts` dynamically `import()`s `pdf-parse` inside the function that needs it, instead of a static top-level import. `pdf-parse` pulls in `pdfjs-dist`, which references browser-only globals (`DOMMatrix`) at module-load time — a static import would crash *any* route file that merely imports this module (including ones that never parse PDFs, like the Jobs list `GET`) as soon as Vercel's serverless runtime tries to load it. Lazy-loading confines that risk to only the request paths that actually parse a PDF.

### Cron-driven ETL instead of upload-triggered processing
Resume ingestion runs on a schedule (Vercel Cron, `vercel.json`) rather than synchronously on upload, so large batches of resumes can be processed idempotently in the background (tracked via `EtlRunLog` + `Candidate.sourceBlobPath` uniqueness to skip already-processed files) without blocking the UI or hitting serverless function timeouts on large batches.

### Server-side Google Calendar integration via service account
`lib/google/calendar.ts` uses a Google service account (JWT auth) rather than per-user OAuth so that interview scheduling can be fully automated from the backend without every HR user having to individually connect their Google account. The known tradeoff (documented in code) is that a bare service account cannot invite attendees without Google Workspace Domain-Wide Delegation; this is accepted for now, with OAuth2 user-consent flow noted as the future alternative if that becomes a hard requirement.
