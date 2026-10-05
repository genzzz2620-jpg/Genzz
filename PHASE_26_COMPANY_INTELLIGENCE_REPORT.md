# Phase 26 — Company & Job Intelligence Report

## Implemented

- `/company-intelligence` setup for custom or known company names, role, experience, location, pasted JD, owned resume, and optional user-supplied public text/source URL.
- Evidence-backed JD extraction, resume preparation alignment, potential review areas, technology topics, topic map, practice focus, and AI-generated role/company questions.
- Saved research list, AI reanalysis, ownership-scoped deletion, two-record preparation comparison, and dashboard card.
- Preparation Planner task creation, Question Bank save with duplicate checks, and company/role/resume/JD-prefilled AI Simulator draft through a POST request.
- Company source presentation distinguishes user-provided, unverified text from AI practice recommendations. No fabricated web sources, live checked date, or unsupported company facts are presented.

## APIs, database, AI, and security

- Added `CompanyResearch` and SQL migration `prisma/migrations/20260927080000_company_intelligence`.
- Added `GET/POST /api/company-intelligence`, `PATCH/DELETE /api/company-intelligence/[id]`, and owned-question save endpoint.
- Reuses existing AI providers, shared AI rate limit, and AI usage records. Zod validates model output; JD/resume evidence is checked against supplied input before persistence.
- User authentication, record ownership, resume ownership, HTTPS source URL validation, length validation, saved-research subscription limits, and Question Bank duplicate checks are enforced server-side.

## Source handling and remaining limits

- The app has no existing web research connector. It does not fetch company sites; the user may supply source text and an HTTPS URL, clearly labeled unverified. “Refresh AI Analysis” reruns AI against saved inputs and is not a live source refresh.
- JD file upload, external source verification, source crawling, question-bank direct filtered-state integration, and automatic public company facts are not implemented.
- `npx prisma validate` and `npx prisma generate`: passed.
- `npm run typecheck`, `npm run lint`, and `npm run build`: passed.
- `npm test`: unavailable because no test script is configured; no E2E suite was found.
- Migration SQL is ready but was not deployed to the configured database.
