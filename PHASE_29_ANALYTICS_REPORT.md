# Phase 29 — Analytics implementation report

Implemented `/analytics` as an authenticated, filterable practice dashboard with summary metrics, an accessible activity chart, category drill-down, question/answer and saved feedback history, preparation progress, streaks, recent activity, session comparisons, question-bank save actions and CSV export. The dashboard links to analytics.

Added authenticated, user-scoped overview and question-history endpoints. Aggregations reuse interview, answer, preparation, wallet, resume, and question-bank records. Overview does not read answer transcripts. Credit use is represented as integer hundredths and formatted at the display boundary.

Added nullable `startedAt`, `completedAt`, and `durationSeconds` session data with a migration. New paid/free billing activation and simulator, web and desktop completion paths record these values. Historical session duration is not fabricated when source timestamps are absent.

`docs/ANALYTICS.md` documents data sources, privacy boundaries, filters, duration limitations, credit units, and migration operations. Focused metrics tests are included in `tests/analytics.test.ts`.

## Verification

Verified: `npx prisma generate`, `npm run lint`, `npm run typecheck`, `npm test` (5 passing), `npm run build`, and `npm run desktop:build` all completed successfully. The repository has no configured E2E/browser test script or browser test suite. The Phase 29 migration was not applied because database migrations are an operational deployment step; apply it with `prisma migrate deploy`. Do not use `prisma migrate reset`.
