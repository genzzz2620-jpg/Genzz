# Production Database Operations

## Current release status

Production database hosting, backup schedule, database credentials, and migration state are not available in this repository/session. PostgreSQL at the local development address was unreachable during Phase 31. No production backup or restore has been verified. Do not treat this document as evidence that a backup exists.

## Before release

- Create separate development, staging, and production PostgreSQL databases and credentials. Never point staging at production.
- Use a least-privilege runtime role, private networking, TLS, and host-managed secret storage.
- Confirm scheduled encrypted backups or point-in-time recovery (PITR) with the database operator. Record the service, schedule, retention, owner, and restore contact in the deployment record.
- Take and verify a recoverable backup before applying migrations.
- Run `npx prisma validate` and `npx prisma migrate status` against the intended environment. Inspect migration history and SQL. `migrate status` requires a reachable database.
- Apply only reviewed versioned migrations with `npx prisma migrate deploy`. Never run `prisma migrate reset` in a retained-data environment.

## Migration order and rollback

1. Back up the database and confirm restore access.
2. Review migration SQL and confirm it is additive/backward compatible with the currently deployed app where practical.
3. Apply migrations to staging, then run schema and application smoke checks.
4. Apply to production through a controlled release job before deploying code that requires the new schema.
5. For application rollback, prefer rolling back application code while retaining compatible additive schema. Do not blindly reverse schema changes or drop data. If a migration is destructive or incompatible, stop and use a reviewed forward-fix or restore plan.

The Phase 30 migration `20260927120000_phase30_reliability` adds indexes. Its production application status is unverified. Inspect actual `_prisma_migrations` history before applying it.

## Backup and restore runbook

The hosting provider is unspecified, so use the provider's documented snapshot/PITR tooling rather than assuming a particular command or configuration. Before launch, fill in:

- Database operator / emergency contact: **[OWNER TO COMPLETE]**
- Backup/PITR service and schedule: **[HOSTING OPERATOR TO COMPLETE]**
- Retention period and encryption location: **[HOSTING OPERATOR TO COMPLETE]**
- Recovery Time Objective (RTO): **[SET AND APPROVE]**
- Recovery Point Objective (RPO): **[SET AND APPROVE]**
- Restore environment and access procedure: **[HOSTING OPERATOR TO COMPLETE]**

Restore only into an isolated recovery/staging database. Confirm migration state, representative user/session/billing records, foreign-key relations, and application health before any production cutover. Keep the original database untouched until the incident owner approves a recovery decision. Record the restore point, operator, checks, and outcome. Do not use live production as a restore-test target.

## Emergency recovery

1. Incident lead declares database incident and pauses risky write/deployment operations.
2. Notify the database operator and select the newest known-good recovery point within the approved RPO.
3. Restore to an isolated database and validate schema/application compatibility.
4. Route staging or a controlled canary to the recovered database and verify health and critical read/write workflows.
5. Cut over only with incident-lead approval; preserve the failed database and logs for investigation.
6. Reconcile writes made after the selected recovery point using an approved procedure. Never silently discard financial or user records.

No database migration or reset was performed as part of Phase 32 preparation.
