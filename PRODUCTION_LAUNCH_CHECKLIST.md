# Genzz AI v1.0.0 Production Launch Checklist

**Current gate: NOT READY FOR PRODUCTION.** Complete each unchecked item with evidence in the deployment record. Do not launch while any P0/P1 blocker remains.

## Release and QA

- [x] Phase 31 report reviewed; current status is NOT READY FOR RELEASE.
- [x] No P0 source-level blocker confirmed in the Phase 31 review.
- [ ] Resolve Phase 31 P1 certification gates with staging evidence.
- [x] Web lint/typecheck/tests/build pass locally.
- [x] Desktop build passes locally.
- [x] Windows x64 ZIP and NSIS installer package builds complete locally; packaged entry points and the `zod` runtime dependency are present.
- [ ] Browser and end-to-end suites pass against isolated staging.
- [ ] Two-user ownership/IDOR isolation checks pass.

## Environment and secrets

- [x] Production startup validator and safe deployment preflight implemented.
- [ ] Development, staging, and production credentials/databases are separate.
- [ ] Production values configured in deployment secret manager; none are committed.
- [ ] HTTPS canonical application URLs and strong unique NextAuth secret verified.
- [ ] Durable private resume storage configured and tested.
- [ ] AI provider keys, payment mode, and webhook values verified without exposing them.
- [ ] Email is not currently implemented/configured; decide launch policy.
- [ ] Monitoring and alert destinations configured by the hosting operator.

## Database and recovery

- [ ] Production schema/migration status verified against the intended database.
- [ ] Reviewed migrations applied through `prisma migrate deploy` after backup.
- [ ] Encrypted database backup/PITR schedule and retention confirmed.
- [ ] Private file storage backup coordinated with database recovery points.
- [ ] Isolated restore drill passes; RTO/RPO and contacts filled in.
- [ ] Migration and application rollback rehearsed; no destructive reset.

## Security and product operations

- [ ] TLS, HTTP-to-HTTPS redirect, HSTS, CSP, frame protections, and trusted origins verified on deployed host.
- [ ] CORS/origin behavior verified for web, desktop, and Stripe webhook flows.
- [ ] Full registry-backed dependency vulnerability audit completed and reviewed; the current environment cannot reach npm's audit endpoint.
- [ ] Authentication, session expiration, admin separation, and rate limits verified on staging.
- [ ] AI quotas, output bounds, failure handling, and cost controls verified.
- [ ] Checkout, subscription, webhook idempotency, credit deduction/refund, and failed payment verified in payment test mode.
- [ ] Resume ownership, type/size limits, cleanup, and failure recovery verified.
- [ ] Privacy, Terms, AI usage, billing/refund, and data-deletion pages/policies reviewed and published.
- [ ] Account deletion/export and financial-data retention policy decided and implemented/documented.
- [ ] Monitoring dashboards and non-noisy alerts tested.

## Desktop

- [x] Web and desktop package metadata are set to version 1.0.0.
- [ ] Signed or otherwise approved Windows installer built and malware-scanned.
- [ ] Install, launch, connect, microphone consent, reconnect, update/manual upgrade, uninstall, and rollback verified on clean Windows.
- [ ] No API/database/payment secrets embedded in renderer or packaged assets.

The corrected local artifacts are under `desktop/dist/package/`. The older top-level setup EXE, blockmap, and 1.70 GB ZIP in `desktop/dist/` contain previous build output and must not be distributed. The generated NSIS installer is unsigned and uses Electron's default application icon; signing/approval, malware scanning, and clean-machine verification remain open release gates.

## Staging and launch

- [ ] Staging smoke tests pass for auth, sessions, AI, billing, resumes, desktop, and admin.
- [ ] Production smoke tests pass after deployment using approved test accounts and safe non-billable workflows.
- [ ] Incident contacts, rollback artifact, and maintenance communication are ready.
- [ ] Release owner explicitly approves launch after all P0/P1 items are closed.
