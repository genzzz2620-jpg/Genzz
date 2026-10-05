# Notifications

Genzz uses one in-app notification service at `lib/notifications.ts`. Feature routes submit concise events to `createNotification`; the service applies per-user category preferences, validates local action paths, rate limits creation, and uses a per-user event key to make retries idempotent. The notification center reads items and unread count together. Its bell refreshes on page focus and at most once per minute; there is no websocket or external notification infrastructure.

## Types and database

`NotificationType` identifies the event; `NotificationCategory` selects the user's preference. `Notification` stores a short title and message, optional local action URL, optional non-sensitive metadata, read time, and event key. It must not store resume text, interview answers, transcripts, tokens, or credentials. `NotificationPreference` stores category toggles. Security notifications default on and are not user-editable.

## Preferences

Users manage Interview, Preparation, Resume, Desktop, Subscription, and System categories at `/settings/notifications`. Security remains enabled. Preferences affect future creation; they do not delete existing notifications.

## Retention

On notification retrieval, the service removes non-security notifications older than 180 days and security notifications older than 730 days. User deletion cascades to notifications and preferences.

## Security, deduplication, and rate limits

Every API operation requires the authenticated session and scopes database reads, updates, and deletes to that user. Action URLs are accepted only from the application's explicit local route allowlist. Notification creation is limited to 30 attempts per user per hour in the process-local limiter. Stable event keys prevent duplicate rows across retries where available; Stripe webhook event IDs are used for billing events. The limiter is process-local and therefore not shared across multiple server instances.

## Channels and email

`IN_APP` is the implemented channel. No email provider exists in this project, so email delivery is intentionally not configured; notification records and feature events are provider-independent and can be adapted to an email channel later. If added, email must contain concise status only, never resumes, answers, transcripts, passwords, keys, or tokens.

## Current event coverage

Practice completion and feedback, resume processing success/failure, preparation plan creation/update, desktop connection/disconnection, and verified subscription/payment webhook updates create notifications. Preparation reminders, desktop expiry jobs, and account security event hooks are not present in the current application architecture and therefore do not emit speculative notifications.
