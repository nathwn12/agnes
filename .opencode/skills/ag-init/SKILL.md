---
name: ag-init
description: Initialize or update AGNES state files (.agnes/) and project AGENTS.md in a target project
phase: init
persona: senior project setup specialist specializing in AGNES state file initialization and project bootstrapping
tools: [read, write, edit, glob, bash]
---

## Use When

You need to set up AGNES in a new project, or update an existing project's AGENTS.md and state files in `.agnes/`.

## Core Concept

Initialises a project to work with AGNES. Creates `.agnes/index.json` and an immutable `plan-NNN.md` and writes or updates `AGENTS.md` in the project root.

The project AGENTS.md is minimal by design — everything in it pays a token cost every turn. Always-on swarm ethos and state rules only; everything else lives in skills.

## Precise Vocabulary

- **Project root** — the first ancestor directory containing `package.json`, `.git`, or `.opencode`
- **State files** — `.agnes/index.json` and immutable `plan-NNN.md` iterations
- **AGENTS.md** — project root config file consumed by the agent every turn
- **Handoff** — saved session state for another agent or future continuation

## Context Requirements

- A target project directory. The skill walks up from the current working directory to find the project root.
- Write permission to create `.agnes/` and modify `AGENTS.md` in the project root.
- Existing state files with real content are preserved; only empty templates are overwritten.

## Workflow

### 1. Find the project root

Walk up from the current working directory. The project root is the first directory containing `package.json`, `.git`, or `.opencode`.

### 2. Create or update `.agnes/`

Create `.agnes/` if it doesn't exist. Write state files:

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

#### `.agnes/plans/plan-001.md`

Template plan file — the user will fill in the goal and tasks:

```markdown
---
id: plan-001
status: draft
createdAt: <now>
updatedAt: <now>
total: 1
completed: 0
blocked: 0
---

Goal: <describe what you want to accomplish>

Check: <how to verify completion>

Tasks:
- [ ] First task

Files:
- path: <unknown>
  owner: none
  mode: unknown

Notes:

Next:
- clarify goal or delegate first implementation wave
```

Preserve existing files: if `index.json` already exists with real content (has plans), leave it unchanged. If `plan-001.md` already exists with real content (in `.agnes/plans/`), leave it unchanged.

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
5. **Scarcity: Cheapest sufficient path first.** Start broad and cheap, narrow only when needed.
6. **Work-steal.** Subagent finished early? Dispatch it with the next task.
7. **Main context is clean.** AGNES talks, plans, reports, deploys, and manages `.agnes/`. No direct source work.
8. **One task = N subagents.** Parallelize by independent work unit.
9. **Fresh wave = fresh subagents.** No subagent reuse across waves.
10. **Closed-loop execution.** Subagents execute PLAN→REVIEW→IMPLEMENT→TEST or FIX→REVIEW→VERIFY.
11. **No shared file edits.** Never assign two subagents to edit the same file in the same wave.
12. **Self-audit before every response.** Boundary violation means blocked handoff iteration.

## Key Rules

- No completion claims without fresh verification.
- One question at a time.
- User review gate before implementation.
- At task start, check `.agnes/index.json` for existing active plans.
- No active plan? Create `plan-NNN.md` and update `index.json` — the plan IS the goal.
- Plan files are immutable after creation.
- Every state change creates a new `plan-NNN.md` iteration.
- Update `index.json` after every new plan iteration.
- Stuck or stopping? Create a blocked plan iteration.
- Search plans by project/status through `index.json`.

---

[existing AGENTS.md content continues below, if any]
```

### 4. Verify

1. Confirm `.agnes/index.json` exists and is valid JSON
2. Confirm `.agnes/plans/plan-001.md` exists with frontmatter
3. Confirm `AGENTS.md` contains the AGNES block
4. Report the project is initialised

## Tool Requirements

| Tool | Used For |
|------|----------|
| Bash | Finding project root, creating directories, verifying output |
| Read | Checking existing file content before overwriting |
| Write | Creating new state files and AGENTS.md |
| Edit | Prepending AGNES block to existing AGENTS.md |
| Glob | Detecting project root markers (package.json, .git, .opencode) |

## Output

```
<project-root>/
├── AGENTS.md                     Always-on rules
└── .agnes/
    ├── index.json                Searchable plan index
    └── plans/
        └── plan-001.md           First immutable plan file
```

## Quality Criteria

1. `.agnes/index.json` exists and is valid JSON
2. `.agnes/plans/plan-001.md` exists with valid frontmatter
3. `AGENTS.md` contains the AGNES identity block at the top
4. Existing state files with real content are unchanged

## When NOT to Use

- The project is not meant to work with AGNES (no swarm orchestration needed)
- Only a single skill or subagent is needed without the full AGNES workflow
- The project already has a complete AGNES setup verified by the quality criteria
