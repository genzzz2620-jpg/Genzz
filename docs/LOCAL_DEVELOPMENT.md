# Local development setup

## Requirements

- Node.js and npm
- Docker Desktop with its Engine running

## Configure the local database

1. Copy `.env.example` to `.env` if you do not already have a local environment file.
2. Copy `.env.postgres.example` to `.env.postgres`.
3. In `.env.postgres`, choose a local database user, database name, and development-only password. Set the same user, password, and database in `DATABASE_URL` in `.env`. For example:

   ```text
   DATABASE_URL=postgresql://genz_local:YOUR_LOCAL_PASSWORD@localhost:5432/ai_interview_platform?schema=public
   ```

   Keep the password URL-safe (letters, numbers, hyphens, and underscores), or URL-encode reserved characters. `.env` and `.env.postgres` are ignored by Git; do not commit either file or use production credentials here.

4. Start PostgreSQL and wait for its health check:

   ```powershell
   docker compose up -d
   docker compose ps
   ```

5. Apply the checked-in migrations to a new local database:

   ```powershell
   npx prisma migrate deploy
   ```

   This applies application migrations to the configured local database. Never use `prisma migrate reset` or `docker compose down -v` if you need to keep local database data.

## Run the web app

```powershell
npm install
npm run dev
```

On PowerShell systems where script execution blocks `npm.ps1`, use `npm.cmd` instead (for example, `npm.cmd run dev`). Open `http://localhost:3000`. Check database connectivity at `http://localhost:3000/api/health/db`; a healthy response contains `"database":"available"`.

## Verify locally

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

For the browser smoke suite, keep the development server running and use a local target explicitly:

```powershell
$env:E2E_BASE_URL = 'http://localhost:3000'
$env:E2E_ENVIRONMENT = 'staging'
# Optional: use installed Google Chrome instead of Playwright's downloaded Chromium.
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:e2e
```

The suite creates disposable QA accounts and local interview records. The unconfigured-billing check is skipped unless `E2E_EXPECT_BILLING_UNCONFIGURED=true` is explicitly set. Do not set that flag if local Stripe checkout is configured. Do not run `npm run build` while `next dev` is running because both commands use `.next`.

AI generation requires a server-side `OPENAI_API_KEY` or `GEMINI_API_KEY` in the local `.env`. Billing is optional and requires Stripe test-mode values before checkout can be exercised. Do not paste credentials into source files or commit them.

## Stop the local database

```powershell
docker compose down
```

This stops the container and preserves its named data volume. Keep `.env.postgres` so the same local container can restart and authenticate to its existing database.
