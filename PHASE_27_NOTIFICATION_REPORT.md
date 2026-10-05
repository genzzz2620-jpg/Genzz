# Phase 27 — Notifications & Communication System

## Features

- Added the authenticated notification center at `/notifications`, unread count, mark-read/all-read, delete, and local action links.
- Added responsive notification bell in the application header and Notifications in the sidebar; dashboard shows the five most recent items.
- Added category preferences at `/settings/notifications`; Security is mandatory and cannot be switched off through the API.
- Integrated practice completion/feedback, resume processing, preparation plan changes, desktop connect/disconnect, and confirmed billing webhook events.
- Implemented the in-app channel. No email vendor was installed, so email remains a future provider integration.

## Database and APIs

- Added `NotificationType`, `NotificationCategory`, `Notification`, and `NotificationPreference` to Prisma with ownership relations, indexes, and per-user idempotency key.
- Added migration `20260927090000_phase27_notifications`.
- Added `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`, `DELETE /api/notifications/:id`, and `GET/PATCH /api/settings/notifications`.
- Every endpoint obtains the user from NextAuth and scopes record operations to that user.

## Security and operations

- Messages avoid interview answers, resume contents, and transcripts. Action URLs use a local route allowlist.
- Notification creation is centralized, preference-aware, idempotent where events provide stable IDs, and rate limited.
- Reads clean up notifications after 180 days, or 730 days for security category records.
- Refresh uses focus plus a 60-second interval; no websocket or email provider is introduced.

## Tests and verification

- Prisma Client generation: passed (`npx prisma generate`); schema validation passed.
- Lint and typecheck: passed.
- Production build: passed.
- `npm test`: unavailable because `package.json` does not define a `test` script. No test files or E2E suite exist in the repository.
- `npx prisma migrate deploy`: not applied; Prisma's schema engine could not connect/apply to the configured local PostgreSQL instance at `localhost:5432`.

## Remaining issues

- Security event hooks are not wired because no password/security settings mutation event was found.
- Preparation reminders and desktop expiration events need a scheduler/job system before they can be delivered reliably.
- The notification creation limiter is process-local and should move to shared storage if deployment uses multiple instances.
- The database migration must be applied in an environment with the configured PostgreSQL database available before using notification APIs.
