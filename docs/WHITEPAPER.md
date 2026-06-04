# AGNES Whitepaper

> Swarm orchestrator for OpenCode — 22 skills, parallel by default, one install.

---

## Pipeline

AGNES routes engineering work through a default chronological pipeline. The flow is linear when phases depend on each other, and parallel when work can safely run at the same time. Side skills fire on demand when their trigger conditions are met.

### Default Flow

1. **SETUP** → `init`
2. **CLARIFY** → `clarify` ← **GATE:** spec must be approved
3. **RESEARCH** → `architect` (optional deepening)
4. **PLAN** → `planner` (builtin fast path for lightweight tasks; full planner + `multi-reviewer` for complex work)
5. **BUILD** → `tdd` (new features) → `tester` (coverage)
6. **VERIFY** → `verifier` → `reviewer` ← **GATE:** all checks must pass
7. **SHIP** → `shipper` (PR → merge)
8. **REFLECT** → `documenter` → `retro`

**Gates** block progression until they pass. AGNES uses them to keep high-throughput delegation tied to verified evidence.

### Side Branches

| Branch | Entry Trigger | Skills Used |
|--------|--------------|-------------|
| **Design** | New UI project, need brand identity | brand-designer → prototype → prd |
| **Debug** | Bug report, test failure, crash | debugger → grill-me |
| **Process** | Incoming issue needs triage | triage |
| **Meta** | AGNES is missing a capability | write-skill |

---

## Skills

All 22 bundled skills with concrete trigger conditions and outputs.

| Skill | Phase | When to Use | What It Produces |
|-------|-------|-------------|------------------|
| **instinct** | META | Cross-session context retention and pattern memory | Learned patterns with confidence scores |
| **init** | SETUP | First run or corrupted state files | `.agnes/` directory with `index.json` + `AGENTS.md` |
| **brainstorming** | THINK | Ambiguous creative direction, explore before committing | Design doc, 2-3 proposals, approved spec |
| **clarify** | THINK | Vague or ambiguous requests | Written, user-approved specification |
| **architect** | RESEARCH | Codebase feels hard to change, brittle tests | Seam map, interface proposals, Design It Twice |
| **brand-designer** | DESIGN | Need logo, palette, typography, design system | Brand assets, color system, component mockups |
| **prototype** | DESIGN/BUILD | Validate a design decision with throwaway code | Runnable prototype + documented answer |
| **prd** | PLAN | Requirements need formal capture | Published PRD with stories, AC, priorities |
| **planner** | PLAN | Spec is approved, break into implementation steps | Bite-sized implementation checklist |
| **multi-reviewer** | PLAN REVIEW | Quality gate before implementation starts | Score per lens + verdict |
| **tdd** | TEST/BUILD | Building features from scratch, test-first | Red-green-refactor vertical slices |
| **tester** | TEST | Need comprehensive coverage, fill gaps | Tests + coverage gap report |
| **verifier** | VERIFY | Before claiming done — runs type check, lint, tests, build | Pass/fail evidence log |
| **reviewer** | REVIEW | Code written, tests pass, ready for review | Spec compliance + actionable findings |
| **process-feedback** | REVIEW | Received PR/code review feedback | Categorized feedback + fix plan |
| **debugger** | DEBUG | Bug report, test failure, unclear root cause | Root cause analysis + regression test + fix |
| **grill-me** | DEBUG | debugger failed 3 approaches, multi-module bug | Hypothesis log + architecture finding |
| **triage** | SHIP/PROCESS | Incoming issue needs routing | Validated → labeled → assigned |
| **shipper** | SHIP | Code reviewed, gates pass, ready to deliver | Merged PR or discarded branch |
| **documenter** | REFLECT | Code landed, needs docs or ADRs | Diataxis docs + ADRs + changelog |
| **retro** | REFLECT | Sprint done or pattern keeps repeating | Learnings → `.agnes/learnings/` |
| **write-skill** | REFLECT/META | Missing capability or skill needs refinement | New/refined SKILL.md + tests |

---

## Architecture

| Layer | Module | Purpose |
|-------|--------|---------|
| **Protocol** | `src/protocol.ts` | Typed messages (task, result, error, status, completion) |
| **Schema** | `src/schema.ts` | Self-describing skill contracts, execution-artifact schemas |
| **Bootstrap** | `src/bootstrap.ts` | Agent injection — plan context, shell env, structured blocks |
| **Plugin** | `src/plugin.ts` | OpenCode entry point — plugin registration, config |
| **Runtime** | `src/runtime.ts` | Execution-outcome contract, retry budgets, wave dispatch |
| **Shell** | `src/shell.ts` | Shell detection — pwsh/bash/cmd/msys |
| **State** | `src/state.ts` | Plan state machine — CRUD, retention, session tracking |
| **Verification** | `src/verification.ts` | Structured gates (PASS/FAIL/SKIP), blocking short-circuit |
| **Validation** | `src/validation.ts` | Allowlist-based message validation, injection protection |
| **Discovery** | `src/discovery.ts` | Scans 3 layers (bundled/global/workspace) for skills |
| **Model Routing** | `src/model-routing.ts` | Routes agents to specific models via config |
| **Compaction** | `src/compaction.ts` | Token-count evaluation for session compaction |

---

## Ethos

| Principle | Meaning |
|-----------|---------|
| **Coordinator coordinates** | AGNES routes, merges, and reports. Subagents execute. |
| **Parallelize by default** | Scan every task set for independence. Sequential is the exception. |
| **Specialize every task** | Match each work item to the role with the right context and tools. |
| **Verify before claiming** | Run the command. Read the output. Then speak. |
| **Scarcity** | Cheapest sufficient path — shallow-first, context as budget. |
| **Work-steal** | Subagent finished early? Dispatch it with the next task immediately. |
| **Promise-driven execution** | Tracks progress via promise tags, detects struggle patterns. |
| **Contract assertions** | Evidence-backed Definition of Done. No partial credit. |
| **Direct when simple** | Simple question? Answer directly. No delegation overhead. |
| **Tool routing** | Read → @explore. Write → @general. Danger → Ask user. |

---

## State

AGNES tracks progress via `.agnes/` in any project:

```
.agnes/
├── index.json         Searchable plan index
├── sessions.json      Session state (attempts, struggle, retry counts)
└── plans/
    ├── plan-001.yaml  Immutable plan iteration
    └── ...
```

Plan files are immutable — every state change creates a new `plan-NNN.yaml`. Search by project/status through `index.json`.

### Retention

Completed and abandoned plans auto-prune after 7 days. Override per-project in `index.json`:

```json
{
  "retention": { "maxAgeDays": 3, "terminalStatuses": ["done", "abandoned"] }
}
```

---

## Development

```bash
bun run bundle        # bundle to .opencode/plugins/agnes.js
bun run bundle:watch  # watch mode
bun run lint          # lint source
bun run lint:fix      # auto-fix
bun run typecheck     # type safety gate
bun test              # 473 tests across 15 suites
```

### Tech

- Runtime: Bun
- Language: TypeScript (strict)
- Deps: yaml + zod + @opencode-ai/plugin
- Lint: ESLint 10
- Build: Single-file bundle via `bun build --target bun`

---

## Troubleshooting

### Clear cached installation

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
