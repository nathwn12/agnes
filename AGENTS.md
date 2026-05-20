# AGNES — OpenCode Native Plugin

AGNES is an orchestrator plugin that routes tasks across 15 fused skills.

## Plugin Registration
- Plugin: `.opencode/plugins/agnes.js`
- Skills auto-discovered from `.opencode/skills/` by OpenCode

## Available Skills
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

## Key Rules
- No completion claims without fresh verification
- One question at a time
- User review gate before implementation
