# Phase 32B — Database Stability Report

**Investigation date:** 2026-09-28 (UTC)  
**Scope:** Local development database and app only. No production target was used. No Docker restart, volume removal, schema change, migration, or database reset was performed during this investigation. One controlled browser registration/login journey created one local QA user as explicitly requested by the reproduction step.

## Findings

| Check | Status | Evidence |
|---|---|---|
| Docker | **PASS** | `docker ps` showed `genz-postgres`, image `postgres:16-alpine`, running and healthy, mapped only to `127.0.0.1:5432`. |
| PostgreSQL container | **INTERMITTENT** | Current state is running/healthy with **restart count 0**. The container had been up about 49 minutes at inspection. Bounded logs contained initialization-time temporary-server shutdown/readiness messages around `2026-09-28 12:24:19 UTC`; no later connection-refused/reset, authentication, pool-exhaustion, OOM, crash, or health-check failure messages were found. These startup messages do not indicate a container restart. |
| Port 5432 | **PASS** | `Test-NetConnection localhost -Port 5432` succeeded twice, at `2026-09-28 13:14:10 UTC` and `13:14:18 UTC`; both resolved to `127.0.0.1`. |
| Prisma | **PASS** | `npx prisma validate` passed. A read-only Prisma `db execute` with `SELECT 1` also succeeded. No migration command was run during this investigation. |
| Registration | **PASS** | The single controlled local E2E reproduction returned HTTP 201 for registration. |
| Login | **PASS** | In the same controlled run, the credentials callback and session returned HTTP 200, and the flow reached the dashboard. The test passed in 21.8 seconds. |
| Database stability | **INTERMITTENT** | A prior browser run logged a Prisma user lookup failure saying it could not reach `localhost:5432`; current Docker, port, Prisma, and registration/login checks pass. The exact timestamp of that earlier failure was not captured in the terminal output. |

## Prisma and connection-pool review

- `lib/prisma.ts` exports one `PrismaClient` instance and stores it on `globalThis` outside production to avoid duplicate clients during development hot reload.
- Repository search found no second application `new PrismaClient(...)` initialization outside generated client code.
- The client config sets error/warn logging and slow-query middleware; it does not set explicit connection-pool or timeout options.
- The local `DATABASE_URL` targets `localhost:5432` and has only the `schema` query parameter; no explicit pool/timeout parameter is configured. Credentials were not read into the report.
- No evidence of pool exhaustion was found. The earlier server log included a `User.findUnique` failure with “Can't reach database server at `localhost:5432`.” Subsequent successful auth and several slow-query entries near two seconds do not establish pool exhaustion or its cause.

## Application log correlation

- During the earlier failed browser attempt, the app logged a Prisma user lookup failure with the message `Can't reach database server at localhost:5432`. The available terminal output did not include a timestamp or enough request correlation to prove whether the failed lookup was registration preflight or the immediately following credentials login.
- In the controlled reproduction at approximately `2026-09-28 13:16 UTC`, app logs show `POST /api/register 201`, `POST /api/auth/callback/credentials 200`, `GET /api/auth/session 200`, and dashboard responses. No database query failure appeared in that run.
- PostgreSQL’s bounded log window did not show a corresponding server restart or database-side rejection. Docker restart count remained zero.

## Root-cause classification

**C — Application-side database connectivity was temporarily unavailable; underlying trigger remains unknown.** The earlier Prisma error is evidence of a failed client-to-database connection. The current evidence does not show that PostgreSQL restarted, that it refused a particular connection, that Docker networking failed, that Prisma exhausted its pool, or that authentication logic itself produced the database error. No source-code defect is established.

## Recommended next action

Keep the current container running and repeat the database health check if the failure recurs. If it does, capture timestamped application logs alongside Docker state and PostgreSQL logs before changing infrastructure. Do not change Prisma pool configuration based only on this evidence.

## Code and infrastructure changes

- **Code changes required:** Not indicated by this investigation.
- **Infrastructure changes required:** None established. The existing local container is healthy; continue observing stability during subsequent local database checks.

## Final status

**PHASE 32B DATABASE STABILITY**

- Docker: **PASS**
- PostgreSQL: **INTERMITTENT** (currently healthy; one earlier client-side connection failure)
- Port 5432: **PASS**
- Prisma: **PASS**
- Registration: **PASS**
- Login: **PASS**
- Database stability: **INTERMITTENT**
- Root cause: **C — transient application-to-database connectivity loss; precise trigger unknown**

**RELEASE STATUS: READY FOR NEXT DATABASE CHECK**

This report closes the original investigation only. No Phase 32C work was started.

## Follow-up — local readiness recheck (2026-09-28)

| Check | Current result | Evidence |
|---|---|---|
| Docker engine | **UNVERIFIED** | Docker CLI could not access the Windows Docker named pipe from this session (`permission denied`). Container health and restart count could not be rechecked. |
| PostgreSQL / 5432 | **PASS, IPv4** | `Test-NetConnection localhost -Port 5432` succeeded over IPv4. IPv6 loopback failed. Read-only Prisma `db execute` with `SELECT 1` succeeded. |
| Prisma | **PASS** | `npx prisma validate` succeeded. No migration or schema mutation was run. |
| App health | **PASS** | `GET http://localhost:3000/api/health` returned HTTP 200 with `status: ok`. |
| Unit tests | **PASS** | `npm test`: 9 passed, 0 failed. |
| Typecheck and lint | **PASS** | `npm run typecheck` and `npm run lint` passed. |
| Production build | **PASS** | `npm run build` completed successfully after stopping the development server. Do not run the build concurrently with `next dev`; both use `.next`. |
| Local browser E2E | **PASS, 4/4** | With local Chrome and `E2E_BASE_URL=http://localhost:3000`, registration/login, route smoke, account isolation, concurrent free-session, and anonymous checks passed. The billing test was skipped by its explicit opt-in gate. |
| Database latency | **OBSERVE** | During the browser flow, selected queries logged around 2 seconds. They completed without errors; this is a latency signal, not evidence of instability by itself. |

This follow-up supports local development readiness, not staging or production certification. The original transient database connection error still has no identified root cause. Docker Engine permissions prevented verifying the current container directly.
