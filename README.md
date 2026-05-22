<h1 align="center">AGNES — OpenCode Native Plugin</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.7.4-blue" alt="version">
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

[Install](#install) · [Pipeline](#pipeline) · [Skills](#skills) · [Quick Start](#quick-start) · [Ethos](#ethos) · [State](#state) · [Development](#development) · [Troubleshooting](#troubleshooting)

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

Work flows left to right through 10 phases. When blocked, loops back.

```
Setup → Clarify → Research → Architect → Design/Plan → Build → Verify/Review → Debug → Ship → Reflect
```

| Phase | Skills | Purpose |
|-------|--------|---------|
| **Setup** | ag-init | Bootstrap `.agnes/` and `AGENTS.md` in a project |
| **Clarify** | ag-clarifier | Socratic questioning to resolve vague requests |
| **Research** | ag-explorer | Read-only codebase exploration & dependency tracing |
| **Architect** | ag-architect | Find deepening opportunities, Design It Twice pattern |
| **Design/Plan** | ag-brandkit, ag-prototype, ag-prd, ag-planner, ag-plan-reviewer | Design before code. Plans before builds. |
| **Build** | ag-builder, ag-tdd, ag-tester | Disciplined execution in isolated worktrees |
| **Verify/Review** | ag-verifier, ag-reviewer, ag-feedback-receiver | Iron Law: no claims without fresh verification |
| **Debug** | ag-debugger, ag-griller | Collaborative + adversarial systematic debugging |
| **Ship** | ag-triage, ag-shipper | Issue state machine + merge/PR/discard |
| **Reflect** | ag-documenter, ag-retro, ag-skillwriter | Docs, learnings, meta-skill creation |

---

## Skills

All 23 skills, their trigger conditions, and what they produce:

| Skill | Phase | When to Use | Output |
|-------|-------|-------------|--------|
| **ag-orchestrator** | META | Routing, delegation, parallelism | Delegation waves, goal/plan state |
| **ag-init** | Setup | First run in a project, refresh state files | `.agnes/` + `AGENTS.md` |
| **ag-clarifier** | Think | Vague requests, terminology conflicts | Written, user-approved spec |
| **ag-explorer** | Research | Need to understand codebase, find patterns | Structured findings report |
| **ag-architect** | Research / Design | Codebase feels hard to change | Interface designs, seam map |
| **ag-brandkit** | Design | Visual design, brand identity, mockups | Design assets, brand guidelines |
| **ag-prototype** | Design / Build | Answer one question with throwaway code | Runnable prototype + answer |
| **ag-prd** | Plan | Requirements are clear enough for PRD | Published PRD with stories |
| **ag-planner** | Plan | Spec is approved, need tasks | Bite-sized implementation checklist |
| **ag-plan-reviewer** | Plan Review | Plan is written, needs quality gate | CEO/Eng/Design/DX review |
| **ag-builder** | Build | Plan approved, time to execute | Verified, reviewed commits |
| **ag-tdd** | Test / Build | Building features from scratch | Red-green-refactor vertical slices |
| **ag-tester** | Test | Need comprehensive test coverage | Tests + coverage gap analysis |
| **ag-verifier** | Verify | Need fresh verification before claiming | Pass/fail with evidence |
| **ag-reviewer** | Review | Code is written, needs review | Spec compliance + quality issues |
| **ag-feedback-receiver** | Review | Received review feedback | Processed, implemented changes |
| **ag-debugger** | Debug | Need collaborative investigation | Root cause + regression test |
| **ag-griller** | Debug | Complex multi-file bugs, 3-fail rule | Architecture finding or fix |
| **ag-triage** | Process | Incoming issues need routing | State-machine triage |
| **ag-shipper** | Ship | Code is ready to deliver | Merged PR or discarded branch |
| **ag-documenter** | Reflect | Post-ship docs, changelogs | Diataxis docs, ADRs |
| **ag-retro** | Reflect | Sprint end, pattern noticed | Learnings document |
| **ag-skillwriter** | Meta | Gap in AGNES itself to fill | New or refined skill via TDD |

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

## State

AGNES tracks progress via `.agnes/` in any project:

```
.agnes/
├── index.json        Searchable plan index — read once, filter instantly
└── plans/
    ├── plan-001.md       First immutable plan iteration
    ├── plan-002.md       Second iteration (append-only, never edited)
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
bun run bundle      # bundles to .opencode/plugins/agnes.js
bun run typecheck   # type-safety gate
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
