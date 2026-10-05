# Company & Job Intelligence Hub

## Research architecture and sources

`/company-intelligence` stores private role-preparation research in `CompanyResearch`. Users can provide a company name, role, experience, location, job description, optional owned resume, public company text, and a source title/HTTPS URL. The application does not fetch external websites or perform live web research. A supplied source is displayed as user-provided and unverified, with its domain and submission date; the UI never reports a live “checked” date. No company fact is invented to fill missing information.

## AI analysis and evidence grounding

Analysis reuses the existing OpenAI/Gemini provider abstraction, shared AI request rate limit, and AI usage records. The model extracts role requirements with evidence quotes. Server validation requires those quotes to appear in the supplied JD and resume excerpts before storing them. Resume alignment is called preparation alignment: matched areas require exact resume/JD evidence, while potential gaps are derived only from JD requirements not found in the selected resume text. This does not establish that a person lacks a skill or predict hiring.

AI company and role questions, focus areas, topic suggestions, and technology review concepts are recommendations and are labeled as AI-generated practice. Company facts remain in the user-supplied text area; they are not represented as verified public information.

## Privacy and saved research

Every read, refresh, and delete is scoped to the authenticated user. Resume ownership and processing status are checked; only a bounded excerpt is sent to the selected AI provider when the user explicitly selects a resume. Job descriptions, resume contents, and source notes are not exposed through public routes or logged. Deleting research removes its private analysis; the selected resume itself is not deleted.

## Limits and integrations

The existing subscription resolver grants up to 3 saved research records on Free and 30 on Premium. AI calls use the shared AI rate limits. Users can add recommendations to an existing Preparation Plan, save generated questions to the existing Question Bank with duplicate detection, and create a draft AI Simulator session using a server request that prefills role, company, experience, resume, and JD.

## APIs and database

- `GET/POST /api/company-intelligence`: list owned research or analyze and save new research.
- `PATCH/DELETE /api/company-intelligence/[id]`: refresh AI analysis from saved inputs or delete owned research.
- `POST /api/company-intelligence/[id]/questions`: save a question present in that owned analysis, with duplicate checks.
- `CompanyResearch` stores role inputs, optional resume relation, supplied public information/source URL, provider, validated analysis JSON, timestamps, user relation, and indexes.

Migration: `prisma/migrations/20260927080000_company_intelligence`. Deploy with the normal Prisma migration workflow. Never use `migrate reset` on this project.

## Freshness and limitations

Company website fetching, official source verification, and live source refresh are not implemented because the application has no external research provider. The “Refresh AI Analysis” action reruns recommendations over saved inputs only; it does not update company facts. JD document upload is not added because no compatible JD-specific document import flow was found.
