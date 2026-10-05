# Preparation Planner

## Architecture

The `/preparation` page reads the signed-in user's active plan and tasks from Prisma. `PreparationClient` provides plan creation, task status controls, manual task entry, list and timeline views, and progress calculated from persisted `COMPLETED` tasks. The dashboard links to the active plan.

## Generation and AI context

`POST /api/preparation` validates target role, company, experience, duration, job description, resume ownership, and provider. It reuses `getAIProvider` and `enforceAIRateLimit`. Context is limited to a resume excerpt, recent session role/status, a small sample of feedback JSON, and role-matched question-bank content. The output is parsed and validated with Zod before persistence. Recommendations are not guarantees; company-associated practice does not claim to contain real company questions.

## Database

`PreparationPlan` belongs to a user and stores the target, overview, focus areas, topic lists, and duration. `PreparationTask` belongs to both the owning user and plan and can link to a question or interview session. Deleting related questions or sessions nulls the link; deleting a user or plan cascades. Apply `prisma/migrations/20260927060000_preparation_planner/migration.sql` with the normal deployment migration workflow, then regenerate Prisma Client.

## APIs

- `GET /api/preparation`: only the caller's active plans.
- `POST /api/preparation`: validate inputs, enforce free-plan active-plan limits and AI request limits, generate and validate a plan.
- `POST /api/preparation` with `regeneratePlanId`: regenerate an owned plan; completed tasks are preserved while other task recommendations are replaced.
- `PATCH` and `DELETE /api/preparation/[id]`: update or delete only caller-owned plans.
- `POST /api/preparation/tasks`: add a validated manual task to a caller-owned active plan.
- `PATCH /api/preparation/tasks`: update task status only when the caller owns the task.

All identity comes from NextAuth; client-supplied user IDs are ignored. Resume and plan ownership are checked server-side. APIs do not return resume contents.

## Privacy, subscriptions, and integrations

Resume text is sent only as a bounded excerpt when the user selects that resume for generation. Session feedback content is bounded and not logged. AI calls share current provider and rate-limit infrastructure. Free accounts may have one active plan; premium entitlement uses the existing subscription service. Question-bank and session actions link to the existing experiences. External calendar and notification services are not used.

## Limitations

Feedback is currently sampled from existing answer analysis JSON where available; no separate feedback model exists. Question-bank browsing and session creation reuse existing workflows; direct save-question-to-plan and session-prefilled creation controls remain follow-up work.

