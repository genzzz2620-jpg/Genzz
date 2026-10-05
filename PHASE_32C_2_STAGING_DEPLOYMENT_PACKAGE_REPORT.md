# Phase 32C-2 — Staging Deployment Package Report

**Assessment date:** 2026-09-28  
**Scope:** Deployment compatibility audit and provider-neutral staging package preparation. No provider login, cloud resource, deployment, remote database, migration, real credential, AI request, payment, production setting, or release tag was used or changed.

## Deployment compatibility audit: PASS

- **Runtime:** local Node.js `v24.19.0`. The installed Next.js 15.5.26 package declares `^18.18.0 || ^19.8.0 || >=20.0.0`. Root `package.json` does not pin a Node version; choose and record a currently maintained LTS version satisfying that engine before deployment.
- **Package manager:** npm `11.17.0`; root `package-lock.json` uses lockfile version 3. No `packageManager` field or alternate lockfile was found. Use `npm ci` for deterministic install.
- **Build/start:** `npm run build` and `npm start` are present. A local production build completed; `npm start` launched a local production server successfully.
- **Prisma generation:** the schema has a custom generated-client output under the ignored `prisma/generated/client` path. The installed `@prisma/client` package has a postinstall hook that invokes Prisma generation when the local CLI is available. Build with development dependencies and install scripts enabled; the staging procedure explicitly runs `npx prisma generate` so generation is clear and repeatable.
- **Prisma migrations:** schema validation passed, the `prisma migrate deploy` CLI help loaded, and all 15 migration directories contain `migration.sql`. No migration was run in this phase. The workspace has no `.git` metadata and no Git executable, so whether the SQL files are committed cannot be confirmed; see Prisma readiness below.
- **Static assets:** no root `public/` directory exists. Next.js builds the app's static chunks into `.next`; the project requires the Node server and is not a static export.
- **Resume/file storage:** `lib/resume-storage.ts` writes PDF/DOCX files to local filesystem storage. Uploads are limited to 10 MiB and parse synchronously. Staging needs an absolute private path outside the web root on durable storage. Ephemeral/multi-instance hosting needs a private object-storage adapter; none is implemented.
- **Environment:** production startup validation requires `DATABASE_URL`, matching HTTPS `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_SECRET` of at least 32 UTF-8 bytes, absolute private `RESUME_STORAGE_DIR`, and at least one server-side OpenAI/Gemini key. `NEXT_PUBLIC_APP_URL` is the only public-prefixed variable in the staging template. Stripe is optional; its secret, webhook secret, and premium Price ID must be configured together, with credit-pack test Price IDs for credit purchase tests.
- **Health:** `/api/health` and `/api/health/db` both returned HTTP 200 in a local production-start smoke check. See health checks below.
- **WebSocket/SSE:** no WebSocket or Server-Sent Events implementation was found. Desktop AI answers use a Node.js HTTP `ReadableStream` with `application/x-ndjson`, `Cache-Control: no-transform`, and `X-Accel-Buffering: no`; the staging proxy must allow streamed responses without buffering or premature timeout.
- **Desktop/backend:** the Electron app connects to the selected server origin over HTTPS for remote hosts. It exchanges a one-time 8-character connection code (five-minute lifetime) for a scoped bearer token (two-hour lifetime). Desktop API routes must be reachable, and the answer stream must remain open while data is produced. No server credentials belong in the desktop package.
- **Background/cron:** no server-side scheduler, cron task, or background worker was found. The renderer has a local one-second session display timer; that does not require a server scheduler.
- **Email:** no email provider or email configuration is implemented. Notifications are in-app.
- **AI/Stripe:** at least one server-side AI credential is required for production-mode app startup. Provider behavior was not called or verified in this phase. Stripe billing is optional; any staging verification must use Stripe test mode and a staging webhook only.

## Requested checks

| Check | Result | Evidence |
|---|---|---|
| `npm run lint` | **PASS** | `npm.cmd run lint` completed with no ESLint warnings/errors. Next.js reports that `next lint` is deprecated. |
| `npm run typecheck` | **PASS** | `npm.cmd run typecheck` completed. |
| `npm test` | **PASS** | 9 tests passed, 0 failed. Node emitted non-failing module-type warnings. |
| Production build | **PASS** | `npm.cmd run build` completed successfully with 74 pages generated. The dev server was stopped first to avoid a shared `.next` race. |
| Local production start | **PASS** | `npm.cmd run start` listened on local port 3100 and reached ready state. It used the local `.env` database configuration and process-only test placeholders for production-required settings; no AI route/provider request was made. The server was stopped after checks. |
| Deployment preflight | **PASS** | `npm.cmd run deploy:check` passed against process-only syntactically valid placeholder settings; it printed no secrets. This validates shape only and does not verify any real staging service or credential. |
| Prisma schema | **PASS** | `npx prisma validate` passed. |
| Prisma client generation | **PASS** | `npx prisma generate` generated Prisma Client v5.22.0 at the configured custom output path. No database was contacted. |
| Migration CLI readiness | **PASS** | `npx prisma migrate deploy --help` loaded successfully. This was help-only; no database was targeted. |
| Prisma readiness including repository provenance | **FAIL** | All 15 SQL migration files are present and schema validation passes, but this workspace has no `.git` directory and Git is unavailable, so migration commit/tracking status cannot be confirmed. |
| Health endpoints | **PASS** | Local production-mode `GET /api/health` returned HTTP 200 with `status: ok`; `GET /api/health/db` returned HTTP 200 with `database: available`. These are local, not staging results. |
| Environment contract | **PASS** | `.env.staging.example` has no real credentials and classifies required, optional, local-only, staging-only, server-only, client-safe, and test-runner settings. An equivalent placeholder-only environment passed the deployment checker. |
| Storage requirements | **DOCUMENTED** | Private durable filesystem is suitable for a single persistent instance. Ephemeral or horizontally scaled deployment needs an object-storage adapter. |
| Desktop requirements | **DOCUMENTED** | HTTPS origin, connection-code/token lifetimes, reachable routes, and non-buffered streamed NDJSON requirements are documented. |
| Provider options | **CREATED** | `docs/STAGING_PROVIDER_OPTIONS.md` describes Node hosting + managed PostgreSQL, container hosting + managed PostgreSQL, and self-managed VPS + PostgreSQL. |
| Deployment checklist | **CREATED** | `docs/STAGING_DEPLOYMENT_CHECKLIST.md` records the uncompleted staging gates. |

## Health check evidence

- `GET http://localhost:3100/api/health` → HTTP 200, `{"status":"ok", ...}`.
- `GET http://localhost:3100/api/health/db` → HTTP 200, `{"status":"ok","database":"available"}`.
- One local `SELECT 1` health query was logged at about 2.0 seconds. It succeeded; this is a latency observation and not a staging performance result.

## Environment contract

The staging template separates categories as follows:

- **REQUIRED:** `NODE_ENV`, `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `RESUME_STORAGE_DIR`, and `NEXT_PUBLIC_APP_URL`; at least one AI provider key is required by the current startup validator.
- **OPTIONAL:** individual OpenAI/Gemini keys/models (one key is still required overall), all Stripe settings when billing is disabled, and E2E variables unless running the remote staging suite.
- **LOCAL ONLY:** `.env`, `.env.postgres`, and the existing `compose.yaml` development database values; none were copied to the template.
- **STAGING ONLY:** all application values must be unique to staging; the E2E URL and confirmation belong to the staging test run.
- **SERVER ONLY:** database URL, NextAuth secret, resume storage path, AI keys, and Stripe keys.
- **CLIENT SAFE:** only the non-secret public origin `NEXT_PUBLIC_APP_URL`. The E2E runner values are not browser variables.

Email variables are intentionally absent because email delivery is not implemented. The template uses reserved `.invalid` hostnames and obvious placeholders, not working endpoints or credentials.

## Files created/modified

- `.env.staging.example` — grouped and classified placeholder-only staging environment contract.
- `docs/STAGING_SETUP.md` — updated environment classifications and explicit Prisma build steps.
- `docs/production-deployment.md` — corrected Next.js version and documented Node, Prisma generation, streaming, and workload constraints.
- `docs/STAGING_PROVIDER_OPTIONS.md` — provider-neutral hosting models and their operational tradeoffs.
- `docs/STAGING_DEPLOYMENT_CHECKLIST.md` — staging gates, all currently unchecked.
- `README.md` — links to the staging preparation documents.
- `prisma/generated/client/` — regenerated ignored Prisma Client build output; no schema or migration SQL changed.
- `.next/` — generated local production build output.
- `PHASE_32C_2_STAGING_DEPLOYMENT_PACKAGE_REPORT.md` — this report.

## Still required before staging can be provisioned

1. **Owner decision:** select a provider-neutral deployment model/provider for the Node app and PostgreSQL service. No provider is configured in the project.
2. **Deployment source:** make the intended source available from an actual version-controlled repository and confirm all 15 migration SQL files and deployment docs are committed. This checkout has no Git metadata, so provenance cannot be verified here.
3. **Isolated resources:** provision a staging-only HTTPS Node app and separate PostgreSQL database/credentials with private networking and no production data.
4. **Storage:** select durable private filesystem volume for a single instance, or implement/select private object storage before using ephemeral or multiple app instances.
5. **Staging configuration:** create separate secret-manager entries for canonical HTTPS URLs, unique auth secret, database URL, private storage, and at least one staging-only AI key required by startup checks. Add Stripe test values only if billing is to be exercised.
6. **Operations:** configure staging backup/restore, monitoring/alerts, and disposable synthetic accounts after the environment exists.
7. **Testing:** configure the E2E runner's staging URL/environment/host confirmation, then execute staging E2E, two-user isolation, AI/Stripe test-mode checks, and desktop connectivity checks where those features are in scope.

## PHASE 32C-2 STATUS

Deployment package: **BLOCKED** (the package is prepared; source-control provenance and provider-owned infrastructure are outstanding)  
Application build: **PASS**  
Prisma deployment readiness: **FAIL** (migration files exist and CLI is available; committed state cannot be verified without Git metadata)  
Environment contract: **PASS**  
Health checks: **PASS**  
Staging infrastructure: **NOT CREATED**  
Production: **NOT TOUCHED**

**NEXT REQUIRED ACTION:** The project owner must select a hosting model/provider, create a version-controlled deployment source containing the migration files, and provision an isolated staging PostgreSQL database and HTTPS Node.js service with independent secrets.

Stopped after staging package preparation as requested. This is local build/start verification, not staging or production certification.
