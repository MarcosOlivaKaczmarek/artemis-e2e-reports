# artemis-e2e-reports

A self-hosted dashboard for Artemis Playwright E2E test runs. CI uploads a `.tar.gz` archive after each run; the server parses JUnit XML and LCOV, stores stats in SQLite, and serves an interactive UI with run history, trend charts, test case details, coverage viewer, and embedded Monocart reports.

## Architecture

```
packages/
├── shared/    TypeScript types shared between server and client
├── server/    Fastify backend (Node 22, ESM, better-sqlite3)
└── client/    React 19 + Vite + Tailwind v4 + shadcn/ui frontend
```

A single Docker image runs both — the server builds the Vite SPA at image build time and serves the static files via `@fastify/static`. An nginx container handles port 80 and proxies to the app.

## Development

```bash
npm install          # install all workspace dependencies
npm run dev          # start server + vite dev server concurrently
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api` and `/reports` to the Fastify server on `http://localhost:3000`.

To run only the server:
```bash
cd packages/server && npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Description |
|---|---|---|
| `UPLOAD_TOKEN` | Yes | Bearer token CI uses to authenticate uploads (`PUT /api/upload`) |
| `GITHUB_TOKEN` | No | GitHub token for PR state checks during cleanup |
| `APP_URL` | No | Public URL of the app, used for OAuth callback (default: `http://localhost:3000`) |
| `SESSION_SECRET` | No* | Signs JWT session cookies — required if OAuth is enabled |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth App client ID — enables login if set |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth App client secret |
| `GITHUB_REPO` | No | `owner/repo` used for PR links and cleanup (default: `ls1intum/Artemis`) |
| `DB_PATH` | No | Path to the SQLite database file (default: `<DATA_DIR>/reports.db`) |
| `DATA_DIR` | No | Root directory for all persisted data (default: `./data`) |

**Retention tuning** (all optional, sensible defaults):

| Variable | Default | Description |
|---|---|---|
| `MAX_RUNS_PER_PR_PHASE` | `2` | Max report runs kept per (PR, phase) pair; older ones have files deleted, stats preserved |
| `MAX_RUNS_PER_NULL_PR_GROUP` | `1` | Max runs kept per (branch, phase) for non-PR uploads (e.g. develop) |
| `MAX_AGE_DAYS` | `7` | Hard cap — runs older than this have files deleted regardless of PR/branch |
| `CLEANUP_INTERVAL_MS` | `3600000` | How often the scheduled cleanup runs (ms) |
| `PR_CHECK_TTL_MS` | `21600000` | How long a PR's open/closed state is cached before re-fetching from GitHub (ms) |
| `DISK_WATERMARK_BYTES` | `5368709120` | Free-space threshold (5 GB) — upload handler triggers emergency pruning if free space drops below this |

Generate a session secret: `openssl rand -base64 32`

When `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are not set, authentication is disabled and all routes are publicly accessible.

## Deployment

The app is deployed via Docker Compose. The image is automatically built and pushed to `ghcr.io/marcosolivakaczmarek/artemis-e2e-reports:latest` on every push to `main`.

```bash
# On the server
cp .env.example .env
# Fill in UPLOAD_TOKEN, SESSION_SECRET, etc.
docker compose pull
docker compose up -d
```

Data is persisted in a named Docker volume at `/data` (SQLite database, report files, backups).

## CI Upload

CI uploads a `.tar.gz` archive to `PUT /api/upload` using the `UPLOAD_TOKEN` as a Bearer token. The archive should contain any combination of:

- `test-reports/results.xml` — JUnit XML (parsed for test stats)
- `test-reports/monocart-report-*/` — Monocart HTML reports
- `test-reports/client-coverage/` — LCOV coverage HTML + `lcov.info`
- `test-results/` — Playwright video recordings

Required form fields: `archive`, `run_id`, `github_run_id`, `branch`, `commit_sha`, `phase`.
Optional: `pr_number`, `triggered_by`.

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | None | Health check |
| `GET` | `/api/runs` | Session | List runs (paginated, filterable) |
| `GET` | `/api/runs/:id` | Session | Run detail + test cases |
| `DELETE` | `/api/runs/:id` | Token | Delete report files (preserves stats) |
| `GET` | `/api/runs/:id/monocart-reports` | Session | List available Monocart reports for a run |
| `GET` | `/api/trends` | Session | Trend data + summary stats |
| `PUT` | `/api/upload` | Token | Upload test results archive |
| `POST` | `/api/cleanup` | Token | Delete report files for closed PRs |
| `POST` | `/api/backup` | Token | Trigger manual DB backup |
| `GET` | `/api/auth/session` | None | Current session |
| `GET` | `/api/auth/login` | None | GitHub OAuth redirect |
| `GET` | `/api/auth/callback` | None | GitHub OAuth callback |
| `POST` | `/api/auth/logout` | None | Clear session cookie |
| `GET` | `/reports/*` | Session | Serve static report files |

## Backups

The server automatically backs up the SQLite database 1 minute after startup, then every 6 hours. Up to 5 backups are kept in `/data/backups/`. A manual backup can be triggered via `POST /api/backup`.
