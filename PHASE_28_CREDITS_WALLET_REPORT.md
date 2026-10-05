# Phase 28 — Credits, Wallet & Session Billing

## Delivered

- Added an integer-unit wallet and credit ledger. One credit is represented by 100 units; monetary or credit balances are never accepted from the browser.
- Added centralized balance, add, reserve, consume, refund, free-session eligibility, session pricing, and transaction-history operations in `lib/billing/credits.ts`.
- Connected standard interview creation and simulator start to server-side free-session allocation or paid credit consumption.
- Added configurable free-session allowance, cooldown, and duration, plus paid session duration enforcement for answer APIs.
- Added authenticated wallet/history APIs, wallet views on Dashboard and `/credits`, and server-selected Starter (5), Plus (15), and Pro (40) credit packs.
- Added Stripe hosted one-time Checkout and webhook-verified, idempotent wallet grants. No card data is handled or stored by Genzz AI.
- Updated desktop session details to show the authoritative wallet balance, session cost, and free allowance.
- Added migration `prisma/migrations/20260927100000_phase28_credit_wallet/migration.sql` and environment documentation.

## Defaults

- 100 integer units per credit.
- One free practice session per UTC month, 24-hour cooldown, 30-minute duration.
- One credit per paid practice session, 60-minute duration.
- Stripe price IDs are configured with the `STRIPE_CREDIT_PACK_*_PRICE_ID` variables in `.env.example`.

## Verification and database state

- `npx prisma validate` — passed.
- `npx prisma generate` — passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run desktop:build` — passed.
- `npm run build` — passed.
- `prisma migrate status` could not connect to the configured PostgreSQL database at `localhost:5432`; the additive migration has not been applied. Once the intended database is running, apply pending migrations with `npx prisma migrate deploy`. No reset command was run.
