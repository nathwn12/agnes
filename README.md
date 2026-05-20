# AGNES — OpenCode Native Plugin

AGNES is an orchestrator plugin that routes tasks across 15 fused skills.

## Install

```jsonc
// opencode.jsonc
{
  "plugins": [
    "agnes@git+https://github.com/nathwn12/agnes.git"
  ]
}
```

Restart OpenCode. Skills auto-discover. Everything else is automatic.

### Clear Cached Install

If AGNES was previously installed, clear OpenCode's package cache so the new version loads:

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\opencode\packages\agnes*"
```

## Skills

| Skill | Phase | Use When |
|-------|-------|----------|
| ag-clarifier | THINK | Vague requests, terminology conflicts |
| ag-explorer | RESEARCH | Understanding codebase, dependency research |
| ag-planner | PLAN | Writing specs and implementation plans |
| ag-plan-reviewer | PLAN REVIEW | Reviewing plans (CEO/Eng/Design/DX) |
| ag-builder | BUILD | Executing plans with subagents |
| ag-tester | TEST | Unit, integration, edge case testing |
| ag-verifier | VERIFY | Gate checks, verification evidence |
| ag-reviewer | REVIEW | Code quality, spec compliance |
| ag-debugger | DEBUG | Collaborative investigation |
| ag-griller | DEBUG | Adversarial systematic debugging |
| ag-shipper | SHIP | PR, merge, deploy |
| ag-documenter | REFLECT | Documentation, changelog, ADRs |
| ag-retro | REFLECT | Retrospectives, learnings management |
| ag-brandkit | DESIGN | Visual design, brand identity |

## How It Works

On every conversation, AGNES injects the orchestrator persona via a message transform hook. It tells the agent to use OpenCode's native `skill` tool to discover and load skills, delegate heavy work to subagents via `@mention`, and verify every result. State is tracked via `docs/agnes/goal.md → plan.md → handoff.md`.

## Build

```
bun run build    # bundles to .opencode/plugins/agnes.js
bun run typecheck
```
