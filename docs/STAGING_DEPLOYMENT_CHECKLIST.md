# Staging Deployment Checklist

> **STAGING ONLY — NOT PRODUCTION.** Every item is currently unfinished. Check an item only after recording evidence against the isolated staging environment. Local results do not count as staging evidence.

## Infrastructure and configuration

- [ ] Hosting/deployment model selected by the project owner.
- [ ] Isolated staging PostgreSQL provisioned; no production data copied.
- [ ] Separate least-privilege staging database credentials created.
- [ ] Staging secret manager/environment configured from `.env.staging.example` without committing populated values.
- [ ] Private durable resume storage configured outside the public web root.
- [ ] HTTPS configured for the staging app; proxy supports streaming and allowed upload size/timeouts.
- [ ] Staging-only AI keys configured if AI flows are in scope.
- [ ] Stripe test-mode secrets, webhook, and test Price IDs configured if billing flows are in scope.
- [ ] Email provider decision recorded; email is not currently implemented.
- [ ] Monitoring, logs, alerts, and staging backup/retention configured.

## Build, database, and app

- [ ] Node.js 24 LTS is selected for the app/build runtime, matching the root `engines.node` requirement.
- [ ] Deployment source contains the intended application revision and the reviewed migration files.
- [ ] `npm ci` completes with build dependencies available and Prisma client generation completes.
- [ ] `npm run deploy:check`, `npm run lint`, and `npm run typecheck` pass in the staging build environment.
- [ ] `npm run build` completes for the staging environment.
- [ ] Migration SQL and `npx prisma migrate status` reviewed against staging.
- [ ] Staging backup verified before any approved migration.
- [ ] Project owner explicitly approves pending migration deployment.
- [ ] `npx prisma migrate deploy` run only against the isolated staging database after approval.
- [ ] `npx prisma migrate status` confirms the expected result after deployment.
- [ ] Staging application deployed and starts successfully with `npm start` or the selected platform's equivalent.
- [ ] `GET /api/health` passes over HTTPS.
- [ ] `GET /api/health/db` passes over HTTPS.

## User flows and release gates

- [ ] Two dedicated synthetic staging test accounts created; credentials stored outside reports/source.
- [ ] `E2E_BASE_URL` configured to the exact HTTPS staging origin.
- [ ] `E2E_ENVIRONMENT=staging` configured on the test runner.
- [ ] `E2E_TARGET_CONFIRM` matches `URL.host` exactly for the remote target.
- [ ] Playwright E2E suite executed against staging.
- [ ] Registration, login, logout, dashboard, and protected routes pass.
- [ ] Interview creation, persistence, history, and feedback flows pass.
- [ ] Resume upload, processing, download, deletion, and private ownership checks pass.
- [ ] Question bank, preparation planner, and notifications flows pass where enabled.
- [ ] Two-user direct API read/update/delete isolation is verified in both directions.
- [ ] AI provider success/failure checks pass with authorized staging-only credentials.
- [ ] Stripe test checkout/webhook/idempotency checks pass if billing is enabled.
- [ ] Representative latency and database query behavior are recorded.
- [ ] Desktop client connects to the HTTPS staging app; one-time code expiry, token expiry, streaming, disconnect, and reconnect are verified on a clean test machine if desktop is in scope.
- [ ] Backup restore is rehearsed in a separate disposable staging database.

## Rollback readiness

- [ ] Previous application artifact and deployment procedure are recorded.
- [ ] Database rollback/forward-fix and isolated restore procedure is reviewed; no destructive reset is used.
- [ ] Incident contact, monitoring alert, backup owner, and restore RTO/RPO are recorded.

## Current state

**No items are complete for staging.** The existing local app and database checks are recorded separately in [PHASE_32C_2_STAGING_DEPLOYMENT_PACKAGE_REPORT.md](../PHASE_32C_2_STAGING_DEPLOYMENT_PACKAGE_REPORT.md). Provider selection and isolated staging infrastructure remain owner actions.
