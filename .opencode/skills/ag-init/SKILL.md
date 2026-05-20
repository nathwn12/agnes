---
name: ag-init
description: Initialize or update AGNES state files (docs/agnes/) and project AGENTS.md in a target project
---

# ag-init

Initialises a project to work with AGNES. Creates `docs/agnes/` with four convention files and writes/updates `AGENTS.md` in the project root.

The project AGENTS.md is minimal by design — everything in it pays a token cost every turn. Always-on swarm ethos and state rules only; everything else lives in skills.

## What it produces

```
<project-root>/
├── AGENTS.md              Always-on rules + pointer to docs/agnes/
└── docs/agnes/
    ├── goal.md            Completion condition format
    ├── plan.md            Three-status checklist format
    ├── session.md         Smart zone, compaction, clearing, handoff
    └── handoff.md         Session state for next agent
```

## Instructions

### 1. Find the project root

Walk up from the current working directory. The project root is the first directory containing `package.json`, `.git`, or `.opencode`.

### 2. Create or update `docs/agnes/`

Create `docs/agnes/` if it doesn't exist. Write each file below.

If a file already exists and has real content (not just a template/placeholder), leave it unchanged — the project already has active state.

#### `docs/agnes/goal.md`

```markdown
# Goal

A goal is a completion condition. Write it at task start. Re-read before every delegation wave.

**Format:**

```
Goal: <sentence>
Check: <how to verify>
Constrained by: <what must not change, optional>
Done when: <condition satisfied or N waves elapsed>
```

**Evaluation:** After each delegation wave, check if the condition is met. If yes → report done. If no → delegate next wave.

**Examples:**

```
Goal: Auth module migrated to new API, all call sites updated
Check: npm run typecheck && npm t -- --testPathPattern=auth
Constrained by: no other module imports are changed
Done when: both commands exit 0
```

```
Goal: Queue of 12 issues in ready-for-agent is empty
Check: gh issue list --label ready-for-agent --json id | jq length
Done when: 0
```
```

#### `docs/agnes/plan.md`

```markdown
# Plan

A three-status checklist tracking progress toward the goal.

**Format:**

```
Goal: <copied from goal.md>

- [x] <done task>
- [/] <blocked task> (reason: <why>)
- [ ] <pending task> (@<handler>)
```

**Rules:**
1. Three statuses only: `[x]` `/` `[ ]`
2. Blocked items MUST have a parenthetical reason
3. Pending items MAY tag a handler with `@`
4. No commentary. No free text.
5. Update before every delegation wave.
```

#### `docs/agnes/session.md`

```markdown
# Session Management

Every session follows the same curve: smart zone → dumb zone.

```
Sharp ┃▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░  Dumb
      ┃ SMART ZONE   DUMB ZONE
      ┗━━━━━━━━━━━━━━━━━━━━━━━━━━
      tokens / turns →
```

**Three boundaries:**

| Action | When | What happens |
|--------|------|-------------|
| **Clear** | Goal met, or deep in dumb zone with no useful state | Fresh session, empty context |
| **Compact** | Mid-task, context bloated, useful state to carry | Update plan.md → summarise → clear → re-seed |
| **Handoff** | Role switch, parallel fan-out, user says "stop" | Update plan.md → write handoff.md → stop |

**Decision tree:**

```
Session heavy?
├── Goal met? → Clear
├── Useful state? → No → Clear
└── Yes → Role switch? → Yes → Handoff | No → Compact
```
```

#### `docs/agnes/handoff.md`

```markdown
# Handoff

Saves session state for another agent or a future session.

**Write when:** User says "handoff" or "stop", or 3 failed hypotheses during debugging.

**Format:**

```
Goal: <copied from goal.md>

## State
- Plan: <path to plan.md>
- Branch: <git branch, if any>
- Working dir: <absolute path>

## Progress
<completed items with key results>

## Pending
<remaining items, copied from plan.md>

## Evidence
<files changed, test output, command results>

## Context
<decisions, assumptions, things the next agent must know>

## Next
<one concrete action to start with>

---

## Stuck section (only for 3-fail)
### Failed hypotheses
1. <hypothesis> — ruled out by: <evidence>
2. <hypothesis> — ruled out by: <evidence>
3. <hypothesis> — ruled out by: <evidence>

### Suspected root cause
### Suggested redesign
```

**Rules:**
1. Copy Goal from goal.md
2. Copy Pending from plan.md
3. Next must be one concrete action
4. Update plan.md before writing
5. Write → commit (if applicable) → stop

**Receiving a handoff:**
1. Read handoff.md → get Goal, Progress, Pending, Next
2. Restore goal.md — write Goal into docs/agnes/goal.md
3. Restore plan.md — write Pending items as `[ ] pending`
4. Delete handoff.md
5. Begin work
```

### 3. Create or update `AGENTS.md`

Write `AGENTS.md` at the project root. If it already exists, prepend the AGNES block to the existing content (AGNES identity must come first so every agent sees it).

```markdown
# AGNES — OpenCode Native Plugin

This project uses AGNES, a swarm orchestrator that routes tasks across fused skills.

## Swarm Ethos (Override — Always Active)

1. **Delegate or die.** If you catch yourself writing code directly, STOP and spawn a subagent.
2. **Parallelize by default.** Scan every task set for independence. Sequential is the exception.
3. **1% Rule.** If even 1% chance a skill applies → invoke it.
4. **Verify before claiming.** Run command, read output, then speak.
5. **Work-steal.** Subagent finished early? Dispatch it with the next task.

## Key Rules
- No completion claims without fresh verification
- One question at a time
- User review gate before implementation
- Set `docs/agnes/goal.md` at task start, re-read before every wave
- Maintain `docs/agnes/plan.md` — three-status checklist, update every wave
- Monitor session age — clear, compact, or handoff before the dumb zone
- Write `docs/agnes/handoff.md` on "handoff"/"stop" or when stuck

---

[existing AGENTS.md content continues below, if any]
```

### 4. Verify

1. Confirm `docs/agnes/goal.md`, `plan.md`, `session.md`, `handoff.md` all exist with content
2. Confirm `AGENTS.md` exists and contains the AGNES block
3. Report the project is initialised
