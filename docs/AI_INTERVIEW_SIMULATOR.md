# AI Interview Simulator

## Architecture and database

The simulator reuses `InterviewSession` and `InterviewAnswer`. Simulator settings, current question, count, skip count, topic coverage, and feedback are stored on the existing session; `simulatorQuestionNumber` uniquely identifies each submitted response and prevents duplicate submission. The migration `20260927070000_ai_interview_simulator` adds the simulator fields and index. Apply it with the normal Prisma deploy workflow; never reset the database.

## Interview flow and AI interviewer

The setup page creates an owned draft with role, optional company, experience, selected resume, job description, interview type, question count, difficulty, language, and provider. Start creates and persists an opening question. Each answer receives qualitative feedback and, where appropriate, an adaptive follow-up or next topic. The configured question cap includes skipped questions. The user ends the session explicitly to generate an overall summary. Questions are AI-generated practice and do not represent actual employer questions or a real recruiter.

AI calls reuse `getAIProvider` and the application's AI rate limiter. Output is parsed and validated with Zod before the question, feedback, or summary is stored. Resume text is only included as a bounded excerpt for a selected resume; job descriptions and answers are length-limited. The system prompt instructs the model not to invent candidate experience.

## Speech, feedback, and integrations

Text answers are always available. Optional browser SpeechRecognition starts only after the user presses the voice control; the listening state is visible, the user can pause, and the transcript remains editable before submission. Browser speech-recognition privacy and processing are governed by that browser's speech service. Genzz stores the submitted transcript as the answer, not raw audio.

Per-answer feedback and end-of-interview feedback are saved with the existing answer/session. Users can save generated questions through the existing Question Bank model with duplicate checks, and can explicitly add recommended tasks to an existing Preparation Plan. Simulators are visible in existing interview history because they are existing InterviewSession rows.

## Privacy and access

Every simulator route checks the signed-in user and scopes session reads/writes to that user. Resume ownership is checked at creation. Session details, answers, transcripts, and job descriptions are returned only through authenticated routes. AI prompts and error logs do not include whole resume files beyond bounded prompt context, and answer text is not logged by application code.

## Subscription limits and APIs

`lib/billing/feature-access.ts` centralizes simulator daily session limits: two for Free and ten for Premium, with plan status resolved through the current billing service. AI generation also uses the shared request rate limit.

- `GET/POST /api/simulator`: list the caller's history or create a simulator draft.
- `GET /api/simulator/[id]`: retrieve owned simulator state for refresh/reconnect.
- `POST /api/simulator/[id]/start`: create and persist the opening question.
- `POST /api/simulator/[id]/answer`: evaluate and save one answer, then advance.
- `POST /api/simulator/[id]/skip`: record a skip and advance.
- `PATCH /api/simulator/[id]/timer`: pause or resume elapsed-time tracking, persisted with simulator state.
- `POST /api/simulator/[id]/end`: generate and persist final feedback.
- `POST /api/simulator/[id]/save-question`: save an owned session question to the existing bank.

## Known limitations

SpeechRecognition availability and service-side processing depend on the browser; unsupported browsers can type answers. Timer is elapsed-time guidance and does not terminate the interview. No automated test runner or E2E suite is configured in this repository.
