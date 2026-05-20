<h1 align="center">AGNES — OpenCode Native Plugin</h1>

<p align="center">
  <b>Swarm intelligence for OpenCode.</b><br>
  Routes tasks across 23 fused skills. Delegates relentlessly. Parallelizes by default.
</p>

---

## Install

Add to your `opencode.json`:

```json
{
  "plugin": [
    "agnes@git+https://github.com/nathwn12/agnes.git"
  ]
}
```

Restart OpenCode. AGNES injects its bootstrap and registers its bundled skills automatically.

> **Previously installed?** Clear AGNES from OpenCode's package cache, then restart:
> ```powershell
> Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\opencode\packages\agnes@git+https_*"
> ```

---

<details>
<summary><b>0. Setup</b></summary>

| Skill | Trigger |
|-------|---------|
| **ag-init** | First run in a project, or need to refresh state files / AGENTS.md |

Creates `docs/agnes/` with four convention files and writes/updates `AGENTS.md` at the project root.
</details>

## Pipeline

```
Clarify → Research → Architect → Plan → Build → Test → Review → Ship → Reflect
```

Work flows left to right. When blocked, loops back.

<details>
<summary><b>1. Clarify</b></summary>

| Skill | Trigger |
|-------|---------|
| **ag-clarifier** | Vague requests, terminology conflicts, before any significant work |

Socratic questioning to build shared understanding. One question at a time.
</details>

<details>
<summary><b>2. Research</b></summary>

| Skill | Trigger |
|-------|---------|
| **ag-explorer** | Need to understand codebase, find patterns, trace dependencies |

Read-only codebase exploration. Produces structured findings reports.
</details>

<details>
<summary><b>3. Architect</b></summary>

| Skill | Trigger |
|-------|---------|
| **ag-architect** | Codebase feels hard to change, modules are tightly coupled, need deepening |

Applies the deletion test. Uses Design It Twice pattern with parallel sub-agents.
</details>

<details>
<summary><b>4. Design & Plan</b></summary>

| Skill | Trigger |
|-------|---------|
| **ag-brandkit** | Visual design, brand identity, mockups, logos |
| **ag-prototype** | Need to answer one question with throwaway code |
| **ag-prd** | Requirements are clear enough to write product requirements |
| **ag-planner** | Spec is approved, need bite-sized implementation tasks |
| **ag-plan-reviewer** | Plan is written, needs CEO/Eng/Design/DX quality gate |

Design before code. Plans before builds.
</details>

<details>
<summary><b>5. Build</b></summary>

| Skill | Trigger |
|-------|---------|
| **ag-builder** | Plan is approved, time to execute with subagent swarms |
| **ag-tdd** | Building features from scratch — red-green-refactor discipline |
| **ag-tester** | Need comprehensive test coverage |

Builds in isolated worktrees. Two-stage review after every task.
</details>

<details>
<summary><b>6. Review & Verify</b></summary>

| Skill | Trigger |
|-------|---------|
| **ag-verifier** | Need fresh verification evidence before making claims |
| **ag-reviewer** | Code is written, needs spec compliance + quality review |
| **ag-feedback-receiver** | Received review feedback, need to process it correctly |

Iron Law: No completion claims without fresh verification evidence.
</details>

<details>
<summary><b>7. Debug</b></summary>

| Skill | Trigger |
|-------|---------|
| **ag-debugger** | Need collaborative investigation with the user |
| **ag-griller** | Complex multi-file bugs, recurring issues, ag-debugger stalled |

3-fail rule: after 3 hypotheses proven wrong, the architecture is wrong, not the code.
</details>

<details>
<summary><b>8. Ship</b></summary>

| Skill | Trigger |
|-------|---------|
| **ag-triage** | Incoming issues need state-machine management |
| **ag-shipper** | Code is ready — merge locally, push + PR, keep, or discard |

Four options: merge, push+PR, keep branch, discard.
</details>

<details>
<summary><b>9. Reflect</b></summary>

| Skill | Trigger |
|-------|---------|
| **ag-documenter** | Post-ship docs, changelog, ADRs, Diataxis framework |
| **ag-retro** | End of sprint, feature shipped, pattern noticed — capture learnings |
| **ag-skillwriter** | Gap identified in AGNES itself — create or refine a skill via TDD |

Documentation is not an afterthought. Every ship triggers doc updates.
</details>

---

<details>
<summary><b>Swarm Ethos</b></summary>

| Principle | Meaning |
|-----------|---------|
| **Delegate or die** | If you're writing code directly, STOP. Spawn a subagent. |
| **Parallelize by default** | Scan every task set for independence. Sequential is the exception. |
| **1% Rule** | If even 1% chance a skill applies, invoke it. Wrong invocation costs nothing. |
| **Verify before claiming** | Run the command. Read the output. Then speak. |
| **Work-steal** | Subagent finished early? Dispatch it with the next task immediately. |

</details>

<details>
<summary><b>State Management</b></summary>

```
docs/agnes/
├── plans/            Implementation plans
├── goal.md           Completion condition, re-read before each wave
├── plan.md           Three-status checklist linked to goal
├── session.md        Smart zone, compaction, clearing, handoff decisions
├── handoff.md        Session state for next agent or later continuation
├── specs/            (planned)
├── prd/              (planned)
├── architecture/     (planned)
└── learnings/        (planned)
```
</details>

<details>
<summary><b>Build</b></summary>

```bash
bun run bundle      # bundles to .opencode/plugins/agnes.js
bun run typecheck   # type-safety gate
```
</details>
