# Interview analytics

`/analytics` summarizes the signed-in user's practice sessions, answers, saved AI feedback, preparation tasks, wallet use and question bank activity. It is a personal practice history; it does not predict an employer's interview or claim questions are guaranteed to appear.

## Data and privacy

- `/api/analytics/overview` and `/api/analytics/questions` require an authenticated session, apply the authenticated user id in every session query, and return private no-store responses.
- Answer text is returned only by the question history endpoint, after its owning session is scoped to the authenticated user. Overview aggregation selects feedback JSON without selecting answer transcripts.
- Analytics are aggregated from existing `InterviewSession`, `InterviewAnswer`, `PreparationPlan`/`PreparationTask`, `CreditTransaction`, `Resume`, and `QuestionBankItem` records.
- `InterviewSession.startedAt`, `completedAt`, and `durationSeconds` provide reliable duration for sessions created after this change. The total practice-time metric sums stored durations and the elapsed time of active sessions; older records without those values are not assigned guessed time. Where a completed simulator row exposes both simulator start/end timestamps, its session-history row can derive a duration.
- Practice streaks use session start dates. Session filters apply to session history and related questions; preparation metrics use active plans matching the selected role/company/experience.
- Feedback summaries are computed from the latest 500 records in the selected range to bound response work. Counts, category totals, and session totals come from database aggregates. A visible sample limit is included in the response for transparency.
- Historical credit use is reported in integer hundredths of a credit, matching the wallet's 100-units-per-credit representation. Formatting to decimal credits occurs only at the presentation boundary.

## Filters and export

Supported filters are 7, 30, 90 days, all time, a custom date range (maximum 366 days), role, company, experience and a session id. The overview supports `format=csv`; export contains summary metrics and question-category counts, not answer transcripts.

## Schema update

The Phase 29 migration adds nullable session timestamps/duration and indexes for user/date and user/filter lookups. Apply it through the normal deployment migration workflow with `prisma migrate deploy`. Do not reset production or development data to apply this change.
