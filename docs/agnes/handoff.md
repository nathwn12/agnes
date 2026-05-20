# Handoff

A handoff saves session state for another agent or a future session. AGNES writes `handoff.md` in two cases:

| Trigger | When | Meaning |
|---------|------|---------|
| **User says "handoff" or "stop"** | Any time | Save progress for next agent or later continuation |
| **3 failed hypotheses** | Debug/grill phase | Architecture is wrong, not the code. Stop and document. |

## Schema

```
Goal: <copied from goal.md>

## State
- Plan: <link or relative path to plan.md>
- Branch: <git branch, if any>
- Working dir: <absolute path>

## Progress
<what was done — bullet list of completed items with key results>

## Pending
<what remains — linked to plan.md items>

## Evidence
<artifacts produced: files changed, test output, screenshots, command results>

## Context
<decisions made, assumptions, things the next agent MUST know to pick up cold>

## Next
<exactly what the next agent should do first — one concrete action>

---

## Stuck section (only for 3-fail handoff)

### Failed hypotheses
1. <hypothesis> — ruled out by: <evidence>
2. <hypothesis> — ruled out by: <evidence>
3. <hypothesis> — ruled out by: <evidence>

### Suspected root cause
<what the architecture issue likely is, not proven yet>

### Suggested redesign
<recommended direction — what to try instead>
```

## Rules

1. Always copy the `Goal` from `goal.md` — the next agent needs the north star
2. Copy pending items from `plan.md` into `## Pending` — the next agent picks up cold without opening plan.md. plan.md is the authoritative source; handoff is a snapshot.
3. `Next` must be one concrete action — "run this command", "read this file", "try this hypothesis"
4. Stuck handoff must list all 3 hypotheses and why each failed — prevents re-treading
5. Update `plan.md` before writing handoff — the checklist must reflect reality at the boundary
6. Write `handoff.md` → commit (if applicable) → **stop**. Do not continue working after writing.

## Receiving a handoff

When starting a session from a handoff artifact:

1. Read `handoff.md` → get Goal, Progress, Pending, Next
2. Restore `plan.md` — write the `## Pending` items back into plan.md as `[ ] pending` entries
3. Restore `goal.md` — write the `Goal` from handoff into goal.md
4. Delete `handoff.md` — prevents reprocessing next session
5. Begin work — start with the `## Next` action

## Examples

### User-initiated handoff

```
Goal: Migrate auth module to new API

## State
- Plan: docs/agnes/plan.md
- Branch: feat/auth-migration
- Working dir: /home/user/project

## Progress
- Created new AuthService interface (src/auth/service.ts)
- Migrated login endpoint to new API (src/routes/login.ts)
- Tests passing for login endpoint (17/17)

## Pending
- Migrate register endpoint (plan item A3)
- Migrate password-reset endpoint (plan item A4)
- Remove old AuthClient (plan item B1)

## Evidence
- src/auth/service.ts — new interface
- src/routes/login.ts — migrated
- `npm t -- --testPathPattern=auth` exits 0

## Context
- New API uses bearer tokens, old used session cookies
- Decision: keep old AuthClient until all endpoints migrated
- Old AuthClient is imported in 3 more files (grep for `from './auth-client'`)

## Next
Run `npm t -- --testPathPattern=auth/register` then migrate src/routes/register.ts
```

### Stuck handoff (3-fail)

```
Goal: Fix intermittent 503 on /checkout POST

## State
...

## Progress
- Reproduced 503: 1 in ~50 requests under load
- Added request/response logging at every middleware
- Ruled out database connection pool exhaustion

## Pending
...

## Stuck section

### Failed hypotheses
1. DB pool exhaustion — ruled out by: connection count steady at 5/20 during 503s
2. Rate limiter false positive — ruled out by: rate-limit headers show 199/200 remaining
3. Upstream payment gateway timeout — ruled out by: gateway responds in 200ms, happens after response sent

### Suspected root cause
nginx reverse proxy connection pool mismatch — keepalive settings differ between nginx and Node

### Suggested redesign
Match nginx `keepalive_requests` to Node's `server.keepAliveTimeout`
```
