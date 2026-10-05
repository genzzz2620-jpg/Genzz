# Phase 32C-1 — Staging Infrastructure Preparation Report

**Assessment date:** 2026-09-28  
**Scope:** Read-only infrastructure audit plus staging template/document preparation. No external service login, cloud provisioning, deployment, database migration, container creation/restart, or production operation was performed. Secret values were not printed or copied.

## Current infrastructure

- **Local app:** Present. Current `GET /api/health` returned HTTP 200 (`status: ok`).
- **Local database:** PostgreSQL was reachable at local port 5432. Current `GET /api/health/db` returned HTTP 200 (`database: available`); the IPv4 TCP check succeeded.
- **Docker:** **UNVERIFIED.** `docker compose ps` was attempted but the session could not access the Docker Engine named pipe (permission denied), so service/container/health/restart-count details could not be collected.
- **Existing deployment support:** The root `compose.yaml` defines local PostgreSQL only, on loopback port 5432, with the development volume. There is no Dockerfile, web app Compose service, hosting manifest, CI/CD workflow, selected cloud provider, or staging URL. `package.json` has web build/start and a production environment preflight script.
- **Prisma:** `prisma/schema.prisma` reads the PostgreSQL URL from `DATABASE_URL`; no separate staging Prisma configuration was found. Migration operations are available through Prisma CLI.
- **Health endpoints:** `/api/health` and `/api/health/db` exist and passed locally during this audit.
- **E2E:** The existing Playwright configuration requires `E2E_ENVIRONMENT=staging`, HTTPS and exact-host confirmation for remote targets, and refuses production-looking hosts. No staging E2E variables or target are configured.
- **Environment:** `.env.example` is a development template. The private `.env` was inspected without outputting values; its database target is local. It was not copied into the staging template. No email provider is implemented; notifications are in-app.

## Staging architecture

**Architecture status: READY as a provider-neutral proposal.** Select a Node.js host and a separate PostgreSQL provider/database as an owner decision. Configure the staging app and migration job with independent secret scopes, HTTPS canonical URL, a unique NextAuth secret, private durable resume storage, and staging-only AI/Stripe test settings when those features are in scope. Use synthetic accounts and data. Run Playwright from a separate runner with the exact staging host confirmation.

An isolated local Compose database simulation is possible, but the current development Compose file must not be reused. A future simulation would require a separate Compose project and file, distinct generated container/service name, database credentials, database name, named volume, and loopback-only port such as 5433. A staging web container would also require an app Dockerfile and isolated runtime configuration, neither of which exists. A local simulation would not count as hosted staging certification. No Compose changes or infrastructure were created in this phase.

## Required staging resources and credentials

- Node.js staging web service and HTTPS staging URL.
- Isolated PostgreSQL database, private connectivity, dedicated least-privilege username/password, and staging-only `DATABASE_URL`.
- Staging secret manager values for a unique `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, and private `RESUME_STORAGE_DIR`.
- At least one staging-only OpenAI or Gemini API key for enabled AI features; never reuse local or production provider credentials.
- Optional Stripe **test-mode** secret, webhook secret, subscription Price ID, and credit-pack test Price IDs if billing is tested.
- Separate User A and User B test accounts with synthetic data only.
- Playwright runner values: `E2E_BASE_URL`, `E2E_ENVIRONMENT=staging`, and `E2E_TARGET_CONFIRM` matching the exact remote URL host.
- No email credential is currently applicable because email delivery is not implemented.

Never place populated credentials in the repository. `.env.staging.example` contains only obvious placeholders and empty optional key fields.

## Files created/modified

- `.env.staging.example` — safe staging variable inventory with placeholders only.
- `docs/STAGING_SETUP.md` — provider-neutral architecture, environment, migration, deployment, test-user, E2E, rollback, health, and security procedures.
- `.gitignore` — exception to keep the safe `.env.staging.example` template eligible for version control while other `.env*` files remain ignored.
- `PHASE_32C_1_STAGING_INFRASTRUCTURE_REPORT.md` — this audit.

## Infrastructure NOT created

- No staging web app, URL, cloud resource, hosting account, database, database credentials, container, Compose file, volume, migration, or deployment.
- No staging user accounts or customer data.
- No real AI, Stripe, email, or production credentials.
- No production variable, service, database, release tag, or deployment was touched.

## PHASE 32C-1 STATUS

Deployment configuration audit: **PASS**  
Staging architecture: **READY**  
Staging environment template: **PASS**  
Staging documentation: **PASS**  
Staging infrastructure: **NOT CREATED**  
Production: **NOT TOUCHED**

**NEXT REQUIRED ACTION:** The project owner must select a hosting provider and provision an isolated staging PostgreSQL database and HTTPS Node.js app, then store independent staging-only credentials in that provider's secret manager. No provider is configured in this repository, so provisioning cannot be completed from this workspace without that owner decision.

Stopped after staging preparation as requested. Do not treat this as staging verification or production certification.
