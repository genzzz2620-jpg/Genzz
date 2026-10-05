# Genzz AI Desktop Practice Workspace

The Windows desktop app connects to an active Genzz AI practice session using a short-lived, one-time code created from the web session page. The desktop connection is scoped to the signed-in user's active session and can be revoked by disconnecting or ending practice.

## Workspace actions

- Review the session role, company, experience level, selected resume, and answer preferences.
- Enter a question manually or explicitly allow microphone access to transcribe a question. Listening stops when the speech recognition provider ends; the app does not restart it without another user action.
- Review, copy, edit, save, regenerate, or clear the visible practice answer. Clearing removes it from the current view; saved history remains available.
- End practice to complete the session and request structured AI feedback based on saved answers. Feedback generation can fail independently without preventing session completion.

The workspace is for AI-generated practice. It does not represent an employer interview or promise that questions match a company's actual interview.

## Connection API

- `POST /api/desktop/code` issues a short-lived one-time code for an owned active session.
- `GET /api/desktop/code?sessionId=...` lets the web page check whether that code has connected or expired.
- `POST /api/desktop/connect` exchanges the one-time code for a scoped desktop bearer token.
- `GET /api/desktop/session` loads session and profile details for the connected desktop app.
- `POST /api/desktop/end` completes the connected session, revokes its desktop credential, and stores generated feedback when available.

Session feedback reuses the existing session field. Wallet balances, reservations, purchases, and ledger history use the Phase 28 additive migration in `prisma/migrations/20260927100000_phase28_credit_wallet/`. The migration must be applied to the configured database before deploying the wallet-enabled application.
