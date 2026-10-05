# Production deployment

This project currently uses Next.js 15.5.26, Node.js, PostgreSQL, and a separate Electron desktop client. The installed Next.js package supports Node.js `^18.18.0 || ^19.8.0 || >=20.0.0`, and the root package declares Node.js `^24.0.0` with strict npm engine checks to use a maintained LTS runtime. Deploy the web app as a persistent Node.js service that supports Next.js server routes and streaming responses. Do not deploy it as a static export. See the [official Node.js release schedule](https://nodejs.org/en/about/previous-releases) when selecting the host runtime.

## Environment setup

Use separate development, test, and production values. `.env.example` is a development template, not a source of production credentials. Keep `.env` files out of source control and place production values in the host's secret manager.

Required for a production web deployment:

- `DATABASE_URL`: PostgreSQL connection string for the runtime database account. Use TLS and least privilege where supported. Prisma uses this variable for both runtime and migrations; this project does not currently use `DIRECT_DATABASE_URL`.
- `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL`: the same canonical HTTPS origin, with no credentials in the URL.
- `NEXTAUTH_SECRET`: a unique, randomly generated secret with at least 32 UTF-8 bytes. Do not reuse it between environments.
- `RESUME_STORAGE_DIR`: private storage outside `public/`. The current adapter is local filesystem storage. Mount a durable persistent volume at this location for a single instance; serverless or multi-instance deployments need a shared private object-storage implementation of `ResumeStorage` first.
- At least one of `OPENAI_API_KEY` or `GEMINI_API_KEY` for AI features. Keep provider keys server-side; never prefix them with `NEXT_PUBLIC_`.

Stripe is optional. To enable checkout, configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PREMIUM_PRICE_ID` together. Use live-mode values and the exact production webhook URL only in production. Leaving all three unset keeps checkout unavailable.

Other optional settings include model names, AI usage cost estimates, rate-limit entitlements, and billing display labels. `UPLOAD_MAX_SIZE` was removed from the template because the current upload limit is fixed at 10 MiB in the upload API; changing this safely requires updating its enforced server-side limit, not only an environment value.

## Pre-deployment

1. Configure production values in the hosting platform's secret manager. Do not copy a developer `.env` file into the deployment artifact.
2. Run `npm ci` in a build environment with development dependencies and install scripts enabled; the build tools and Prisma CLI are development dependencies. Generate the custom Prisma client with `npx prisma generate`, then run `npm run deploy:check`. The same environment checks run during Node.js production startup and fail with variable names only (never secret values) if required values are missing or unsafe.
3. Set `NEXT_PUBLIC_APP_URL` in the build environment because Next.js embeds this public origin in browser bundles. Run `npm run lint`, `npm run typecheck`, and `npm run build` on the release revision. Build the desktop client separately with `npm run desktop:build` when preparing a desktop release.
4. Confirm the target supports Next.js API routes and unbuffered HTTP streaming (the desktop answer API streams NDJSON), has outbound HTTPS access to the configured AI/payment providers, and allows 10 MiB PDF/DOCX uploads with suitable request-size, memory, and execution-time limits.
5. Confirm PostgreSQL backups are current and tested. Review pending SQL migrations, then apply additive migrations with `npx prisma migrate deploy` during a controlled release. Never use `prisma migrate reset` against retained data.
6. Ensure the resume storage mount is private, writable only by the service account, durable across restarts, encrypted/backed up, and not mounted below `public/`.
7. Configure the production Stripe webhook only if billing is enabled. Verify signature handling and a test event in the provider's test environment before enabling live checkout.
8. Check the deployed HTTPS site for sign-in, registration, protected routes, admin separation, resume upload/download ownership, AI generation, Stripe callbacks (if configured), and desktop connection flows. Use separate test accounts and non-production data.

## Scaling and operations

The application currently uses in-memory, per-process rate limits and local disk resume storage. A single persistent Node.js instance with a durable private volume is the supported deployment shape without further infrastructure work. Before running multiple instances or serverless functions, replace the limiter with a shared store and implement shared private object storage. Do not assume sticky routing makes either subsystem durable or globally enforced. No email provider, cron service, or server-side background worker is currently implemented.

Terminate TLS at a trusted proxy. Configure the proxy to replace client-provided forwarding headers; address-based throttling depends on trusted client IP handling. Set the canonical URLs to the externally visible HTTPS origin so mutation Origin checks match browser requests.

Monitor service health, database connectivity, disk capacity, login and rate-limit failures, AI/provider errors, webhook failures, and backup completion. Keep logs free of credentials, session tokens, prompts, resume contents, transcript text, and audio. Define retention and restore procedures for PostgreSQL and private files before launch.

## Environment separation

- **Development:** local PostgreSQL, local `.env`, non-production provider keys, and local private resume storage.
- **Test/staging:** isolated database, auth secret, provider/payment test credentials, canonical HTTPS staging URL, and test-only accounts/data. Never point a staging deployment at production storage or a production database.
- **Production:** managed secrets, production database credentials with restricted access, canonical HTTPS URLs, live provider keys only when needed, and durable private resume storage. Do not use demo seeding or test payment credentials.

The repository does not define a hosting provider, Docker image, shared rate-limit service, object-storage provider, or automated backup system. Configure those operational services for the chosen host before claiming multi-instance or disaster-recovery readiness.

The Phase 21 onboarding migration adds nullable preference fields and an onboarding enum/step to the existing `User` table. Existing accounts receive `COMPLETED` by default; registration explicitly starts new accounts at `NOT_STARTED`. Apply this migration before deploying code that reads onboarding fields.
