# Security

## Supported practices

- Passwords are stored as bcrypt hashes (cost 12); plaintext passwords are not persisted or logged. New passwords must be 10-72 characters and at most 72 UTF-8 bytes. Login attempts and account creation are throttled per observed client address.
- Web sessions use signed JWT cookies with an eight-hour lifetime; NextAuth may refresh the cookie during active use. Cookies are HttpOnly, SameSite=Lax, and Secure in production. NextAuth supplies CSRF handling for its own routes. Middleware checks the Origin of state-changing browser API requests against the configured canonical origin; cross-origin API access is not enabled.
- Admin pages check the current database role, and admin mutation APIs perform their own authenticated role check. Sensitive admin writes create audit records.
- User-owned resumes, interview sessions, answers, resume-maker documents, and desktop connections are queried through ownership-scoped predicates. Resume files are stored outside `public/` under UUID names and downloaded through an authenticated ownership-checked endpoint.
- Resume uploads are limited to 10 MiB and checked against file signatures and expected MIME/extension. DOCX archives are checked for path traversal, entry count, expanded size, and compression ratio; PDF page count and extracted text length are bounded.
- AI provider keys and payment credentials are read by server code only. AI prompts mark resume, job-description, and candidate-provided instructions as untrusted; the prompt instructs models not to invent candidate history. The app sends selected resume excerpts for interview answers and may send the full extracted resume for explicit resume-import/optimization actions.
- Desktop uses a sandboxed renderer with context isolation, no Node integration, a narrow preload bridge, validated IPC payloads, navigation restrictions, user-consented microphone access, one-time connection codes, hashed short-lived desktop tokens, and server-side token revocation.
- Stripe webhooks verify the signature and timestamp against the raw body. Subscription records are updated from verified provider events; user APIs cannot set plan or payment status.
- Production web responses set CSP, frame, MIME-sniffing, referrer, permissions, and HSTS headers. Desktop content has a separate CSP.

## Secret management

Keep `.env` and all `.env.*` files out of source control. `.env.example` contains placeholders only. Store production credentials in the deployment platform's secret manager, use separate credentials per environment, rotate credentials after suspected exposure, and never put server secrets in `NEXT_PUBLIC_*`, desktop renderer assets, logs, or support reports. `NEXTAUTH_SECRET`, `DATABASE_URL`, AI keys, and Stripe secrets must be strong and private.

## Deployment checklist

See [the production deployment guide](docs/production-deployment.md) for environment-specific setup and the production preflight command.

- Serve the web app only over HTTPS, configure `NEXTAUTH_URL` to the canonical HTTPS origin, and terminate TLS only at a trusted proxy. The proxy must overwrite client-supplied forwarding headers before the app uses them for throttling.
- Use a least-privilege PostgreSQL account, private network access, TLS where available, encrypted storage, and regular access review. Restrict resume storage to the app service account and keep it outside static/public hosting.
- Configure a shared, durable rate-limit store before running multiple instances. The current limiter is process-local and is only a per-instance safeguard.
- Back up PostgreSQL and private resume storage on a schedule appropriate to the service's recovery objectives. Encrypt backups, restrict access, test restores, and coordinate schema changes with backup availability.
- Apply additive Prisma migrations through the deployment pipeline after a backup. Review generated SQL before production; never use `prisma migrate reset` against retained data.
- Monitor authentication failures, rate-limit events, provider failures, webhook failures, storage capacity, database health, and unusual admin actions without recording passwords, tokens, prompts, resume content, or audio.
- Keep dependencies patched, review advisories, use lockfiles, and rebuild the desktop package from reviewed source.

## Backups and restore

Use PostgreSQL's supported logical or managed backups, encrypted at rest and in transit. Keep private resume files in a separately backed-up restricted location and retain the database/file backup pair consistently. Restore into an isolated environment first, verify schema migrations and representative records, then perform a controlled production recovery. Do not test restore procedures against the live database. The application does not currently automate backups or restore validation.

## Reporting a security issue

Report suspected vulnerabilities privately to the project maintainers through an approved private security contact or private repository channel. Include affected versions, reproduction steps, and impact; omit real credentials and personal data. Do not publish exploit details before maintainers have had a reasonable opportunity to investigate and coordinate a fix.

## Findings and known limitations

- **Medium:** Rate limiting currently uses in-memory per-process counters. It does not coordinate across server instances, and address-based protection depends on a correctly configured trusted proxy.
- **Medium:** JWT logout clears the browser cookie but there is no server-side session registry for immediate revocation of a copied web JWT. Web JWT validity is capped at eight hours; suspension and role checks query current database state on protected server paths.
- **Medium:** Account deletion and a user-facing full data export are not implemented. Users can delete resumes and interview history through existing controls, but AI usage records and billing/audit records have no user-configurable retention schedule.
- **Medium:** Stripe webhook state writes are upsert-based and safe to repeat for the same state, but event IDs are not kept in a dedicated deduplication ledger; stale out-of-order provider events need operational monitoring.
- **Informational:** CSP permits inline scripts for the current Next.js rendering model, so it reduces some injection paths but is not a strict nonce-based policy. User text is rendered as text by React; the desktop's `innerHTML` templates contain fixed application markup only.
- **Informational:** Password reset is not implemented. Microphone transcription uses the browser/Electron speech-recognition service; audio is not intentionally recorded by this app, while transcript text is stored with interview answers.

No claim is made that the application is completely secure. Security checks in this phase are limited to source review and the build/audit commands reported with the phase; live database-dependent isolation, deployment, and provider tests require a configured environment.
