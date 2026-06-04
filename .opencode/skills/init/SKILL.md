---
id: init
name: init
description: 'You need to set up AGNES in a new project, or update an existing project''s AGENTS.md and state files in .agnes/.'
phase: "SETUP"
use_when: "You need to set up AGNES in a new project, or update an existing project's AGENTS.md and state files in .agnes/."
version: 1.0
---

## Use When

Set up AGNES in a new project, or update AGENTS.md and state files in `.agnes/`.

## Core Concept

Initialises project for AGNES. Creates `.agnes/index.json`, `.agnes/config.json`, `.agnes/sessions.json`, `.agnes/learnings/`, `.agnes/specs/`, and `plan-NNN.yaml`, then writes/updates `AGENTS.md` in project root.

AGENTS.md is minimal by design — every token costs. Always-on swarm ethos and state rules only; everything else in skills.

## Precise Vocabulary

- **Project root** — first ancestor with `package.json`, `.git`, or `.opencode`
- **State files** — `.agnes/index.json`, `config.json`, `sessions.json`, `learnings/`, `specs/`, `plan-NNN.yaml`
- **AGENTS.md** — project root config consumed every turn
- **Handoff** — saved session state for agent continuation

## Context Requirements

- Target project directory. Walks up from CWD to find project root.
- Write permission for `.agnes/` and `AGENTS.md`.
- Existing state files with real content preserved; only empty templates overwritten.

## Workflow

### 1. Find project root

Walk up from CWD. First dir with `package.json`, `.git`, or `.opencode`.

### 2. Create or update `.agnes/`

Create `.agnes/` if missing. Write state files:

#### `.agnes/index.json`

```json
{
  "agnesVersion": "0.4.4",
  "schemaVersion": 2,
  "projectDir": "<project-root>",
  "projectName": "<project-basename>",
  "updatedAt": "<ISO timestamp>",
  "activePlanId": null,
  "plans": []
}
```

#### `.agnes/config.json`

```json
{
  "agnesVersion": "0.12.0",
  "schemaVersion": 2,
  "projectDir": "<project-root>",
  "projectName": "<project-basename>",
  "updatedAt": "<ISO timestamp>"
}
```

#### `.agnes/sessions.json`

```json
{
  "sessions": []
}
```

#### `.agnes/learnings/`

Create directory. Don't overwrite existing entries.

#### `.agnes/specs/`

Create directory. Don't overwrite existing entries.

#### `.agnes/plans/plan-001.yaml`

```yaml
schema: agnes/plan-v1
id: plan-001
status: draft
createdAt: <now>
updatedAt: <now>
summary: <describe what you want to accomplish>
parent: null
total: 1
completed: 0
blocked: 0
```

Preserve existing: `index.json` with real content (has plans) unchanged. `plan-001.yaml` with real content unchanged.

### 3. Create or update `AGENTS.md`

Write `AGENTS.md` at project root. If exists, prepend AGNES block (identity must come first).

```markdown
# AGNES — OpenCode Native Plugin

This project uses AGNES, a swarm orchestrator routing tasks across fused skills.

## Swarm Ethos (Override — Always Active)

1. **Delegate or die.** Caught writing code directly? STOP, spawn subagent.
2. **Parallelize by default.** Scan tasks for independence. Sequential is exception.
3. **1% Rule.** 1% chance skill applies → invoke it.
4. **Verify before claiming.** Run command, read output, then speak.
5. **Scarcity: Cheapest sufficient path first.** Start broad and cheap, narrow only when needed.
6. **Work-steal.** Subagent finished early? Dispatch next task.
7. **Main context is clean.** AGNES talks, plans, reports, deploys, manages `.agnes/`. No direct source work.
8. **One task = N subagents.** Parallelize by independent work unit.
9. **Fresh wave = fresh subagents.** No reuse across waves.
10. **Closed-loop execution.** PLAN→REVIEW→IMPLEMENT→TEST or FIX→REVIEW→VERIFY.
11. **No shared file edits.** Never two subagents editing same file in same wave.
12. **Self-audit before every response.** Boundary violation → blocked handoff iteration.

## Key Rules

- No completion claims without fresh verification.
- One question at a time.
- User review gate before implementation.
- Check `.agnes/index.json` for active plans at task start.
- No active plan? Create `plan-NNN.yaml`, update `index.json` — plan IS goal.
- Plan sources immutable after creation.
- Every state change creates new `plan-NNN.yaml`.
- Update `index.json` after every new plan iteration.
- Stuck/stopping? Create blocked plan iteration.
- Search plans by project/status via `index.json`.

---

[existing AGENTS.md content continues below]
```

### 4. Verify

1. `.agnes/index.json` exists and valid JSON
2. `.agnes/config.json`, `sessions.json`, `learnings/`, `specs/` exist
3. `.agnes/plans/plan-001.yaml` exists
4. `AGENTS.md` contains AGNES block
5. Report project initialised

## Tool Requirements

| Tool | Used For |
|------|----------|
| Bash | Find project root, create dirs, verify |
| Read | Check existing content before overwrite |
| Write | Create state files and AGENTS.md |
| Edit | Prepend AGNES block to existing AGENTS.md |
| Glob | Detect project root markers |

## Output

```
<project-root>/
├── AGENTS.md                     Always-on rules
└── .agnes/
    ├── config.json               Project-level AGNES config
    ├── index.json                Searchable plan index
    ├── sessions.json             Session history and handoff state
    ├── learnings/                Durable learnings and notes
    ├── specs/                    Spec documents and references
    └── plans/
    ├── plan-001.yaml         First immutable plan source
```

## Quality Criteria

1. `.agnes/index.json` exists and valid JSON
2. `.agnes/plans/plan-001.yaml` exists
3. `AGENTS.md` contains AGNES block at top
4. Existing state files with real content unchanged

## When NOT to Use

- Project not meant for AGNES (no swarm orchestration)
- Only single skill/subagent needed without full workflow
- Project already has complete AGNES setup (verified by criteria)
