# Staging Setup

> **STAGING ONLY — NOT PRODUCTION.** This guide describes preparation and operation of a separate test environment. Never point it at production systems, use production credentials, or copy production data.

## Current project support

The repository currently has no staging application URL, CI/CD workflow, web-app Dockerfile, or staging deployment manifest. Render is the selected host for GENZ staging; no Render resources have been provisioned yet. `compose.yaml` provides a local PostgreSQL service only. Use Node.js 24 LTS, declared by `package.json` (`engines.node: ^24.0.0`) and checked strictly by `.npmrc`; Node.js 20 is end-of-life ([official release schedule](https://nodejs.org/en/about/previous-releases)). The app can build and start as a Node.js service with `npm run build` and `npm start`; Prisma reads `DATABASE_URL`; `/api/health` and `/api/health/db` provide liveness and database checks. Playwright requires `E2E_ENVIRONMENT=staging`, refuses production-looking host names, and requires HTTPS plus exact-host confirmation for remote targets.

The Render deployment uses the following provider-neutral staging shape:

1. A private Node.js web service built from the reviewed project revision.
2. A separate staging PostgreSQL instance/database with its own least-privilege credentials and private network access from that service.
3. A secret manager containing only staging values, with unique auth secret, staging-only AI credentials, and Stripe test-mode settings if billing is in scope.
4. Durable private resume storage mounted outside the public web directory.
5. An HTTPS staging hostname and dedicated disposable test accounts.
6. A separate test runner configured with the staging URL and exact-host E2E guard.

Use the Render deployment runbook for resource settings. Do not treat a local database, local app, or local Compose test as staging certification.

Compare the neutral deployment models in [STAGING_PROVIDER_OPTIONS.md](STAGING_PROVIDER_OPTIONS.md) and track provisioning in [STAGING_DEPLOYMENT_CHECKLIST.md](STAGING_DEPLOYMENT_CHECKLIST.md).

## Optional local Compose staging simulation

Docker Compose can host a separate local test database, but the current `compose.yaml` is for development and is not safe to reuse as a staging database: it has a fixed container name, fixed port 5432, fixed volume, and local `.env.postgres` credentials. The repository does not define an application Dockerfile or staging application service.

If a local simulation is needed later, prepare a separate opt-in Compose file with all of the following before starting it:

- A distinct service and generated container name (no fixed `container_name`).
- A distinct staging database name and credentials stored in an ignored local file.
- A distinct named volume, such as `genz-staging-postgres-data`; never mount the development volume.
- A distinct loopback-only host port such as `127.0.0.1:5433:5432`.
- A separate Compose project name and isolated app environment using the staging database URL.
- No production secrets or customer data.

This would simulate database/application separation on one machine, but it would not replace certification against the eventual hosted staging environment. No staging Compose file, container, or volume is created by this preparation phase.

## Environment variables

Use [.env.staging.example](../.env.staging.example) as a placeholder inventory only. It contains no real secrets and is not ready to source. Put actual app secrets in the selected host's secret manager and runner-only E2E values on the Playwright runner. Do not upload the example file to a deployment or commit a populated copy.

The template labels each value as required/optional and identifies local-only, staging-only, server-only, client-safe, or test-runner scope. `NEXT_PUBLIC_APP_URL` is intentionally the only public-prefixed value and is a non-secret origin. Never put database, auth, AI, or Stripe values in a `NEXT_PUBLIC_*` variable.

| Variable/category | Scope | Requirement |
|---|---|---|
| `NODE_ENV` | App | `production` for a deployed Next.js staging service; this turns on secure auth cookies and startup checks. |
| `DATABASE_URL` | App and migration job | TLS-enabled URL for the isolated staging database and a staging-only database role. Prisma uses this variable for runtime and migrations; there is no `DIRECT_DATABASE_URL` configuration. |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` | App | Same canonical HTTPS staging origin. |
| `NEXTAUTH_SECRET` | App | Unique random value of at least 32 UTF-8 bytes; never reuse local or production values. NextAuth uses JWT sessions with an 8-hour maximum age. |
| `RESUME_STORAGE_DIR` | App | Absolute durable private path outside `public/`, writable by the service account and backed up under the staging policy. |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | App | At least one staging-only provider key is required by production startup validation. Keep server-side; never expose through `NEXT_PUBLIC_*`. |
| Stripe test settings | App/webhook | Optional. For subscription checkout configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PREMIUM_PRICE_ID` together using Stripe test mode. Configure test credit-pack Price IDs if testing credit purchases. |
| `E2E_BASE_URL` | Playwright runner | HTTPS staging application origin. |
| `E2E_ENVIRONMENT` | Playwright runner | Must be `staging`. |
| `E2E_TARGET_CONFIRM` | Playwright runner | For remote targets, exactly `URL.host` (hostname and non-default port if present). It is not a secret. |
| Email | Not implemented | The app currently sends in-app notifications only; there is no email provider or consumed `EMAIL_*` configuration. Do not add email credentials until an email integration is implemented and reviewed. |

## AI provider selection and behavior

The supported adapters are OpenAI (`ChatGPT`) and Google Gemini (`Gemini`), implementing the shared `AIProvider` interface in `lib/ai/types.ts`. Application requests select the provider with the stored/requested `aiModel` value; there is no `AI_PROVIDER` environment variable. `OPENAI_MODEL` and `GEMINI_MODEL` set each adapter's model independently, with code defaults when omitted. Configure a staging-only API key for every provider that staging users are allowed to select. The production startup validator requires at least one of `OPENAI_API_KEY` or `GEMINI_API_KEY`; if a request selects an adapter whose key is missing, the adapter raises `AIConfigurationError` and API handlers return a controlled configuration response. Provider/network errors are normalized to `AIProviderError` categories such as rate limit, timeout, context limit, unavailable, or invalid response. There is no automatic provider fallback and no mock/stub provider in this repository.

Provider metrics log only provider, model, outcome, latency, and an error type. They do not include API keys, prompts, response bodies, or raw provider error messages. The current unit and Playwright tests do not exercise provider success/failure, so a provider integration gate still needs staging-only credentials and an approved test procedure before those flows are certified. The existing smoke suite can run without making provider requests.

## Production startup validation rationale

The production environment check in `lib/production-env.cjs`, called by `instrumentation.ts` for the Node.js production runtime, intentionally fails startup when required deployment settings are missing or unsafe:

- `NEXTAUTH_URL` must be HTTPS so authentication uses the canonical secure origin and secure cookies.
- `NEXT_PUBLIC_APP_URL` must be the same HTTPS origin because browser URLs and request-origin checks use that public origin. Keeping both origins equal avoids mismatched auth callbacks and mutation-origin validation.
- `RESUME_STORAGE_DIR` must be an absolute path outside `public/`. Resume files contain user data and must not be web-served as public assets; an explicit durable path also avoids silently writing uploads to ephemeral or unintended storage.
- `NEXTAUTH_SECRET` must be present and at least 32 UTF-8 bytes; the checker never prints its value.
- `DATABASE_URL` must be a PostgreSQL URL, and at least one server-side AI provider key must be present.

These checks are intended for deployed production-mode services, including staging. Do not weaken them to make a local HTTP development configuration pass; use `npm run dev` for local development and supply real staging-only values through the staging secret manager for a deployed staging service.

Other optional billing limits and model names are listed in `.env.example`. Do not copy local `.env` or `.env.postgres` files into staging.

## Provisioning and startup

1. Select the hosting and PostgreSQL providers. Create a dedicated staging app, database, credentials, secret scope, HTTPS hostname, and private resume volume. Keep all resources separate from development and production.
2. Generate a unique staging `NEXTAUTH_SECRET` outside the repository. For example, use Node's `crypto.randomBytes(32)` and place the result directly into the staging secret manager. Do not save the generated value in this file or a committed file.
3. Configure the staging app variables from the table and run `npm ci` with build/dev dependencies available, then `npx prisma generate`, `npm run deploy:check`, and `npm run build` in the staging build environment. The installed `@prisma/client` also runs Prisma generation from its install lifecycle when the local Prisma CLI is present; the explicit command makes the custom generated-client output unambiguous. Configure the service to start with `npm start`; terminate TLS at a trusted proxy and pass only proxy-validated forwarding headers.
4. Confirm the deployed storage path is absolute, private, persistent, and outside the web root. The current adapter uses local filesystem storage; a multi-instance or ephemeral host needs a shared private storage implementation before resume workflows can be certified.

## Staging database and migrations

The database must be a newly provisioned isolated PostgreSQL database with no production data. Use a dedicated least-privilege staging role, TLS, private network rules, and a recoverable staging backup before schema changes. A new empty staging database should have the repository's existing migrations pending; the migration job applies those reviewed files with `prisma migrate deploy` after the target and backup have been verified and the project owner has approved the operation.

From the project root with the staging database environment securely injected by the chosen secret manager or migration job:

```powershell
npx prisma validate
npx prisma migrate status
```

Review the migration SQL and status output against the staging database. If anything is pending, stop for explicit project-owner approval before running:

```powershell
npx prisma migrate deploy
npx prisma migrate status
```

Never run `prisma migrate reset`, `prisma db push`, destructive SQL, or volume deletion on staging. Do not run these commands against production. This repository has not been configured with a staging database, so no staging migration has been run by this preparation.

## Test users and data

Register two dedicated test accounts through the staging UI using synthetic test-only email addresses. Use unique strong passwords stored in an approved password manager; do not put passwords in reports, source files, or E2E output. Do not use real customer accounts or production data. Keep generated resumes, interviews, and other records synthetic and within this isolated database. The current smoke tests create accounts and records and do not automatically clean them up, so run them only in a disposable, isolated staging dataset.

## Playwright E2E

Set the E2E values only in the test runner environment. The remote-target confirmation must match the URL host exactly; a production-looking hostname is refused.

```powershell
$env:E2E_BASE_URL = 'https://<staging-host>'
$env:E2E_ENVIRONMENT = 'staging'
$env:E2E_TARGET_CONFIRM = '<staging-host>'
npm.cmd run test:e2e
```

If the staging URL uses a non-default port, include `:port` in both `E2E_BASE_URL` and `E2E_TARGET_CONFIRM`. Use Playwright's installed Chromium, or set `PLAYWRIGHT_CHANNEL=chrome` if Google Chrome is installed. The browser suite covers registration/login/logout, page smoke checks, interview ownership, concurrent free-session accounting, and anonymous access. Extend coverage with staging test data for resume ownership, question bank mutations, feedback/planner, and any enabled billing/provider flows before calling the wider gate complete. Do not run billing checks against live Stripe or provider checks with unapproved keys.

## Health verification

After the service starts, verify over HTTPS:

- `GET <E2E_BASE_URL>/api/health` returns HTTP 200 and `status: "ok"`.
- `GET <E2E_BASE_URL>/api/health/db` returns HTTP 200 and `database: "available"`.
- `npx prisma migrate status`, using the same isolated staging database, shows the reviewed migration state.
- Registration, login, logout, upload/download ownership, interview history isolation, and protected API behavior pass with disposable staging accounts.

The health routes are diagnostic signals; they do not replace migration, ownership, or user-flow verification.

## Rollback

For an application regression, redeploy the last known-good staging application artifact and keep the database unchanged when the schema remains backward compatible. Do not blindly reverse migrations. For incompatible schema/data problems, stop writes and use a reviewed forward-fix or restore a staging backup into a separate isolated recovery database, then verify it before changing the staging service target. Never restore over or point any rollback workflow at production.

## Security requirements

- **STAGING ONLY — NOT PRODUCTION.** Use separate credentials, database, storage, secrets, and test accounts.
- Keep the database private, least-privileged, TLS-protected, and unreachable from public clients.
- Keep auth/provider/payment secrets in the staging secret manager. Do not commit populated env files or expose keys in browser bundles/logs.
- Use HTTPS, secure cookies, trusted proxy configuration, private persistent resume storage, and staging-only test provider/payment modes.
- Back up staging before approved schema changes. Restrict access to test resumes and remove synthetic records according to the staging retention policy.
- Do not create cloud resources, deploy applications, start a new database, or change production settings as part of this guide's preparation phase.
