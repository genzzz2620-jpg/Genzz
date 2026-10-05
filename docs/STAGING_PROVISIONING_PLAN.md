# Staging Provisioning Plan

> Staging only. Keep every staging resource separate from development and production.

## Architecture

```text
Reviewed Git repository and application revision
                    |
                    v
       Isolated staging Node.js application
                    |
                    v
         Isolated staging PostgreSQL
                    |
                    v
      HTTPS staging hostname and ingress
                    |
                    v
    Dedicated Playwright E2E runner and users
```

The application receives only staging secrets and connects only to the staging database. The database is private, TLS-protected, and uses a dedicated least-privilege role. Resume files use durable private storage outside the web root. E2E uses synthetic accounts and data. No production credentials, database, storage, or customer data are shared with staging.

## Deployment requirements

- **Runtime:** Use Node.js 24 LTS; the root manifest declares `engines.node: ^24.0.0`, and `.npmrc` enables strict engine checks. Node.js 20 is end-of-life. The hosting configuration should select the Node 24 LTS runtime; see the [official release schedule](https://nodejs.org/en/about/previous-releases).
- **Package manager:** npm, using root `package-lock.json` and `npm ci`; install development dependencies during build.
- **Build:** `npx prisma generate`, `npm run deploy:check`, then `npm run build`.
- **Start:** `npm start` (`next start`) as a persistent Node.js service.
- **PostgreSQL:** A newly provisioned, isolated staging PostgreSQL database, private network access, TLS, and a dedicated least-privilege staging role. Never copy production data.
- **Prisma:** Validate and inspect status before migration: `npx prisma validate`, `npx prisma migrate status`. Review SQL and backup first; only after explicit owner approval run `npx prisma migrate deploy` against the verified staging target, then check status again. No remote migration is authorized by this plan.
- **Required application environment:** `NODE_ENV=production`, staging-only `DATABASE_URL`, canonical HTTPS `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL`, unique staging `NEXTAUTH_SECRET` (at least 32 bytes), and absolute durable private `RESUME_STORAGE_DIR`. Startup validation also requires at least one staging-only AI key (`OPENAI_API_KEY` or `GEMINI_API_KEY`). Keep server secrets out of `NEXT_PUBLIC_*`.
- **HTTPS:** Required for the staging app and remote E2E. Use a trusted TLS ingress/proxy, secure cookies, and validated forwarding headers. Proxy must support streamed HTTP NDJSON without buffering and allow PDF/DOCX uploads up to 10 MiB with suitable request/time limits.
- **Storage:** The current resume adapter writes local files. Use a durable private persistent volume for one instance; ephemeral or multi-instance hosting needs a shared private object-storage adapter before those flows can be certified.
- **PDF processing:** Local PDF upload and extraction is verified after explicitly bundling PDF.js's worker handler for server-side Node use. This does not establish that the eventual host's private resume storage is durable or correctly mounted.
- **AI:** At least one staging-only OpenAI or Gemini credential is required at production startup. Do not use personal/local/production keys. Provider calls require authorized staging credentials and cost controls.
- **Stripe:** Optional. For billing tests, configure only Stripe test-mode secret/webhook keys and test Price IDs. Keep billing disabled if these are not provided; never use live-mode credentials.
- **Email:** No email integration or `EMAIL_*` settings exist. Notifications are in-app. Email sending is not a deployment requirement until implemented.
- **Desktop/WebSocket:** No conventional WebSocket endpoint is configured. Desktop uses streamed HTTP NDJSON; preserve streaming and keep desktop API routes reachable over HTTPS. One-time connection codes expire after five minutes; exchanged tokens after two hours. Desktop connection testing is optional scope. Do not embed server credentials in the desktop client.
- **E2E runner:** Keep `E2E_BASE_URL`, `E2E_ENVIRONMENT=staging`, and remote `E2E_TARGET_CONFIRM` on the isolated runner, not as public application variables. Use dedicated synthetic accounts.

## Provisioning sequence (after readiness inputs are supplied)

1. Make Git available and verify repository identity, working tree, migration history, and intended revision. Resolve migration provenance before deployment.
2. Owner selects hosting and PostgreSQL providers and confirms domain, storage, and service boundaries.
3. Provision isolated staging app/database/storage/secret scope/HTTPS and monitoring; do not reuse production resources.
4. Place staging secrets directly into the chosen secret manager; validate build and health endpoints.
5. Inspect staging migration status and SQL, verify backup, and obtain explicit owner approval before any migration deployment.
6. Deploy the reviewed revision, then run the staging E2E release gate using synthetic data.

This document prepares requirements only. It creates no resources, starts no deployment, and authorizes no migration.

Local follow-up coverage (not staging evidence) includes the local registration/login flow, foreign-origin rejection on cookie-authenticated mutations, interview history ownership, desktop code ownership and one-time pairing/replay/disconnect flow plus anonymous rejection on sensitive desktop APIs, resume upload/Resume Maker/notification isolation, manual question-bank item/favorite isolation, concurrent free-session accounting, anonymous access, Stripe-disabled checkout fail-closed behavior with no provider request, unit tests, static checks, production build, and local health endpoints. AI-provider success/failure, Stripe test-mode checkout/webhook/idempotency, hosted backup/restore, hosted persistence, and desktop clean-machine gates still require their configured isolated staging services and owner-approved credentials.

The local PostgreSQL database currently reports all 15 migrations applied and up to date; Prisma schema validation passes. The installed root dependency tree has no unmet or extraneous entries. The production environment preflight passes with process-only placeholders, but these checks do not prove clean-install reproducibility or staging database readiness.

An isolated temporary-directory `npm ci --ignore-scripts --no-audit --no-fund` using copies of the root manifests also completed with a valid top-level dependency tree; it did not replace workspace dependencies or run lifecycle scripts. npm reported deprecated ESLint 8 and several deprecated transitive packages, which should be reviewed as package maintenance. Prisma generation and build were checked separately in the project workspace. After adding strict Node engine checking, a second isolated offline clean install including `.npmrc` also succeeded on Node 24.19.

The Node runtime requirement was corrected after reviewing the official support schedule: Node 20 is end-of-life and Node 24 is LTS. The root manifest/lockfile now declare `^24.0.0`, with `.npmrc` setting `engine-strict=true`; the Node 24.19 production build, lint, typecheck, and unit tests pass. The staging host still needs to be selected/configured with Node 24.
