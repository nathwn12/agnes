<h1 align="center">AGNES — OpenCode Native Plugin</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.16.0-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license">
  <img src="https://img.shields.io/badge/skills-30-orange" alt="30 skills">
  <img src="https://img.shields.io/badge/OpenCode-plugin-purple" alt="OpenCode plugin">
</p>

<p align="center">
  <b>Swarm orchestrator for OpenCode.</b><br>
  Never writes code directly. Delegates relentlessly. Parallelizes by default.
</p>

---

## Install

Add to `opencode.json`:

```json
{
  "plugin": ["agnes@git+https://github.com/nathwn12/agnes.git"]
}
```

Restart OpenCode.

---

## Quick Start

1. Install → restart OpenCode
2. Run `init` in any project → creates `.agnes/` + AGENTS.md
3. Work — every task routes through the pipeline automatically
4. Review — reviewer gate-checks before merge
5. Reflect — retro captures learnings

---

## The 5 Principles

| # | Principle | Meaning |
|---|-----------|---------|
| 1 | **Delegate or Die** | If you write code or think in main context, STOP. Spawn a subagent. |
| 2 | **Wave, Don't Wander** | Each wave: listen → delegate → synthesize → report. Fresh subagents each wave. |
| 3 | **The 1% Rule** | If even 1% chance a skill applies, invoke it. Wrong invocation is free. |
| 4 | **Verify or Void** | Run the command, read the output, then speak. Format: `[Step] → verify: [check]` |
| 5 | **Spend Like It's Yours** | Cheapest sufficient path first. Context is a budget. |

See [EXAMPLES.md](EXAMPLES.md) for behavioral examples of each principle.

---

## Pipeline

Default flow:
1. SETUP → init
2. CLARIFY → clarifier
3. RESEARCH → explorer → architect
4. PLAN → planner + multi-reviewer
5. BUILD → builder/tester
6. VERIFY → verifier → reviewer
7. SHIP → shipper
8. REFLECT → documenter → retro

Side branches: Design (brandkit→prototype), Debug (debugger→griller), Process (triage), Meta (skillwriter)

---

## Skills

| Skill | Phase | Use When |
|-------|-------|----------|
| orchestrator | META | *Always active.* Delegates, parallelizes, coordinates. |
| instinct | META | Cross-session pattern learning. |
| init | SETUP | First AGNES setup in a project. |
| clarifier | THINK | Vague requests, terminology conflicts. |
| explorer | RESEARCH | Understanding unfamiliar code. |
| architect | RESEARCH / DESIGN | Codebase feels hard to change. |
| planner | PLAN | Breaking spec into actionable steps. |
| multi-reviewer | PLAN REVIEW | Multi-axis gate before implementation. |
| prd | PLAN | Formal product requirements. |
| prototype | DESIGN / BUILD | Throwaway code to validate an approach. |
| builder | BUILD | Executing plans with subagent swarms. |
| tdd | TEST / BUILD | Red-green-refactor TDD. |
| tester | TEST | Unit/integration/edge case coverage. |
| verifier | VERIFY | Gate checks before claiming done. |
| reviewer | REVIEW | Code quality, spec compliance. |
| feedback-receiver | REVIEW | Processing code review feedback. |
| debugger | DEBUG | Collaborative bug investigation. |
| griller | DEBUG | Adversarial systematic debugging. |
| shipper | SHIP | PR, merge, deploy. |
| triage | SHIP / PROCESS | Issue state machine management. |
| documenter | REFLECT | Docs, changelog, ADRs. |
| retro | REFLECT | Retrospectives, learnings. |
| skillwriter | REFLECT / META | Creating/refining skills. |
| brandkit | DESIGN | Visual design, brand identity. |

---

## Architecture

AGNES is organized into layered modules in `src/`:
- Protocol → Schema → State → Subagent → Runtime → Plugin
- Middleware, Flow Control, Mutex, Metrics, Shell, Validation, Verification

Bootstrap injects structured identity blocks every session. System prompt sourced from orchestrator SKILL.md.

---

## Development

```bash
bun run bundle        # bundle to .opencode/plugins/agnes.js
bun run lint          # lint source
bun run typecheck     # type safety gate
bun test              # 427+ tests
```

---

## License

MIT
