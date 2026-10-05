# Phase 28 — Desktop Credits & Session UI Report

## UI changes

- Added a centered, responsive “Real Practice Session” dialog over the connected Windows desktop workspace, with Genzz AI branding and the existing desktop visual theme.
- Shows the authenticated session's role, company, experience, and subscription plan; added close/back/dashboard navigation, focus handling, Escape support, and session options entry.
- Added free/included practice and credit-session cards. The free action confirms the current session on the backend. Credit availability is explicitly shown as not configured.
- Added a dashboard Practice Credits entry that truthfully describes the current availability and links to practice and subscription management.
- Updated the browser desktop page to identify itself as an Interactive Demo, show credit availability status, and avoid requesting microphone permission or initiating credit/payment actions.
- Added System theme following OS light/dark preference.

## Backend, database, and billing

- Added authenticated `POST /api/desktop/activate`. It validates the existing desktop bearer connection and active session ownership before confirming activation; repeated requests are safe.
- Extended `GET /api/desktop/session` with a non-secret access capability response. Credit feature is disabled, balance is null, and purchase availability is false.
- No database changes were needed. Existing practice uses `InterviewSession` and `DesktopConnection`.
- Existing hosted checkout handles subscriptions only. No credit purchase is offered or misrepresented as subscription checkout; no fake transactions, balances, prices, deductions, or refunds were added.
- No credit ledger exists, so transaction history/deduction/refund are not applicable yet.

## Security and remaining issues

- Activation derives user ownership from the authenticated desktop connection. The client cannot pass user ID, price, credits, duration, or eligibility.
- The connected practice session is already created in the web app before the desktop's one-time code is issued. Activation verifies that existing session rather than creating another session.
- The app does not define a free-session minute quota or independent duration; no minute count is shown. The desktop connection token expires according to its existing server policy and is not presented as session duration.
- Credit balance, pricing, purchase checkout, credit ledger, refunds, and real credit history remain unavailable until a credit product is implemented.

## Tests and build status

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run desktop:build`: passed (TypeScript compile and renderer asset copy).
- `npm test`: unavailable because the root package has no test script. The desktop package has no test script either; no automated test suite was found.
- No database migration was required. No destructive database command was run.
