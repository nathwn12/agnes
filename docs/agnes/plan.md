# Plan

A plan is a checklist tracking progress toward the [goal](./goal.md). Three statuses. No free text. Updated before every delegation wave.

## Schema

```
- [x] <done task>
- [/] <blocked task> (reason: <why>)
- [ ] <pending task> (@<handler>)
```

A header links to the goal:

```
Goal: <copied from goal.md>
```

## Rules

1. **Three statuses only.** `[x]` done, `[/]` blocked, `[ ]` pending. No other prefixes.
2. **Blocked items MUST have a reason.** Parenthetical after the item. No reason = not blocked.
3. **Pending items MAY tag a handler.** `@ag-builder`, `@ag-tester`, `@explorer`. Free-form — whoever should pick it up.
4. **No commentary.** Analysis, decisions, and context belong in `goal.md`, `handoff.md`, or session messages. The plan is a checklist.
5. **Link to goal.md.** The `Goal:` line at the top must match the active goal — copy it from `docs/agnes/goal.md`.
6. **Update before every delegation wave.** Re-read goal → re-read plan → pick next item → delegate.

## Wave lifecycle

```
1. Re-read goal.md                 → stay focused on completion condition
2. Read plan.md                    → know what's done, blocked, pending
3. Pick nearest pending item       → unblocked leaf first
4. Delegate to subagent or skill
5. On return → update item status  → [x] or [/] (reason)
6. If session feels heavy          → update plan.md, then session decision tree
7. If goal condition met           → report done, clear
8. If blocked with no alternatives → update plan.md, then handoff
```

## Examples

### Active plan

```
Goal: Migrate auth module to new API

- [x] Create AuthService interface (src/auth/service.ts)
- [x] Migrate login endpoint
- [/] Migrate register endpoint (reason: schema needs `email_verified` column — blocked on DB migration)
- [ ] Migrate password-reset endpoint (@ag-builder)
- [ ] Remove old AuthClient
```

### All blocked — handoff triggered

```
Goal: Fix intermittent 503 on /checkout POST

- [x] Add request/response logging at every middleware
- [x] Rule out DB pool exhaustion
- [x] Rule out rate limiter false positives
- [/] Rule out upstream gateway timeout (reason: gateway responds in 200ms, 503 happens after response sent)
- [/] Identify root cause (reason: 3 hypotheses exhausted — see handoff.md for stuck section)
```
