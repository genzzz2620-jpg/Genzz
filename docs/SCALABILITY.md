# Scalability and Reliability Notes

## Current architecture

- Next.js API and page handlers run as one application; Prisma accesses PostgreSQL.
- AI providers run synchronously in request handlers with provider timeouts and bounded retries.
- Desktop uses authenticated HTTP requests and NDJSON streaming; no WebSocket service is required for the current protocol.
- Resume files use private local storage and extraction is synchronous.
- Rate limits use process memory. They protect a single process but do not coordinate multiple instances.

## Safe scaling order

1. Measure application and database latency with request IDs, structured slow-query warnings, provider duration logs, and `/api/health/db`.
2. Before horizontal or serverless scaling, move rate-limit counters to a shared atomic store and resume files to private durable object storage.
3. Move resume parsing and other CPU-heavy extraction to a durable worker queue with retries, bounded concurrency, and persisted status.
4. Keep user-owned list queries paginated and add indexes only from observed query patterns. Use connection pool limits appropriate to the database and deployment platform; do not increase per-instance pools without accounting for instance count.
5. Configure database snapshots/PITR and perform a restore drill in the hosting environment. This repository cannot verify provider backup configuration.

## Failure behavior

AI provider timeouts/errors should fail the current operation with a retryable user-facing response; provider fallback is not implicit. Desktop connection polling backs off and exposes a manual retry. Streams should stop when the client disconnects, and microphone access remains an explicit user action. Health endpoints disclose only status, not environment, database, or provider details.

## Load checks

`npm run load:health -- http://localhost:3000` sends only lightweight GET requests to `/api/health` at concurrency levels 10, 25, 50, and 100. For a remote staging host, set `ALLOW_STAGING_LOAD_TEST=1` and `LOAD_TEST_TARGET_CONFIRM` to its exact host. Production-named hosts are refused. This check validates basic liveness concurrency only; it does not model authenticated workflows, database load, AI costs, or capacity.
