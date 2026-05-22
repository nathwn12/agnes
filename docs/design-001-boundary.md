# AGNES 0.7.1 Hardening - Boundary Document

## Core Identity (AGNES Contract)
AGNES is a stateful orchestration runtime for delegated engineering work.

## Core Responsibilities (Always Active)
These are what AGNES must do to be itself:

| Responsibility | Implementation | Signal Type |
|---|---|---|
| Choose and load correct skill | ag-orchestrator routing | Hard (skill tool) |
| Enforce plan gate before work | `getPlanGate()` | Hard (state check) |
| Track active plan and state | `readPlanIndex()` / `index.json` | Hard (persisted state) |
| Delegate work to subagents | `task` tool | Hard (tool call) |
| Verify completion (promise tag) | `detectPromiseTag()` | Structured (tag pattern) |
| Decide retry vs block vs done | Retry count + promise presence | Structured (counters + tag) |
| Update plan state after each attempt | `updatePlanStatus()` / `createPlanIteration()` | Hard (persisted state) |
| Self-audit for boundary violations | Rules in AGENTS.md | Hard (static rules) |

## Support/Advisory Systems (Non-core)
These help but should never control orchestration decisions:

| System | Role | Signal Type |
|---|---|---|
| Struggle metrics (noProgress, shortRuns) | Warning hints injected into execution context | Heuristic |
| Repeated error tracking | Advisory signal for escalation | Heuristic |
| Transcript progress detection | Removed - too fragile | Heuristic |
| `buildExecutionContext` hints | Advisory, does not gate behavior | Mixed |
| Session attempt tracking | Bookkeeping for retry limit | Structured |

## Keep / Cut / Refactor Map

### Keep
- Promise tag detection (`detectPromiseTag`, `extractPromiseTag`)
- Plan gate (`getPlanGate`)
- Plan CRUD (`createPlan`, `createPlanIteration`, `updatePlanStatus`)
- Atomic writes (write-to-tmp + rename)
- Runtime JSON validation
- TypeScript strictness (`noUnusedLocals`, `noUnusedParameters`)

### Cut
- Transcript progress detection from assistant prose
- Negative-signal text parsing (`can't`, `couldn't`, `failed to`, `error`)
- Error extraction from transcript output

### Refactor
- `index.json` is the single runtime authority
- Plan markdown files are narrative only
- Session tracking lives in `runtime.ts`
- `plugin.ts` remains an OpenCode adapter only

## State Authority Model

`index.json` holds status, counts, attempts, struggle metrics, and `activePlanId`.

`plan-*.md` files hold only narrative content like goal, tasks, notes, and parent linkage.
