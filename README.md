<h1 align="center">AGNES — OpenCode Native Plugin</h1>

<p align="center">
  <b>Swarm intelligence for OpenCode.</b><br>
  Routes tasks across 22 fused skills. Delegates relentlessly. Parallelizes by default.
</p>

---

## Install

Add to your `opencode.jsonc`:

```jsonc
{
  "plugins": [
    "agnes@git+https://github.com/nathwn12/agnes.git"
  ]
}
```

Restart OpenCode. Skills auto-discover. Everything else is automatic.

> **Previously installed?** Clear the cache so the new version loads:
> ```powershell
> Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\opencode\packages\agnes*"
> ```

---

## Pipeline

```
Clarify → Research → Architect → Plan → Build → Test → Review → Ship → Reflect
```

Each phase owns a set of skills. Work flows left to right. When blocked, loops back.

### 1. Clarify

| Skill | Trigger |
|-------|---------|
| **ag-clarifier** | Vague requests, terminology conflicts, before any significant work |

Socratic questioning to build shared understanding. One question at a time. Sharpens fuzzy language against the project glossary.

### 2. Research

| Skill | Trigger |
|-------|---------|
| **ag-explorer** | Need to understand codebase, find patterns, trace dependencies |

Read-only codebase exploration. Produces structured findings reports. Never modifies files.

### 3. Architect

| Skill | Trigger |
|-------|---------|
| **ag-architect** | Codebase feels hard to change, modules are tightly coupled, need deepening |

Applies the deletion test to find shallow modules. Uses Design It Twice pattern with parallel sub-agents to find the best interface.

### 4. Design & Plan

| Skill | Trigger |
|-------|---------|
| **ag-brandkit** | Visual design, brand identity, mockups, logos |
| **ag-prototype** | Need to answer one question with throwaway code |
| **ag-prd** | Requirements are clear enough to write product requirements |
| **ag-planner** | Spec is approved, need bite-sized implementation tasks |
| **ag-plan-reviewer** | Plan is written, needs CEO/Eng/Design/DX quality gate |

Design before code. Plans before builds. Every plan passes a multi-lens review before a single line of implementation code is written.

### 5. Build

| Skill | Trigger |
|-------|---------|
| **ag-builder** | Plan is approved, time to execute with subagent swarms |
| **ag-tdd** | Building features from scratch — red-green-refactor discipline |
| **ag-tester** | Need comprehensive test coverage (unit, integration, edge, regression) |

Builds in isolated worktrees. Two-stage review after every task (spec compliance then code quality). Four implementer statuses: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED.

### 6. Review & Verify

| Skill | Trigger |
|-------|---------|
| **ag-verifier** | Need fresh verification evidence before making claims |
| **ag-reviewer** | Code is written, needs spec compliance + quality review |
| **ag-feedback-receiver** | Received review feedback, need to process it correctly |

Iron Law: No completion claims without fresh verification evidence. Run the gate (typecheck → lint → test → build) before speaking.

### 7. Debug

| Skill | Trigger |
|-------|---------|
| **ag-debugger** | Need collaborative investigation with the user |
| **ag-griller** | Complex multi-file bugs, recurring issues, ag-debugger stalled |

3-fail rule: after 3 hypotheses proven wrong, the architecture is wrong, not the code. Stop and recommend redesign.

### 8. Ship

| Skill | Trigger |
|-------|---------|
| **ag-triage** | Incoming issues need state-machine management |
| **ag-shipper** | Code is ready — merge locally, push + PR, keep, or discard |

Four options: merge, push+PR, keep branch, discard (requires typed confirmation). Never force-push. Never delete without consent.

### 9. Reflect

| Skill | Trigger |
|-------|---------|
| **ag-documenter** | Post-ship docs, changelog, ADRs, Diataxis framework |
| **ag-retro** | End of sprint, feature shipped, pattern noticed — capture learnings |
| **ag-skillwriter** | Gap identified in AGNES itself — create or refine a skill via TDD |

Documentation is not an afterthought — it's a phase. Every ship triggers doc updates. Every pattern is captured. AGNES improves itself via skill TDD.

---

## Swarm Ethos

AGNES is a swarm intelligence. These principles override everything:

| Principle | Meaning |
|-----------|---------|
| **Delegate or die** | If you're writing code directly, STOP. Spawn a subagent. |
| **Parallelize by default** | Scan every task set for independence. Sequential is the exception. |
| **1% Rule** | If even 1% chance a skill applies, invoke it. Wrong invocation costs nothing. |
| **Verify before claiming** | Run the command. Read the output. Then speak. |
| **Work-steal** | Subagent finished early? Dispatch it with the next task immediately. |

---

## State Management

```
docs/agnes/
├── goal.md           One sentence. Re-read before delegating.
├── plan.md           Checklist. Tick done, note blockers.
├── handoff.md        Stuck: 3 fails or external blocker. Then stop.
├── specs/            Design specifications (phase: plan)
├── plans/            Implementation plans (phase: build)
├── prd/              Product requirements documents (phase: plan)
├── architecture/     Deepening recommendations (phase: architect)
└── learnings/        Retrospectives and captured patterns (phase: reflect)
```

---

## Build

```bash
bun run build       # bundles to .opencode/plugins/agnes.js
bun run typecheck   # type-safety gate
```
