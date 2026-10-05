# API QA Inventory

Static inventory of all API route files. Authentication/ownership classifications are based on source inspection; live allow/deny behavior requires an available database and authenticated test accounts. Each route must preserve its listed gate and validate resource ownership at query time.

Route files found: 64

| Path | Source-level access gate |
|---|---|
| `/api/admin/questions/[id]` | requireAdminApi; active admin check and rate limit |
| `/api/admin/questions` | requireAdminApi; active admin check and rate limit |
| `/api/admin/users/[id]` | requireAdminApi; active admin check and rate limit |
| `/api/analytics/overview` | NextAuth session; user-scoped access expected |
| `/api/analytics/questions/[answerId]/save` | NextAuth session; user-scoped access expected |
| `/api/analytics/questions` | NextAuth session; user-scoped access expected |
| `/api/auth/[...nextauth]` | NextAuth provider/callback controls |
| `/api/company-intelligence/[id]/questions` | NextAuth session; user-scoped access expected |
| `/api/company-intelligence/[id]` | NextAuth session; user-scoped access expected |
| `/api/company-intelligence` | NextAuth session; user-scoped access expected |
| `/api/credits/checkout` | NextAuth session; user-scoped access expected |
| `/api/credits` | NextAuth session; user-scoped access expected |
| `/api/desktop/activate` | Short-lived desktop bearer token; route-level session ownership |
| `/api/desktop/code` | NextAuth web session; rate-limited and active session ownership |
| `/api/desktop/connect` | Single-use connection code exchange; rate limited |
| `/api/desktop/detect` | Short-lived desktop bearer token; route-level session ownership |
| `/api/desktop/disconnect` | Short-lived desktop bearer token; route-level session ownership |
| `/api/desktop/end` | Short-lived desktop bearer token; route-level session ownership |
| `/api/desktop/question` | Short-lived desktop bearer token; route-level session ownership |
| `/api/desktop/session` | Short-lived desktop bearer token; route-level session ownership |
| `/api/desktop/stream` | Short-lived desktop bearer token; route-level session ownership |
| `/api/desktop/version` | Short-lived desktop bearer token; route-level session ownership |
| `/api/health/db` | Public database readiness; no details returned |
| `/api/health` | Public liveness |
| `/api/history/[sessionId]` | NextAuth session; user-scoped access expected |
| `/api/history/answers/[answerId]` | NextAuth session; user-scoped access expected |
| `/api/history` | NextAuth session; user-scoped access expected |
| `/api/interviews/[id]/answers/[answerId]/versions` | NextAuth session; user-scoped access expected |
| `/api/interviews/[id]/answers` | NextAuth session; user-scoped access expected |
| `/api/interviews/[id]` | NextAuth session; user-scoped access expected |
| `/api/interviews` | NextAuth session; user-scoped access expected |
| `/api/notifications/[id]/read` | NextAuth session; user-scoped access expected |
| `/api/notifications/read-all` | NextAuth session; user-scoped access expected |
| `/api/notifications` | NextAuth session; user-scoped access expected |
| `/api/onboarding` | NextAuth session; user-scoped access expected |
| `/api/preparation/[id]` | NextAuth session; user-scoped access expected |
| `/api/preparation` | NextAuth session; user-scoped access expected |
| `/api/preparation/tasks` | NextAuth session; user-scoped access expected |
| `/api/question-bank/[id]/favorite` | NextAuth session; user-scoped access expected |
| `/api/question-bank/[id]/practice` | NextAuth session; user-scoped access expected |
| `/api/question-bank/[id]` | NextAuth session; user-scoped access expected |
| `/api/question-bank/generate` | NextAuth session; user-scoped access expected |
| `/api/question-bank` | NextAuth session; user-scoped access expected |
| `/api/register` | Public registration; IP rate limit and validation |
| `/api/resume-maker/[id]` | NextAuth session; user-scoped access expected |
| `/api/resume-maker/ai` | NextAuth session; user-scoped access expected |
| `/api/resume-maker/import` | NextAuth session; user-scoped access expected |
| `/api/resume-maker` | NextAuth session; user-scoped access expected |
| `/api/resumes/[id]/process` | NextAuth session; user-scoped access expected |
| `/api/resumes/[id]` | NextAuth session; user-scoped access expected |
| `/api/resumes` | NextAuth session; user-scoped access expected |
| `/api/settings/notifications` | NextAuth session; user-scoped access expected |
| `/api/simulator/[id]/answer` | NextAuth session; user-scoped access expected |
| `/api/simulator/[id]/end` | NextAuth session; user-scoped access expected |
| `/api/simulator/[id]` | NextAuth session; user-scoped access expected |
| `/api/simulator/[id]/save-question` | NextAuth session; user-scoped access expected |
| `/api/simulator/[id]/skip` | NextAuth session; user-scoped access expected |
| `/api/simulator/[id]/start` | NextAuth session; user-scoped access expected |
| `/api/simulator/[id]/timer` | NextAuth session; user-scoped access expected |
| `/api/simulator` | NextAuth session; user-scoped access expected |
| `/api/subscription/checkout` | NextAuth session; user-scoped access expected |
| `/api/subscription/portal` | NextAuth session; user-scoped access expected |
| `/api/subscription` | NextAuth session; user-scoped access expected |
| `/api/webhooks/stripe` | Stripe signature verification on raw request |
