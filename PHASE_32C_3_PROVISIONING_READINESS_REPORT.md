# Phase 32C-3 — Staging Provisioning Readiness Report

**Date:** 2026-09-28
**Scope:** Read-only repository and staging preparation review. No cloud resources, deployment, remote database, migration, or production setting was touched.

**Local follow-up:** The project was subsequently exercised against the local PostgreSQL database. Lint, typecheck, 9 unit tests, and the production build passed. The full local Playwright suite passes **7/7** with its Stripe-unconfigured branch explicitly enabled and all Stripe environment values blank in the app process. That check confirmed both premium and credit-pack checkout fail closed with HTTP 503; no provider credentials or network calls were involved. Local flows verify registration/login/logout, foreign-origin rejection for cookie-authenticated mutations, interview-history isolation, desktop code ownership and one-time pairing/replay rejection/disconnect revocation, anonymous rejection across sensitive desktop endpoints, resume upload and two-user ownership, Resume Maker ownership, notification list/read isolation, question-bank manual creation/favorites/read/delete/list isolation, concurrent free-session accounting, anonymous health, and protected API access. These results do not certify staging and did not change any staging checklist item.

The built production server was also started with process-only local HTTPS origin and private-storage overrides (no environment file was edited). `GET /api/health` and `GET /api/health/db` both returned HTTP 200; the database endpoint reported `available`. This local health check did not call AI or Stripe providers.

After the Node 24 engine declaration and strict npm setting were added, the production build was regenerated on Node 24.19 and the production server was started again with local process-only placeholders. Both health endpoints again returned HTTP 200, with PostgreSQL `available`; no AI or Stripe request was made.

Additional local database/package readiness evidence: `npx prisma migrate status` connected to `ai_interview_platform` on `localhost:5432`, found all 15 migrations, and reported the schema up to date. `npx prisma validate` passed. `npm ls --depth=0` reported all root dependencies installed with no unmet/extraneous packages. `npm run deploy:check` passed using only process-scoped local placeholders (not saved to any environment file); it reported Stripe disabled. These checks validate the local database and current installation only; they do not establish production lifecycle-script behavior or any staging database state.

**Clean-install follow-up:** In a unique temporary directory containing only `package.json` and `package-lock.json`, `npm ci --ignore-scripts --no-audit --no-fund` completed successfully and `npm ls --depth=0` reported the root dependency tree. The active workspace's `node_modules` and lockfile were not changed. Lifecycle scripts were intentionally disabled, so this validates lockfile-based package installation but not Prisma postinstall/client generation; generation and production build were verified separately. npm emitted deprecation warnings for ESLint 8 and transitive packages including `inflight`, `rimraf@3`, and `glob@7`. These are dependency-maintenance findings, not an audit result or proof of a known vulnerability in the shipped app.

**Dependency advisory follow-up:** `npm audit --omit=dev --audit-level=high --offline` reported 0 vulnerabilities from available local audit metadata. Registry access was unavailable: `npm outdated --depth=0 --offline` returned `ENOTCACHED`, and the online metadata request did not complete. Therefore, this is not a current registry-backed audit or confirmation that packages are up to date. No dependency versions were changed without current advisory/compatibility data.

A bounded direct metadata retry (`npm view eslint version --fetch-retries=0 --fetch-timeout=5000`) confirmed registry access fails with `EACCES` to `registry.npmjs.org`. Dependency updates and a current online vulnerability audit need to be repeated from a network-enabled environment.

**Maintainer advisory spot-check (2026-09-29):** The locked versions were compared with current package-maintainer advisories. `next` is 15.5.26, which is above the 15.5.24 fixes for the Windows-hosted RCE and AVIF image-optimization RCE; the newly listed `next/og` RCE applies to the 16.2+ line, and this codebase has no `next/og`, `next/image`, or image-optimization configuration. `next-auth` is 4.24.15, the patched release for the 2026 `getToken()` and OAuth-cookie advisories. `electron` is 44.4.5, above the affected 44 prerelease range ending at 44.0.0-beta.5; the desktop also denies popup windows and registers no custom file/HTTP protocol handler. PostCSS is 8.5.23 under Next.js and 8.5.28 at the root; 8.5.23 is the patched version for the July source-map advisories. References: [Next.js Windows RCE](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [Next.js AVIF RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), [Next.js `next/og` RCE](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j), [NextAuth `getToken()` advisory](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-xmf8-cvqr-rfgj), [Electron sandbox-window advisory](https://github.com/electron/electron/security/advisories/GHSA-gr2m-v5gq-v685), and [PostCSS source-map advisory](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp). This is a targeted review of selected direct runtime packages, not a full dependency-tree audit; the registry-backed `npm audit` remains outstanding. No package versions were changed based on this spot-check.

A fresh bounded attempt, `npm audit --omit=dev --audit-level=high --fetch-retries=0 --fetch-timeout=5000`, failed because the registry audit endpoint returned an error. No vulnerability count was obtained. A full registry-backed audit of production and development dependencies remains a release task for a network-enabled environment.

## Runtime support correction

The earlier staging notes named Node.js 20 as an acceptable minimum. Review against the official release schedule showed Node.js 20 is end-of-life and Node.js 24 is LTS. The root package and lockfile now declare Node.js `^24.0.0`, and `.npmrc` sets `engine-strict=true` so npm rejects unsupported runtimes. Provider-neutral setup/deployment docs and the staging checklist reflect Node 24 LTS. Node 24.19 local validation passes: typecheck, lint, 9 unit tests, Prisma validation, an isolated offline clean `npm ci` from the updated manifests, and production build. The staging runtime checklist item remains unchecked until a host is selected and configured.

## Readiness status

| Area | Status | Evidence |
|---|---|---|
| Git | **BLOCKED** | `git --version`, `git status`, and `git rev-parse --is-inside-work-tree` could not run because Git is not available in this session. Repository identity, clean/dirty state, and migration commit provenance cannot be verified. Git was not initialized. |
| Migration files | **PASS (present)** | `prisma/migrations` contains 15 timestamped migration directories, each with `migration.sql`, and `migration_lock.toml`. File presence is verified; committed status and deployment history are not. |
| Secret protection | **PASS with recommendations** | `.gitignore` ignores `.env*` and re-includes only `.env.example`, `.env.staging.example`, and `.env.postgres.example`; it also ignores `data/private-resumes/`. No secret values were read or reported. See recommendations below. |
| Deployment requirements | **PASS (documented)** | Reviewed `docs/STAGING_SETUP.md`, `docs/STAGING_DEPLOYMENT_CHECKLIST.md`, `docs/STAGING_PROVIDER_OPTIONS.md`, and `.env.staging.example`. Summary below. This is a documentation review, not provider validation. |
| Hosting provider | **NOT SELECTED** | Owner decision required. |
| Database provider | **NOT SELECTED** | Owner decision required. |
| Staging app | **NOT CREATED** | No provider provisioning was performed. |
| Staging database | **NOT CREATED** | No provider provisioning or remote DB access was performed. |
| Production | **NOT TOUCHED** | No production configuration, data, or service was accessed or changed. |

## Migration inventory

All 15 SQL files are present:

- `20260926000000_initial/migration.sql`
- `20260926010000_phase7_answer_engine/migration.sql`
- `20260927000000_phase8_question_bank/migration.sql`
- `20260927010000_phase10_desktop_connections/migration.sql`
- `20260927020000_phase15_resume_maker/migration.sql`
- `20260927030000_phase16_subscription_billing/migration.sql`
- `20260927040000_phase17_admin_dashboard/migration.sql`
- `20260927050000_phase21_onboarding/migration.sql`
- `20260927060000_preparation_planner/migration.sql`
- `20260927070000_ai_interview_simulator/migration.sql`
- `20260927080000_company_intelligence/migration.sql`
- `20260927090000_phase27_notifications/migration.sql`
- `20260927100000_phase28_credit_wallet/migration.sql`
- `20260927110000_phase29_analytics/migration.sql`
- `20260927120000_phase30_reliability/migration.sql`

Also present: `prisma/migrations/migration_lock.toml`. Presence does not establish that these files are committed or have been applied to any database.

## Secret protection review

`.gitignore` currently covers `.env*`, which includes `.env`, `.env.local`, `.env.staging`, and `.env.production`; it explicitly allows the three placeholder/example env templates. It also ignores the app's `data/private-resumes/` directory, generated Prisma client, logs, build/test outputs, and Playwright auth state.

Recommended `.gitignore` additions (not applied): explicit patterns for private keys and credential files (for example `*.pem`, `*.key`, `*.p12`, `*.pfx`, `credentials/`, `secrets/`) and local database artifacts (for example `*.sqlite`, `*.sqlite3`, `*.db`, `*.dump`, `*.backup`). Review whether those patterns would hide any intentional fixture before adding them. Current checks did not inspect secret values or the contents of `.env` files.

## Deployment requirements summary

- **Node.js:** Node 24 LTS; root `package.json` and lockfile now enforce `^24.0.0`. Node 20 is end-of-life per the [official Node.js release schedule](https://nodejs.org/en/about/previous-releases).
- **Package manager:** npm with root `package-lock.json`; use `npm ci` with build dependencies.
- **Build:** `npx prisma generate`, `npm run deploy:check`, `npm run build`.
- **Start:** `npm start` (`next start`) as a persistent Node service.
- **Database and Prisma:** isolated TLS-enabled staging PostgreSQL, private access, least-privilege role. Run `npx prisma validate` and `npx prisma migrate status`, review SQL/status and verify backup; migration deployment requires separate explicit approval, then `npx prisma migrate deploy` and a post-check. No migration was run in this phase.
- **Required app settings:** `NODE_ENV`, staging `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (unique, 32+ bytes), `RESUME_STORAGE_DIR` (absolute, durable, private), and `NEXT_PUBLIC_APP_URL` (HTTPS origin only). Production startup validation requires at least one server-side `OPENAI_API_KEY` or `GEMINI_API_KEY`.
- **HTTPS:** Required for staging and remote Playwright; trusted TLS proxy, secure cookies, validated forwarding headers. Ingress must preserve streamed HTTP NDJSON and permit 10 MiB resume uploads with suitable limits.
- **Storage:** Current resume storage is local filesystem. Use a durable private volume for a single instance; ephemeral or multi-instance deployment needs a shared private storage adapter.
- **AI:** One staging-only OpenAI or Gemini key required by current production startup validation. No real credentials belong in this report or chat.
- **Stripe:** Optional; test flows need Stripe test-mode secret and webhook settings plus test Price IDs. Keep disabled without test credentials.
- **Email:** Not implemented; in-app notifications only, no `EMAIL_*` settings.
- **Desktop/WebSocket:** No conventional WebSocket service documented. Desktop uses HTTP NDJSON streaming; proxy must not buffer. Keep desktop routes accessible over HTTPS if desktop is in scope.
- **E2E:** Runner-only `E2E_BASE_URL`, `E2E_ENVIRONMENT=staging`, and (for remote host) exact-host `E2E_TARGET_CONFIRM`. Use synthetic dedicated accounts.

## Exact owner inputs required before provisioning

1. Hosting provider and deployment model (for example managed Node service, container platform, or owner-operated VPS).
2. PostgreSQL provider and intended isolated staging database/network arrangement.
3. Git repository URL and the intended branch/commit/revision. First make Git available so repository and migration provenance can be verified.
4. Staging domain/subdomain, or confirmation that the selected host's generated HTTPS hostname is acceptable.
5. Staging secret handling decision/location. Generate and enter secrets directly into the selected provider's secret manager; do not paste them into chat.
6. Authorized staging-only AI credential choice (OpenAI or Gemini), stored directly in that secret manager. Do not paste the credential into chat.
7. Whether Stripe billing is in staging scope; if yes, provision test-mode credentials, webhook configuration, and test Price IDs directly in the secret manager. Never provide live keys.

No secret values are requested here. The owner should supply provider names and non-secret decisions first, then configure secret values directly in the provider console/secret manager.

## Files created

- `docs/STAGING_PROVISIONING_PLAN.md`
- `PHASE_32C_3_PROVISIONING_READINESS_REPORT.md`

## Local resume parsing fix

The local PDF upload check found that PDF.js's worker fallback attempted to dynamically load a relative worker file that Next.js had relocated into a server vendor chunk. Resume extraction now explicitly loads the installed `pdfjs-dist/legacy/build/pdf.worker.mjs` module in the server bundle and provides its `WorkerMessageHandler` through PDF.js's Node hook. The matching narrow TypeScript declaration is in `types/pdfjs-worker.d.ts`. The focused and full local E2E runs both passed after this change. This is application code evidence only; hosted storage and staging behavior remain unverified.

## Desktop packaging follow-up

The first Windows x64 packaging run exposed two release blockers: `dist/**/*` recursively pulled old installers and prior Electron output into the app archive, and the Electron main process imports `zod` even though it had been declared only as a development dependency. The desktop package now declares `zod` as a runtime dependency, locks it in `desktop/package-lock.json`, and allowlists only the required desktop runtime entry points and UI assets.

The corrected Electron 44.4.5 / electron-builder 25.1.8 Windows x64 directory and zip builds passed. The normal `npm run package:win` script now writes to `desktop/dist/package`, separate from the TypeScript build files. The corrected `app.asar` is 3,537,948 bytes, contains the desktop entry points and `zod`, and contains no nested installers or prior build output. The corrected `desktop/dist/package/Genzz AI-1.0.0-win.zip` is 153,527,910 bytes versus 1,697,132,966 bytes for the earlier contaminated zip. The normal `npm run package:win:installer` NSIS build also passed and produced a 114,598,067-byte installer. Electron Builder used its default application icon because no icon asset is configured, and skipped signing because no signing identity was provided; `Get-AuthenticodeSignature` reports `NotSigned`. A targeted scan of 95 packaged JavaScript, HTML, and JSON files found no provider/database/payment secret variable names, PEM private-key headers, or common API-key format matches. This is a static marker scan, not a malware scan. The older top-level artifacts in `desktop/dist` (the setup EXE, blockmap, and ZIP) predate the fix and must not be distributed; they were preserved in place. This verifies packaging on this development machine only. Clean-machine installation/launch, connection to an HTTPS staging server, signing/owner approval, malware scanning, and update decisions remain unverified. No desktop release was published.

**Phase stopped at readiness.** No provisioning, deployment, migration, Git initialization, release tagging, push, or production operation occurred.
