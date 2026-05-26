<h1 align="center">AGNES — OpenCode Native Plugin</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.0-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license">
  <img src="https://img.shields.io/badge/skills-30-orange" alt="30 skills">
  <img src="https://img.shields.io/badge/OpenCode-plugin-purple" alt="OpenCode plugin">
</p>

<p align="center">
  <b>Swarm orchestrator for OpenCode.</b><br>
  Routes every engineering task across 30 specialized skills. Delegates relentlessly. Parallelizes by default. Never writes code directly.
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

Restart OpenCode. AGNES injects its bootstrap and registers all 30 skills automatically.

---

## Pipeline

AGNES routes every task through a default chronological pipeline. The flow is linear by default — each phase feeds into the next. Side skills (Design, Debug, Process, Meta) fire on demand when their trigger conditions are met.

### Default Flow (chronological order)

1. **SETUP** → `init`
2. **CLARIFY** → `clarifier` ← **GATE:** spec must be approved
3. **RESEARCH** → `explorer` → `architect` (optional deepening)
4. **PLAN** → `planner` (builtin fast path for lightweight tasks; full planner + `multi-reviewer` for complex work)
5. **BUILD** → `tdd` (new features) or `builder` (plan execution) → `tester` (coverage)
6. **VERIFY** → `verifier` → `reviewer` ← **GATE:** all checks must pass
7. **SHIP** → `shipper` (PR → merge)
8. **REFLECT** → `documenter` → `retro`

**Gates** block progression until they pass. AGNES will NOT skip a gate.

### Side Branches (fire when trigger condition is met)

| Branch | Entry Trigger | Skills Used |
|--------|--------------|-------------|
| **Design** | New UI project, need brand identity | brandkit → prototype → prd |
| **Debug** | Bug report, test failure, crash | debugger → griller (if debugger fails) |
| **Process** | Incoming issue needs triage | triage |
| **Meta** | AGNES is missing a capability | skillwriter |

---

## Skills

All 30 bundled skills with concrete trigger conditions and outputs. "When to Use" is written for both beginners (what you'll be feeling/experiencing) and advanced users (the precise boundary conditions).

| Skill | Phase | When to Use | What It Produces |
|-------|-------|-------------|------------------|
| **orchestrator** | META | *Always active.* Coordinates all other skills, delegates work to subagents, manages parallel execution, tracks session state. | Delegation waves, goal/plan state, subagent results |
| **instinct** | META | Cross-session context retention and learned pattern memory. Agents observe patterns, create instincts with confidence scores, promote or decay them over time. | Learned patterns with confidence scores, promoted/decayed instincts |
| **init** | SETUP | First time running AGNES in a project. Or existing state files are corrupted/missing. | `.agnes/` directory with `index.json` + `AGENTS.md` |
| **brainstorming** | THINK | Ambiguous creative direction, no clear implementation path, need to explore design space before committing to a plan. | Design doc with forcing questions, 2-3 approach proposals, approved spec |
| **clarifier** | THINK | Request is vague ("make it better"), ambiguous ("fix the issue"), or has terminology conflicts between team members. Sharpens until executable. | Written, user-approved specification |
| **explorer** | RESEARCH | Need to understand unfamiliar code before making changes. Or need to find where a thing lives, how data flows, what conventions exist. | Structured findings report: file map, dependency chains, pattern analysis |
| **architect** | RESEARCH / DESIGN | Codebase feels hard to change — adding features requires touching 5 files, tests are brittle, module boundaries are blurry. Finds deepening opportunities. | Seam map, interface proposals, Design It Twice alternatives |
| **brandkit** | DESIGN | Starting a UI-heavy project. Need logo, color palette, typography, design system, or brand guidelines. Not for backend-only work. | Brand assets, color system, typography scale, component mockups |
| **prototype** | DESIGN / BUILD | Need to validate a design decision with throwaway code. Not sure if the state machine is right, or if that UX pattern works. | Runnable prototype + documented answer (discarded after) |
| **prd** | PLAN | Requirements are clear but need formal capture. Stakeholders need a documented PRD with stories, acceptance criteria, and priorities. | Published PRD with user stories, acceptance criteria, priority matrix |
| **planner** | PLAN | Spec or PRD is approved. Need to break it into actionable implementation steps with dependencies and ordering. `planner.mode=auto|builtin|full` selects builtin vs full routing. | Bite-sized implementation checklist (plan-NNN.yaml) |
| **multi-reviewer** | PLAN REVIEW | Planner produced a plan. Need a quality gate before any implementation starts. Applies four lenses: CEO (business value), Eng (architecture), Design (UX), DX (developer experience). | Score per lens + verdict: `APPROVE`, `REVISE`, or `REJECT` |
| **plan-reviewer** | PLAN REVIEW | Legacy compatibility skill still bundled for older workflows. Prefer `multi-reviewer` for new plan gates. | Legacy plan review findings |
| **builder** | BUILD | Plan is approved and ready to execute. Has detailed tasks with clear boundaries. Dispatches subagent swarms in isolated worktrees. | Verified, reviewed commits |
| **tdd** | TEST / BUILD | Building features from scratch. Prefer test-first development. Each cycle: RED (write failing test) → GREEN (minimal code) → REFACTOR (clean up). | Red-green-refactor vertical slices through all layers |
| **tester** | TEST | Features are built, need comprehensive test coverage. Or coverage gaps are identified and need filling. Not for test-first workflows. | Unit/integration/edge case tests + coverage gap report |
| **verifier** | VERIFY | Before claiming any task is done. Runs type check, lint, full test suite, and build in sequence. Captures pass/fail with timing. Rejects claims without fresh evidence. | Pass/fail evidence log: type check → lint → test → build |
| **reviewer** | REVIEW | Code is written, tests pass, ready for review. Checks spec compliance, project conventions, API design, error handling, and test quality. | Spec compliance score + actionable findings list |
| **feedback-receiver** | REVIEW | Received PR/code review feedback from a human or external reviewer. Processes each comment, categorizes, produces fix plan, coordinates changes. | Categorized feedback + fix implementation plan |
| **debugger** | DEBUG | Bug report comes in. Or a test fails and root cause isn't obvious. Collaborative investigation: reproduce → isolate → regression test → fix. | Root cause analysis + regression test + fix |
| **griller** | DEBUG | debugger tried 3 approaches and failed. Bug spans multiple modules. Or the failure is intermittent and hard to reproduce. Adversarial: generates and tests hypotheses systematically. | Architecture finding or fix + hypothesis log |
| **triage** | SHIP / PROCESS | Incoming issue, PR, or feature request needs routing. Validates completeness, assigns labels, sets priority, routes to appropriate skill. | State-machine triage: validated → labeled → assigned |
| **shipper** | SHIP | Code is reviewed, all gates pass, ready to deliver. Creates PR, runs final verification, merges or discards. Do NOT use before verification gates pass. | Merged PR or discarded branch + changelog entry |
| **documenter** | REFLECT | Post-ship. Code is landed, needs docs. Or changelog needs updating. Or architecture decisions need ADRs. Follows Diataxis: tutorials, how-to, reference, explanation. | Diataxis docs (tutorials, how-to, reference, explanation) + ADRs + changelog |
| **retro** | REFLECT | Sprint or milestone completed. Or a pattern keeps repeating (good or bad). Facilitates retrospective: what worked, what didn't, what to change. | Learnings document → stored in `.agnes/learnings/` |
| **skillwriter** | REFLECT / META | AGNES is missing a capability. Or an existing skill needs refinement. Creates a new skill or refines an existing one via TDD. | New/refined SKILL.md + tests |

---

## Quick Start

1. **Install** — add to `opencode.json` and restart
2. **Init** — run `init` in any project to create `.agnes/` and `AGENTS.md`
3. **Work** — every engineering task routes through the pipeline automatically:
   - Vague request? → clarifier sharpens it
   - Need to understand code? → explorer researches
   - Ready to build? → builder dispatches subagents
   - Bugs? → griller systematically debugs
4. **Review** — reviewer gate-checks before any merge
5. **Reflect** — retro captures learnings, documenter produces docs

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
| **Contract assertions** | Evidence-backed Definition of Done protocol. No partial credit for failing assertions. |
| **Caveman default style** | All AGNES reports use ultra-compressed style — drop articles, filler, pleasantries, hedging. |

---

## Architecture

AGNES is organized into layered modules that handle protocol, state, runtime, and tool integration:

| Layer | Module | Purpose |
|-------|--------|---------|
| **Protocol** | `src/protocol.ts` | Typed messages (task, result, error, status, completion) |
| **Schema** | `src/schema.ts` | Self-describing skill contracts with JSON Schema validation |
| **Middleware** | `src/middleware.ts` | Composable hook chain (before/after wave, before/after subagent) |
| **Flow Control** | `src/flowcontrol.ts` | Ephemeral jump signals (retry, skip, blocked, next_wave, end) |
| **Bootstrap** | `src/bootstrap.ts` | Agent injection — injects plan context, shell env, and structured blocks into agent system prompt |
| **Plugin** | `src/plugin.ts` | OpenCode entry point — plugin registration, unconditional interleaved config (model-agnostic) |
| **Runtime Helpers** | `src/runtime.ts` | Wave helpers, subagent dispatch scaffolding, retry with struggle detection, and gate integration |
| **Shell** | `src/shell.ts` | Shell detection — identifies pwsh/bash/cmd and detects shell mismatch between host and workspace |
| **State** | `src/state.ts` | Plan state machine — CRUD for plan-NNN.yaml, index.json, session tracking, retention pruning |
| **Verification** | `src/verification.ts` | Structured gates with PASS/FAIL/SKIP status |
| **Validation** | `src/validation.ts` | Allowlist-based message validation and injection protection |

In v0.10+, AGNES adds a machine-optimized Structured Protocol: YAML plan files with JSON Schema validation (`.agnes/plans/plan-NNN.yaml`), typed `<agnes:message>` envelopes, and Zod-based message validation. Bootstrap injection unified to a model-agnostic structured format.

---

## State

AGNES tracks progress via `.agnes/` in any project:

```
.agnes/
├── index.json         Searchable plan index — read once, filter instantly
├── config.json        Per-project configuration overrides
├── learnings/         Cross-session learnings memory
├── specs/             Published specs and PRDs
└── plans/
    ├── plan-001.yaml  Canonical immutable plan iteration
    └── ...
```

Plan files are immutable — every state change creates a new `plan-NNN.yaml`.
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
bun run lint          # lint source files
bun run lint:fix      # auto-fix lint issues
bun run typecheck     # type-safety gate
bun test              # 390 tests across 13 suites
```

---

## Troubleshooting

### Clear cached installation

Use the command that matches your shell:

```powershell
Remove-Item -LiteralPath "$env:USERPROFILE\.cache\opencode\packages\agnes@git+https_*" -Recurse -Force
```

```cmd
rmdir /s /q "%USERPROFILE%\.cache\opencode\packages\agnes@git+https_"
```

```bash
rm -rf "$HOME/.cache/opencode/packages"/agnes@git+https_*
```

Then restart OpenCode.
