# Render Staging Deployment

> **STAGING ONLY.** This runbook provisions a separate Render staging service and Render PostgreSQL database. Never connect it to production, reuse production credentials, or copy production data. The source repository and staging branch are configured; Render resources have not yet been created.

## Architecture

```text
Internet
   |
Render-managed HTTPS
   |
GENZ staging Node.js Web Service
   |                 \
   |                  +-- OpenAI API (server-side key)
   +-- Render PostgreSQL (staging database, internal connection)
   +-- Render persistent disk (/var/data)
       `-- private resumes (/var/data/genz-resumes)
```

Production remains on its own host, database, storage, and credentials. Do not connect or copy data between the environments.

## Compatibility and commands

- Service name: `genz-staging`.
- Source: GitHub repository `https://github.com/genzzz2620-jpg/Genzz.git`, branch `staging`.
- Region: Singapore for both the Web Service and its staging PostgreSQL database.
- Instance count: one Web Service instance while resume storage uses a local persistent disk.
- Runtime: Node.js 24. `package.json` requires `^24.0.0`; `.npmrc` enables strict engine checks. Pin the Render service to Node 24 (or set `NODE_VERSION` to a compatible 24.x release) instead of relying on a moving default.
- Package manager: npm, using the root `package-lock.json` (lockfile version 3). The repository does not pin an npm version.
- Build command: `npm ci && npx prisma generate && npm run deploy:check && npm run build`
- Start command: `npm start` (the existing package script runs `next start`).
- Health check path: `/api/health`. Also verify `/api/health/db` after migrations and database configuration.
- Runtime type: persistent Node.js Web Service; this is not a static export or Docker deployment.

`NEXT_PUBLIC_APP_URL` is embedded into the browser build, so set it to the actual assigned staging HTTPS origin before the first build and rebuild if the hostname changes. `npm run deploy:check` validates the production-style app environment during build; set its required staging variables before triggering the build. It checks values without printing secrets.

Render's current setup details are documented in its guides for [Node.js versions](https://render.com/docs/node-version), [Web Services](https://render.com/docs/web-services), [persistent disks](https://render.com/docs/disks), [PostgreSQL connectivity](https://render.com/docs/postgresql-creating-connecting), and [PostgreSQL backups](https://render.com/docs/postgresql-backups). Recheck plan-specific limits and current backup options in the Render dashboard when provisioning.

## 1. Prepare source control

Render must be connected to the confirmed GitHub repository `https://github.com/genzzz2620-jpg/Genzz.git`. Configure the Web Service to deploy the existing `staging` branch at its latest reviewed commit. Do not select `main` or create another repository.

Choose a dedicated staging branch (for example, the team's existing staging branch) and configure the Web Service to deploy only that branch. Do not select the production branch unless that is the owner's explicit release strategy. Keep repository access limited to the Render workspace and intended maintainers.

## 2. Provision isolated Render resources

In the Render workspace, select the Singapore region for both staging resources:

1. Create a new **Render PostgreSQL** instance specifically for staging. Give it a clearly staging-only name. Do not attach or reuse any production database.
2. Select a PostgreSQL version supported by Prisma and an instance plan with the backup/recovery capability required by the staging data policy. Configure and document the backup retention and restore procedure; verify a backup/restore path before migrations. Render's free PostgreSQL plan does not provide logical backups.
3. Keep the database private. For a Render Web Service in the same region, configure `DATABASE_URL` from the database's **internal** connection URL. Render's internal URL uses its private network; TLS is required for external connections, which are unnecessary for this same-region service. Do not expose the database to public ingress. Use an external TLS URL only for an explicitly approved external operator connection.
4. Create the `genz-staging` Render **Web Service** from the connected repository's `staging` branch. Choose the Node runtime, Singapore region, one instance, the build command above, start command `npm start`, and health check path `/api/health`.
5. Add a Render persistent disk to this single service with mount path `/var/data`. Set `RESUME_STORAGE_DIR=/var/data/genz-resumes`. The implementation creates the configured directory and files with restrictive modes. Only files beneath the mount path persist; this disk is private to this one service instance. Keep the service at one instance while using local-disk resume storage. Disk-backed services have deploy downtime and cannot use zero-downtime deploys; do not scale this service horizontally without first replacing local-file storage with a shared private storage adapter.
6. Use the Render-assigned `*.onrender.com` HTTPS hostname initially. Do not guess or type a hostname before Render assigns it. Set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to that exact same HTTPS origin, with no path/query/fragment. If a custom staging domain is added later, wait for its HTTPS certificate and update both variables to that exact origin, then rebuild/redeploy.
7. Store all app secrets as Render service environment variables (or an appropriately scoped Render environment group). Do not add populated environment files to the repository. Keep database and provider secrets server-side; only `NEXT_PUBLIC_APP_URL` is public and it contains the origin, not a secret.

## 3. Configure environment variables

Configure the following staging values in the Render Web Service before the build. Enter secret values directly in Render; never put them in this runbook, source files, a browser-prefixed variable, or a report.

Required:

- `NODE_ENV=production`
- `DATABASE_URL` — staging database's internal connection URL, supplied from the newly created Render PostgreSQL instance.
- `NEXTAUTH_URL` — actual Render HTTPS origin.
- `NEXT_PUBLIC_APP_URL` — the same actual Render HTTPS origin; available at build time.
- `NEXTAUTH_SECRET` — a newly generated, unique staging secret of at least 32 UTF-8 bytes. Generate it securely outside the repository and paste it directly into Render. Never reuse a local or production secret or include it in build output.
- `RESUME_STORAGE_DIR=/var/data/genz-resumes`
- `OPENAI_API_KEY` — authorized staging key, server-side only. Do not make an OpenAI request until the owner has configured the real key in Render.

OpenAI model configuration supported by the application:

- `OPENAI_MODEL` — optional. If omitted, application code defaults to `gpt-4o-mini`; no model value is required in this runbook.

Provider selection is per operation through the stored/requested `aiModel` value (`ChatGPT` selects OpenAI). The production startup check currently accepts either OpenAI or Gemini credentials; configure only the selected staging provider unless staging users are intentionally allowed to select Gemini too. Never set `NEXT_PUBLIC_OPENAI_API_KEY` or expose provider credentials in the client bundle.

Optional settings:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PREMIUM_PRICE_ID` must be configured together if staging checkout is tested, using Stripe test-mode values only. Credit pack Price ID variables are optional for the relevant tests.
- Set runner-only `E2E_BASE_URL`, `E2E_ENVIRONMENT=staging`, and `E2E_TARGET_CONFIRM` in the Playwright runner after the real host exists. Do not put these in the browser environment. `E2E_TARGET_CONFIRM` must exactly match the hostname, including a non-default port if present.

The current app has no email provider configuration. `PORT` is supplied by Render; do not hard-code it.

## 4. Build, migrate, and verify

1. Review the selected staging branch and confirm all required Render variables and the disk mount are set. Confirm the hostname values match the actual Render-assigned host and are HTTPS.
2. Trigger the first staging deploy with the build/start commands above. Confirm the build completes and the service starts. The health check `/api/health` is a liveness check and does not replace database verification.
3. Before schema changes, verify in the Render dashboard that `DATABASE_URL` belongs to the staging database, inspect its name/region, and verify a recoverable staging backup. Do not print or paste the URL into logs or reports.
4. From the deployed service's authorized shell with its staging environment, run `npx prisma migrate status`, review the pending migration history, and confirm the existing 15 migration directories are present in the deployed source. Stop if the database is not empty/new or its identity is uncertain.
5. After staging target and backup verification, apply the reviewed existing migrations with `npx prisma migrate deploy`, then run `npx prisma migrate status`. Never run `prisma migrate reset` or `prisma db push`; do not edit the existing migration history.
6. Verify over the actual HTTPS origin: `/api/health` returns HTTP 200 with status `ok`, `/api/health/db` returns HTTP 200 with database available, registration/login/logout work with disposable synthetic accounts, and uploaded resumes can be retrieved only through authorized application routes after a redeploy/restart.
7. Only after an authorized staging OpenAI key is configured, make one controlled provider request through the application's existing provider abstraction. Check controlled error handling and confirm the key is absent from browser bundles and logs. Do not test with production data or credentials.
8. Run Playwright only against the real assigned HTTPS staging host with `E2E_ENVIRONMENT=staging` and exact-host confirmation. Use disposable accounts and synthetic data. Do not run remote E2E against localhost or production.

## 5. Blueprint decision and current stop point

No `render.yaml` is included at this stage. The repository, branch, service name, and region are confirmed above. Plan, disk size, backup retention, and other account-specific resource settings must be selected in Render before provisioning. The database password and application secrets must remain outside source control. An owner-reviewed Blueprint can reference secrets as Render-managed values without embedding secret contents.

**Current status: READY FOR RENDER CONNECTION.** The source repository and staging branch are available. No Render PostgreSQL instance, Web Service, persistent disk, staging hostname, or staging credentials are available in this workspace. Do not deploy, migrate, or call OpenAI until Render is connected and the staging resources and secrets are configured.

## Owner actions

1. Connect Render to `https://github.com/genzzz2620-jpg/Genzz.git` and select the existing `staging` branch.
2. In Render, create an isolated staging PostgreSQL instance in Singapore with a supported plan and backup/recovery capability; create the `genz-staging` Node.js Web Service in Singapore and attach a persistent disk mounted at `/var/data`.
3. Set the build/start commands, `/api/health` health check, and required environment variables in the Web Service. Use the database's internal URL and Render-assigned HTTPS origin; generate a unique staging auth secret and configure the authorized staging OpenAI key directly in Render.
4. Deploy the staging branch. Verify the database identity and backup before applying migrations, then perform the migration, health, auth, resume persistence, provider, and staging Playwright checks above.
