# Desktop Session and Credits

## Wallet representation

The wallet stores integer units. One displayed credit is 100 units, so a half-credit is 50 units. Balances, reservations, ledger entries, and session charges never use floating-point arithmetic. Formatting converts integer units to a decimal string only for display.

`CreditAccount` is the current balance and reserved balance. `CreditTransaction` is the idempotent activity ledger. `CreditReservation` tracks hold, consume, and refund states. Stripe hosted Checkout handles purchases; Genzz stores the Stripe Checkout ID and server-selected pack, never card details.

## Session billing

New web interview sessions and simulator sessions are billed server-side when practice starts. The server checks the free-session allowance first, then reserves and consumes the configured paid session cost when no free session is available. The current defaults are one free practice session per month, a 24-hour cooldown, a 30-minute free duration, a 60-minute paid duration, and one credit per paid session. Environment settings can change these values.

Credit reservation and consumption are idempotent and use serializable database transactions. The initial simulator question is generated after session billing; if it fails, billing is refunded and the draft session can be retried. Session duration is enforced by the desktop and web answer APIs. Ending a session does not refund a consumed session charge.

## Hosted credit packs

Credit packs are server-defined: Starter (5 credits), Plus (15 credits), and Pro (40 credits). Set their Stripe Price IDs in `STRIPE_CREDIT_PACK_STARTER_PRICE_ID`, `STRIPE_CREDIT_PACK_PLUS_PRICE_ID`, and `STRIPE_CREDIT_PACK_PRO_PRICE_ID`. The browser submits only a pack identifier. Stripe webhooks verify paid Checkout Sessions and grant credits once, keyed to the internal checkout record and webhook event. Stripe secret and webhook signing values stay server-side.

The authenticated `/api/credits` endpoint supplies the authoritative wallet, session allowance, and activity history. `/credits` displays the wallet and starts hosted checkout. Desktop reads the same wallet through its authenticated session API; its purchase action opens the Genzz AI web dashboard.

## Migration

The additive schema migration is `prisma/migrations/20260927100000_phase28_credit_wallet/migration.sql`. It was not applied because the configured local PostgreSQL server at `localhost:5432` was unavailable during this run. Apply pending migrations with `npx prisma migrate deploy` once the intended database is running. Do not use `prisma migrate reset`.
