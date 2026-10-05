# Disaster Recovery Plan

## Readiness status

This is an operational template, not proof of recoverability. No production host, backup service, durable resume volume, monitoring service, or emergency contact is configured in this repository. The owner must complete and test the placeholders before launch.

## Objectives and ownership

- Service owner / incident lead: **[OWNER AND CONTACT TO COMPLETE]**
- Database operator: **[OWNER AND CONTACT TO COMPLETE]**
- Hosting / storage operator: **[OWNER AND CONTACT TO COMPLETE]**
- Target RTO: **[APPROVE BEFORE LAUNCH]**
- Target RPO: **[APPROVE BEFORE LAUNCH]**
- Escalation channel and provider status links: **[COMPLETE]**

Do not publish this document with real personal contact details in a public repository.

## Recovery assets

Maintain independently protected copies of:

- PostgreSQL backups/PITR metadata and migration history.
- Private resume storage, with database/file backup points coordinated where possible.
- Deployment configuration templates and secret-manager recovery access (never store secret values in this repository).
- Reviewed application release artifacts and desktop installer artifacts.
- DNS/TLS renewal and hosting account recovery instructions.

The current app stores resumes on a local filesystem unless an operator provides durable storage. Backing up PostgreSQL alone does not recover uploaded files.

## Incident procedure

1. Incident lead records impact, start time, affected systems, and a safe status message; avoid sharing user content or secrets.
2. Stop deployments and disable impacted integrations using hosting/provider controls. Do not make destructive data changes while the incident is being assessed.
3. Determine the failure domain: application, database, AI provider, payment provider, storage, DNS/TLS, or desktop distribution.
4. Restore service configuration from the deployment secret manager and redeploy the last known-good signed/reviewed artifact.
5. For database recovery follow [DATABASE_PRODUCTION.md](DATABASE_PRODUCTION.md), restoring to an isolated environment before cutover.
6. For file-storage failure, restore a private backup with original ownership mapping and verify authenticated downloads before reopening uploads.
7. Run smoke tests on login, owned session history, resume access, credits/billing status, and desktop connection. Keep AI/payment actions disabled until their provider status is confirmed.
8. Cut over only with incident-lead approval. Monitor errors and reconciliation queues/manual work; notify affected users as required by the operator's policy and applicable law.
9. Record timeline, data loss window, recovery point, validation evidence, and follow-up actions.

## Verification and drills

Before launch, perform a restore drill in isolated staging. Repeat at an owner-approved interval and after material storage/database changes. Verify recovery objectives are met, account ownership remains intact, resume paths remain private, migrations match the restored schema, and billing records are not duplicated. Record date, participants, measured RTO/RPO, issues, and approval: **[DRILL RECORD TO COMPLETE]**.

## Rollback boundaries

Application rollback is usually safer than schema rollback. Confirm schema compatibility first; preserve additive migrations and use a forward fix or isolated restore for incompatible data changes. Desktop rollback uses the previously approved installer and user-facing manual reinstall process. Never force-push/rewrite release history or reset a production database as an incident response.
