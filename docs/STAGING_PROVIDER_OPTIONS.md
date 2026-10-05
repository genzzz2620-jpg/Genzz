# Staging Provider Options

> **STAGING ONLY — NOT PRODUCTION.** This comparison is provider-neutral and does not select or endorse a vendor. No hosting or database provider is currently configured in the repository.

All three options need an isolated PostgreSQL staging database, separate secret scope, HTTPS app URL, disposable test accounts, private resume storage, backup/restore plan, monitoring, and a staging-only test runner. Use the runtime requirements and migration safeguards in [STAGING_SETUP.md](STAGING_SETUP.md).

## Common application requirements

- Node.js **24 LTS** is the supported application and test runtime; `package.json` declares `^24.0.0` and `.npmrc` enables strict engine checks. The current local runtime is Node 24.19. Node.js 20 is end-of-life, so do not select it for staging. See the [official Node.js release schedule](https://nodejs.org/en/about/previous-releases).
- Use npm and `npm ci` from the root `package-lock.json` (lockfile version 3). The root package has no `packageManager` pin. The build environment must include development dependencies because TypeScript, Prisma CLI, and the frontend build tools are development dependencies.
- Generate the custom Prisma client before build with `npx prisma generate`. The `@prisma/client` installation lifecycle also attempts generation when the local Prisma CLI is available; the generated output is ignored by Git, so it must exist in the build artifact.
- Build with `npm run deploy:check` and `npm run build`; start the built service with `npm start` (`next start`). Run as a persistent Node.js service, not a static export.
- `DATABASE_URL` must identify the staging database only. Inspect `npx prisma migrate status` and reviewed SQL before obtaining owner approval for `npx prisma migrate deploy`.
- At least one staging-only `OPENAI_API_KEY` or `GEMINI_API_KEY` is required by the current production startup validator. Stripe is optional; if enabled, use test-mode credentials and a test webhook.
- Configure `RESUME_STORAGE_DIR` as an absolute private path outside the public web root. The current implementation stores files on local disk. Use a durable persistent volume for a single instance; ephemeral or multi-instance deployments require a shared private object-storage adapter first.
- The app has no public asset directory, email sender, server cron, scheduled job, or background worker requirement. Notifications are in-app. No conventional WebSocket endpoint was found; desktop answer output uses streamed HTTP NDJSON and the proxy must not buffer or prematurely time out that response.
- Desktop clients connect to the app's HTTPS origin. Connection codes are one-time and expire after five minutes; exchanged bearer tokens expire after two hours. Keep desktop API routes reachable and streaming enabled. Do not embed server credentials in the Electron package.
- Resume uploads accept PDF/DOCX up to 10 MiB and process synchronously in Node.js. Configure request-size and execution-time limits with suitable headroom.

## Option A — Node.js hosting plus managed PostgreSQL

**Required services:** A persistent Node.js application service, managed PostgreSQL, secret storage, durable private resume volume or a planned object-storage adapter, HTTPS, backups, and monitoring.

**Environment:** `NODE_ENV=production`, staging `DATABASE_URL`, same-origin `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL`, unique `NEXTAUTH_SECRET`, absolute `RESUME_STORAGE_DIR`, one staging AI key, optional Stripe test settings. Keep E2E runner variables on the runner, not the app's public client environment.

**HTTPS/database:** Serve the app through a provider-managed certificate or trusted TLS proxy. Keep PostgreSQL on private networking with TLS and a least-privilege staging role.

**Deployment process:** Connect the reviewed application revision or approved build artifact. Install from the npm lockfile with build dependencies, generate Prisma client, run deployment preflight, build, and start the Node service. Confirm the host supports Next.js API routes, request body sizes for resume uploads, and non-buffered streaming responses.

**Migration process:** Use a separate, controlled migration job with staging secrets. Validate the schema, inspect migration status and SQL, take/verify a staging backup, obtain explicit approval, then use `prisma migrate deploy` and confirm status again.

**Rollback:** Redeploy the prior application artifact when schema compatibility permits. Do not automatically reverse database migrations; use a reviewed forward fix or restore to an isolated recovery database.

**Approximate operational complexity:** **Medium.** The host and database operator handle much of the platform patching, but storage durability, streaming behavior, backup policy, migration approvals, and app-specific secrets remain owner responsibilities.

## Option B — Container hosting plus managed PostgreSQL

**Required services:** Container build/registry and runtime, managed PostgreSQL, secret storage, HTTPS ingress, durable private volume or object-storage adapter, backups, and monitoring. A reviewed app `Dockerfile` and deployment definition must be added; neither exists in the current repository.

**Environment:** The same app values as Option A, supplied as runtime secrets/environment. Build-time `NEXT_PUBLIC_APP_URL` must be the staging origin because Next.js embeds public values during build. Keep database and provider secrets server-side.

**HTTPS/database:** Terminate TLS at a trusted ingress. The app container reaches PostgreSQL over private TLS/networking. Expose no database port publicly.

**Deployment process:** Add and review an application container build that uses the Node runtime, installs locked dependencies, generates Prisma client, builds Next.js, and starts `next start`. Publish an immutable staging image and deploy it behind an ingress that supports streaming NDJSON and request limits for uploads.

**Migration process:** Run a one-off migration task from the same image or a locked migration image, against staging only. Review status and SQL, verify backup, obtain explicit approval, deploy pending migrations, and recheck status before shifting app traffic.

**Rollback:** Point the staging service back to its previous immutable image if compatible with the current schema. Keep database migration rollback manual and reviewed; restore only into an isolated staging recovery database.

**Approximate operational complexity:** **Medium to high.** Container image and runtime behavior are reproducible, but the repository needs a Dockerfile, image build/publish configuration, persistent file handling, and explicit streaming/health configuration.

## Option C — Self-managed VPS plus PostgreSQL

**Required services:** Linux VM, Node.js runtime, PostgreSQL on the VM or a separately isolated database host, firewall/private networking, TLS reverse proxy, process manager, private persistent disk, encrypted backup destination, secret handling, patching, and monitoring/alerts.

**Environment:** The same app variables as Option A. Store server secrets outside the source tree with restrictive file/service permissions; keep the E2E runner configuration separate. Do not place production values on the staging VM.

**HTTPS/database:** Configure a trusted HTTPS reverse proxy with validated forwarding headers, sufficient upload size/timeouts, and buffering disabled for streamed desktop NDJSON. Bind PostgreSQL to private interfaces only; use TLS, least privilege, and firewall rules.

**Deployment process:** Install a supported Node.js LTS and npm, deploy a reviewed artifact, generate Prisma client during build, run preflight/build, and manage `npm start` under a supervised service. Configure log rotation, disk alerts, service restart policy, backup jobs, and a durable private resume directory.

**Migration process:** Run the reviewed Prisma migration command as a controlled operator task after confirming the staging target, backup, and migration status. Never use database reset or schema-push shortcuts.

**Rollback:** Restore the previous application artifact under the process manager. For database issues, stop writes and use an approved forward fix or restore to a separate isolated recovery database. Document RTO/RPO and rehearse restore before relying on this option.

**Approximate operational complexity:** **High.** This provides direct control but makes the operator responsible for OS/database patching, network hardening, TLS, storage durability, restore drills, process supervision, and alert response.

## Decision still required

The project owner must select one hosting/deployment model and its PostgreSQL service. The options above are alternatives, not an instruction to create resources. Until a provider and isolated staging resources are selected and provisioned, do not deploy or run staging migrations.
