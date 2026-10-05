# Phase 32A Discovery Report

Inspection completed before this report was updated. Secret values were not printed or copied. Findings below describe this workspace on 2026-09-28.

## Project structure and architecture

- **Web framework:** Next.js 15.5.26 App Router, React 18.3.1, TypeScript. The root package is `ai-interview-platform` version 1.0.0.
- **Backend:** Next.js Node.js route handlers under `app/api`; server-side services and integrations under `lib`; NextAuth v4 authentication. No separate backend service was found.
- **Database:** PostgreSQL accessed through Prisma. `DATABASE_URL` is required by `prisma/schema.prisma`. The local `.env` has a URL configured for database `ai_interview_platform` at `localhost:5432`; the value itself is not reproduced. TCP is currently unavailable.
- **Prisma:** CLI and client 5.22.0 (package range `^5.19.1`). The schema validates. There are 15 migration directories, from `20260926000000_initial` through `20260927120000_phase30_reliability`.
- **Data model:** Models include `User`, `InterviewSession`, `Resume`, `InterviewAnswer`, `QuestionBankItem`, `PreparationPlan`, `PreparationTask`, `CompanyResearch`, `Notification`, `Subscription`, `CreditAccount`, `CreditTransaction`, `CreditReservation`, `CreditCheckout`, and `AdminAuditLog`. Exact requested model names `Session`, `InterviewQuestion`, `InterviewFeedback`, and `AuditLog` are absent; equivalents are not all represented as separate models (feedback is part of session/simulator data, audit records use `AdminAuditLog`).
- **Desktop:** Electron 44 and electron-builder. Product name is `Genzz AI`, version 1.0.0. The desktop client requests microphone permission only after a user action and revokes the in-memory permission flag when listening stops or the app window closes.
- **Payments:** Stripe integration, server-side checkout and webhook code. Local `.env` Stripe secret, webhook secret, and premium price ID are empty or missing; test-mode verification has not been run.
- **AI:** Server-side provider abstraction for OpenAI and Gemini with per-provider timeout/retry handling and JSON provider outcome/latency metrics. Both keys are non-empty in local `.env`, but their environment/purpose is not identified as staging, so no live requests were sent. Staging provider credential status is unverified.
- **Email:** No email provider integration/dependency found.
- **Storage:** Resume storage uses a private local filesystem path setting (`RESUME_STORAGE_DIR`); no cloud object storage provider is configured. Local `.env` does not provide a non-empty storage path.
- **Monitoring:** `/api/health` is a liveness endpoint; `/api/health/db` executes `SELECT 1` and degrades to HTTP 503 on database failure. Structured console events exist for AI provider calls and Prisma query failures. No external error/latency monitoring provider or database monitoring configuration was found.
- **Deployment:** Node.js/Next deployment instructions exist in `docs/production-deployment.md`; the document incorrectly labels the framework Next.js 14 and should be corrected before serving as release documentation. No Dockerfile, Docker Compose file, hosting manifest, automated database backup configuration, or restore target was found. Documentation identifies local resume storage and in-memory per-process rate limits as deployment constraints.
- **E2E:** Playwright `@playwright/test` is installed and `playwright.config.ts` requires an explicitly identified staging target and environment. One smoke test is present in `tests/e2e/staging-smoke.spec.ts`; it covers registration/login, dashboard/core routes, admin rejection, liveness, and anonymous credit API rejection. It does not cover the full requested workflow matrix. No `E2E_BASE_URL` or staging environment was configured.
- **Legal pages:** User-facing routes exist for `/privacy`, `/terms`, `/ai-usage`, `/billing-terms`, and `/data-deletion`. They are clearly marked drafts with placeholders for operator, jurisdiction, data practices, contacts, billing, and deletion details; no legal review is claimed.

## Local infrastructure and environment checks

- `.env` exists; `.env.local` does not. `.env.example` documents `DATABASE_URL`, auth, AI, billing, and storage variable names without real credentials. Secret values are excluded from this report.
- A local `DATABASE_URL` is configured, but its `localhost:5432` TCP connection fails. Prisma reports the target database name but cannot establish migration status. No database command that modifies data was run.
- No PostgreSQL process was found. Windows service enumeration was denied by the environment, so PostgreSQL service state is unverified. `psql`, Docker, and Docker Compose commands are unavailable; no project Compose configuration exists.
- Git is unavailable as a command and the project root has no `.git` directory. Git status, history, tracked secret review, and tag state therefore cannot be verified.
- Playwright target variables are absent from the process environment. No staging deployment URL/account was supplied.
- Existing desktop output includes a Windows NSIS installer artifact. Artifact presence/build does not verify installation, launch, connection, reconnection, or clean uninstall.

## Existing verification configuration

- Health routes exist; local verification returned HTTP 200 from `/api/health` and HTTP 503 from `/api/health/db`.
- Payment and AI code keep provider calls server-side. Local AI key entries do not establish staging credentials or successful integrations.
- The desktop microphone flow is explicitly user controlled in code. No user-authorized microphone session was provided; speech recognition was not exercised.
- Draft legal pages include the disclosure that AI interview assistance is practice support and is not guaranteed employer-specific information or hiring outcomes.

## Discovery conclusion

Code and local development checks are available, but release verification depends on infrastructure and environment details absent from this workspace: PostgreSQL, isolated staging, provider/payment test configuration, backups/restore, monitoring, legal review, clean-machine installer operation, explicit microphone testing, and Git. Existing credentials/artifacts/configuration are not treated as evidence of successful end-to-end verification.
