<h1 align="center">AGNES — OpenCode Native Plugin</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.12.0-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license">
  <img src="https://img.shields.io/badge/skills-23-orange" alt="23 skills">
  <img src="https://img.shields.io/badge/OpenCode-plugin-purple" alt="OpenCode plugin">
</p>

<p align="center">
  <b>Swarm orchestrator for OpenCode.</b><br>
  Routes every engineering task across 23 specialized skills. Delegates relentlessly. Parallelizes by default. Never writes code directly.
</p>

---

## Table of Contents

[Install](#install) · [Pipeline](#pipeline) · [Skills](#skills) · [Quick Start](#quick-start) · [Ethos](#ethos) · [Architecture](#architecture) · [State](#state) · [Development](#development) · [Troubleshooting](#troubleshooting)

---

## Install

Add to your `opencode.json`:

```json
{
  "plugin": ["agnes@git+https://github.com/nathwn12/agnes.git"]
}
```

Restart OpenCode. AGNES injects its bootstrap and registers all 23 skills automatically.

---

## Pipeline

AGNES routes every task through a default chronological pipeline. The flow is linear by default — each phase feeds into the next. Side skills (Design, Debug, Process, Meta) fire on demand when their trigger conditions are met.

### Default Flow (chronological order)

1. **SETUP** → `ag-init`
2. **CLARIFY** → `ag-clarifier` ← **GATE:** spec must be approved
3. **RESEARCH** → `ag-explorer` → `ag-architect` (optional deepening)
4. **PLAN** → `ag-planner` → `ag-plan-reviewer` ← **GATE:** plan must be approved
5. **BUILD** → `ag-tdd` (new features) or `ag-builder` (plan execution) → `ag-tester` (coverage)
6. **VERIFY** → `ag-verifier` → `ag-reviewer` ← **GATE:** all checks must pass
7. **SHIP** → `ag-shipper` (PR → merge)
8. **REFLECT** → `ag-documenter` → `ag-retro`

**Gates** block progression until they pass. AGNES will NOT skip a gate.

### Side Branches (fire when trigger condition is met)

| Branch | Entry Trigger | Skills Used |
|--------|--------------|-------------|
| **Design** | New UI project, need brand identity | ag-brandkit → ag-prototype → ag-prd |
| **Debug** | Bug report, test failure, crash | ag-debugger → ag-griller (if ag-debugger fails) |
| **Process** | Incoming issue needs triage | ag-triage |
| **Meta** | AGNES is missing a capability | ag-skillwriter |

---

## Skills

All 23 skills with concrete trigger conditions and outputs. "When to Use" is written for both beginners (what you'll be feeling/experiencing) and advanced users (the precise boundary conditions).

| Skill | Phase | When to Use | What It Produces |
|-------|-------|-------------|------------------|
| **ag-orchestrator** | META | *Always active.* Coordinates all other skills, delegates work to subagents, manages parallel execution, tracks session state. | Delegation waves, goal/plan state, subagent results |
| **ag-init** | SETUP | First time running AGNES in a project. Or existing state files are corrupted/missing. | `.agnes/` directory with `index.json` + `AGENTS.md` |
| **ag-clarifier** | THINK | Request is vague ("make it better"), ambiguous ("fix the issue"), or has terminology conflicts between team members. Sharpens until executable. | Written, user-approved specification |
| **ag-explorer** | RESEARCH | Need to understand unfamiliar code before making changes. Or need to find where a thing lives, how data flows, what conventions exist. | Structured findings report: file map, dependency chains, pattern analysis |
| **ag-architect** | RESEARCH / DESIGN | Codebase feels hard to change — adding features requires touching 5 files, tests are brittle, module boundaries are blurry. Finds deepening opportunities. | Seam map, interface proposals, Design It Twice alternatives |
| **ag-brandkit** | DESIGN | Starting a UI-heavy project. Need logo, color palette, typography, design system, or brand guidelines. Not for backend-only work. | Brand assets, color system, typography scale, component mockups |
| **ag-prototype** | DESIGN / BUILD | Need to validate a design decision with throwaway code. Not sure if the state machine is right, or if that UX pattern works. | Runnable prototype + documented answer (discarded after) |
| **ag-prd** | PLAN | Requirements are clear but need formal capture. Stakeholders need a documented PRD with stories, acceptance criteria, and priorities. | Published PRD with user stories, acceptance criteria, priority matrix |
| **ag-planner** | PLAN | Spec or PRD is approved. Need to break it into actionable implementation steps with dependencies and ordering. | Bite-sized implementation checklist (plan-NNN.md) |
| **ag-plan-reviewer** | PLAN REVIEW | Planner produced a plan. Need a quality gate before any implementation starts. Applies four lenses: CEO (business value), Eng (architecture), Design (UX), DX (developer experience). | Score per lens + verdict: Approve / Revise / Reject |
| **ag-builder** | BUILD | Plan is approved and ready to execute. Has detailed tasks with clear boundaries. Dispatches subagent swarms in isolated worktrees. | Verified, reviewed commits |
| **ag-tdd** | TEST / BUILD | Building features from scratch. Prefer test-first development. Each cycle: RED (write failing test) → GREEN (minimal code) → REFACTOR (clean up). | Red-green-refactor vertical slices through all layers |
| **ag-tester** | TEST | Features are built, need comprehensive test coverage. Or coverage gaps are identified and need filling. Not for test-first workflows. | Unit/integration/edge case tests + coverage gap report |
| **ag-verifier** | VERIFY | Before claiming any task is done. Runs type check, lint, full test suite, and build in sequence. Captures pass/fail with timing. Rejects claims without fresh evidence. | Pass/fail evidence log: type check → lint → test → build |
| **ag-reviewer** | REVIEW | Code is written, tests pass, ready for review. Checks spec compliance, project conventions, API design, error handling, and test quality. | Spec compliance score + actionable findings list |
| **ag-feedback-receiver** | REVIEW | Received PR/code review feedback from a human or external reviewer. Processes each comment, categorizes, produces fix plan, coordinates changes. | Categorized feedback + fix implementation plan |
| **ag-debugger** | DEBUG | Bug report comes in. Or a test fails and root cause isn't obvious. Collaborative investigation: reproduce → isolate → regression test → fix. | Root cause analysis + regression test + fix |
| **ag-griller** | DEBUG | ag-debugger tried 3 approaches and failed. Bug spans multiple modules. Or the failure is intermittent and hard to reproduce. Adversarial: generates and tests hypotheses systematically. | Architecture finding or fix + hypothesis log |
| **ag-triage** | SHIP / PROCESS | Incoming issue, PR, or feature request needs routing. Validates completeness, assigns labels, sets priority, routes to appropriate skill. | State-machine triage: validated → labeled → assigned |
| **ag-shipper** | SHIP | Code is reviewed, all gates pass, ready to deliver. Creates PR, runs final verification, merges or discards. Do NOT use before verification gates pass. | Merged PR or discarded branch + changelog entry |
| **ag-documenter** | REFLECT | Post-ship. Code is landed, needs docs. Or changelog needs updating. Or architecture decisions need ADRs. Follows Diataxis: tutorials, how-to, reference, explanation. | Diataxis docs (tutorials, how-to, reference, explanation) + ADRs + changelog |
| **ag-retro** | REFLECT | Sprint or milestone completed. Or a pattern keeps repeating (good or bad). Facilitates retrospective: what worked, what didn't, what to change. | Learnings document → stored in `.agnes/learnings/` |
| **ag-skillwriter** | REFLECT / META | AGNES is missing a capability. Or an existing skill needs refinement. Creates a new skill or refines an existing one via TDD. | New/refined SKILL.md + tests |

---

## Quick Start

1. **Install** — add to `opencode.json` and restart
2. **Init** — run `ag-init` in any project to create `.agnes/` and `AGENTS.md`
3. **Work** — every engineering task routes through the pipeline automatically:
   - Vague request? → ag-clarifier sharpens it
   - Need to understand code? → ag-explorer researches
   - Ready to build? → ag-builder dispatches subagents
   - Bugs? → ag-griller systematically debugs
4. **Review** — ag-reviewer gate-checks before any merge
5. **Reflect** — ag-retro captures learnings, ag-documenter produces docs

AGNES never writes code directly. Every task is delegated to a subagent or specialized skill.

---

## Ethos

| Principle | Meaning |
|-----------|---------|
| **Delegate or die** | If you're writing code directly, STOP. Spawn a subagent. |
| **Parallelize by default** | Scan every task set for independence. Sequential is the exception. |
| **1% Rule** | If even 1% chance a skill applies, invoke it. Wrong invocation costs nothing. |
| **Verify before claiming** | Run the command. Read the output. Then speak. |
| **Scarcity** | Cheapest sufficient path first — shallow-first, compact outputs, context as budget. |
| **Work-steal** | Subagent finished early? Dispatch it with the next task immediately. |
| **Promise-driven execution** | Tracks subagent progress via promise tags, detects struggle patterns, and retries with session-aware backoff. |

---

## Architecture

AGNES is organized into layered modules that handle protocol, state, runtime, and tool integration:

| Layer | Module | Purpose |
|-------|--------|---------|
| **Protocol** | `src/protocol.ts` | Typed messages (task, result, error, status, completion) |
| **Schema** | `src/schema.ts` | Self-describing skill contracts with JSON Schema validation |
| **Middleware** | `src/middleware.ts` | Composable hook chain (before/after wave, before/after subagent) |
| **Flow Control** | `src/flowcontrol.ts` | Ephemeral jump signals (retry, skip, blocked, next_wave, end) |
| **Bootstrap** | `src/bootstrap.ts` | Agent injection — injects plan context, shell env, and DS V4 structured blocks into agent system prompt |
| **Plugin** | `src/plugin.ts` | OpenCode entry point — plugin registration, auto-detects DeepSeek V4, injects interleaved reasoning config |
| **Runtime** | `src/runtime.ts` | Core execution loop — wave cycle, subagent dispatch, retry with struggle detection, closed-loop orchestration |
| **Shell** | `src/shell.ts` | Shell detection — identifies pwsh/bash/cmd and detects shell mismatch between host and workspace |
| **State** | `src/state.ts` | Plan state machine — CRUD for plan-NNN.md, index.json, session tracking, retention pruning |
| **Verification** | `src/verification.ts` | Structured gates with PASS/FAIL/SKIP status |
| **Validation** | `src/validation.ts` | Allowlist-based message validation and injection protection |

In v0.10+, AGNES adds a machine-optimized Structured Protocol: YAML plan files with JSON Schema validation (`.agnes/plans/plan-NNN.yaml`), typed `<agnes:message>` envelopes with DS V4 support, and Zod-based message validation. Bootstrap injection auto-detects DeepSeek V4 models to prevent the 400-on-turn-2 protocol bug.

---

## State

AGNES tracks progress via `.agnes/` in any project:

```
.agnes/
├── index.json         Searchable plan index — read once, filter instantly
├── sessions.json      Cross-session state tracking
├── config.json        Per-project configuration overrides
├── learnings/         Cross-session learnings memory
├── specs/             Published specs and PRDs
└── plans/
    ├── plan-001.md    First immutable plan iteration
    ├── plan-002.md    Second iteration (append-only, never edited)
    └── ...
```

Plan files are immutable — every state change creates a new `plan-NNN.md`.
Search by project/status through `index.json` without re-reading old plan files.

### Retention policy

Completed (`done`) and abandoned plans are auto-pruned after 7 days. Pruning runs transparently every time the index is loaded — no explicit trigger needed.

To override per-project, add a `retention` field to `index.json`:

```json
{
  "retention": {
    "maxAgeDays": 3,
    "terminalStatuses": ["done", "abandoned"]
  }
}
```

---

## Development

```bash
bun run bundle        # bundles to .opencode/plugins/agnes.js
bun run bundle:watch  # watch mode for development
bun run typecheck     # type-safety gate
bun test              # 371 tests across 12 suites
```

---

## Troubleshooting

### Clear cached installation

```powershell
# PowerShell
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\opencode\packages\agnes@git+https_*"
```

```bash
# Git Bash
rm -rf "$USERPROFILE/.cache/opencode/packages/agnes@git+https_"*
```

```cmd
:: CMD
rmdir /s /q "%USERPROFILE%\.cache\opencode\packages\agnes@git+https_*"
```

Then restart OpenCode.
