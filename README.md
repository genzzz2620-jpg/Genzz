# Genzz AI

Genzz AI is an AI-assisted interview preparation platform with a Next.js web app and an Electron desktop client. Its features include interview practice, resume tools, question bank, preparation planning, a simulator, company research, notifications, analytics, and optional credit/subscription flows.

## Get started locally

See [Local development setup](docs/LOCAL_DEVELOPMENT.md) for Docker PostgreSQL, environment setup, migrations, and starting the web app.

Useful commands:

```powershell
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run desktop:build
```

Playwright requires an explicit isolated target; see `playwright.config.ts`. Do not point its staging suite at production.

## Release status

Local web and database flows have been exercised. Production release is **not certified**; use [the production launch checklist](PRODUCTION_LAUNCH_CHECKLIST.md) and the latest [database stability report](PHASE_32B_DATABASE_STABILITY_REPORT.md) for current evidence and open operational gates. AI providers, Stripe, staging, durable backups, monitoring, legal review, and desktop runtime/signing require configuration or owner verification.

The provider-neutral staging preparation guide is in [STAGING_SETUP.md](docs/STAGING_SETUP.md), with deployment models in [STAGING_PROVIDER_OPTIONS.md](docs/STAGING_PROVIDER_OPTIONS.md), the current gate list in [STAGING_DEPLOYMENT_CHECKLIST.md](docs/STAGING_DEPLOYMENT_CHECKLIST.md), and the compatibility/build evidence in [the Phase 32C-2 report](PHASE_32C_2_STAGING_DEPLOYMENT_PACKAGE_REPORT.md). No staging provider or infrastructure is configured yet.
