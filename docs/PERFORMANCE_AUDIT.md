# Phase 30 Performance Audit

## Scope and findings

Genzz AI is a Next.js 14 application using Prisma/PostgreSQL, provider-backed AI calls, local private resume storage, and an Electron desktop client using HTTP/NDJSON streams. The existing Prisma singleton is retained. Several relevant lists were already bounded or paginated; resume maker and company research now use bounded pages. Preparation-plan lookup used by recommendation flows now returns only the active plan ID rather than loading its task tree.

The main operational constraints are synchronous AI/PDF/DOCX work in web requests, per-process in-memory rate limits, and local resume files. Those choices work for a single persistent application instance but are not shared or durable across ephemeral/multiple instances. No queue or object-storage service exists in this project, so this phase does not add one. Provider calls have bounded timeouts/retries and emit structured latency/outcome logs without user prompts, answers, keys, or query text. Slow Prisma operations emit model/action/duration only.

## Changes

- Added liveness `/api/health` and database readiness `/api/health/db` (bounded timeout, safe response).
- Added request IDs for API/authenticated page responses.
- Kept rate-limit state bounded under memory pressure; AI has an additional per-user minute burst limit.
- Removed retention deletes from notification reads; retention requires an operator scheduled cleanup.
- Added bounded pagination to resume maker and company research lists and supporting indexes for observed resume/user listing patterns.
- Added a local/staging-only health load harness (`npm run load:health -- http://localhost:3000`) for 10/25/50/100 parallel liveness requests. It never calls AI or billing APIs.
- Added retry-after headers to rate-limit/provider-busy responses.

## Measurements and limitations

No staging target or production database was provided, so this audit does not claim production latency, capacity, failover, restore, or load-test results. Run the health harness against a running local instance for basic concurrency smoke measurements. It is intentionally not an application throughput benchmark. A staging run requires explicit environment opt-in and exact host confirmation. AI tests should use a mock provider; any real provider check should be a small, separately authorized staging exercise.

The in-memory limiter is per process and can reset on restart. Deployments with multiple instances need a shared atomic limiter store (for example Redis) before relying on a global quota. The auth JWT callback reads current user state from the database to preserve immediate suspension/revocation behavior; this trades some request latency for live account controls. AI usage checks also query the database.

Resume extraction runs synchronously with existing file and parser limits. For large volume, move extraction to a durable queue and private object storage, then use explicit processing states. Do not fire-and-forget work. Local filesystem storage is not suitable for ephemeral or multi-node deployments. Preserve upload size/type/parser bounds and ownership checks when changing storage.

No schema migration was applied in this phase. The additive index migration is committed as a migration file and must be reviewed/applied through the normal backup and deployment procedure. Existing query indexes were reused where available; new indexes target user creation and resume listing/status patterns.
