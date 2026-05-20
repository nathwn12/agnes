# Full AGNES Seniorization — Implementation Plan

## Goal: Extract ALL best bits from engineering + superpowers skills into ag-* skills. Overhaul orchestrator with ruthless delegation/swarm ethos.

---

## Part A: Overhaul Existing Skills (4 skills)

### A1. ag-orchestrator — The Swarm Brain

**Current state:** Routing table + 4 bullets + 3 state files. No parallelism ethos.

**Target:** Become a self-activating delegation engine that constantly nudges toward parallelism.

New sections to add:
1. **THE RUTHLESS DELEGATION ETHOS** — The orchestrator NEVER does work directly. Its sole job: route, coordinate, verify. Every discrete unit of work → delegate. If you're writing code, you're doing it wrong.
2. **THE PARALLELISM IMPERATIVE** — Scan every task set for independence. Default to parallel. Sequential only when dependency forces it. While waiting for subagent A → prepare context for subagent B.
3. **THE 1% RULE** — If even 1% chance a skill applies → invoke it. Skill invocation is free; wrong invocation costs nothing; missed invocation costs everything.
4. **THE SWARM NUDGE** — The orchestrator SKILL.md is a loaded reference. Even when not invoked, its instructions (via AGENTS.md) should cause the host to constantly think "can I delegate this? can I parallelize this?"
5. **DECISION FRAMEWORK** — Explicit flowchart: can tasks run in parallel? → independent domains? → shared state? → evidence from earlier tasks needed?
6. **WORK-STEALING** — If a subagent finishes early and more work exists → dispatch it immediately.
7. **ANTI-PATTERNS** — "It's faster if I just do it myself", "This task is too small to delegate", "I'll parallelize later".

Source: dispatching-parallel-agents patterns, subagent-driven-development patterns.

---

### A2. ag-builder — The Parallel Execution Engine

**Current state:** Linear Build → Test → Verify → Review → Commit per task.

**Enhancements:**
1. **Two-stage review** — Separate spec-compliance review from code-quality review. Two different subagents. Never combined.
2. **Four implementer statuses** — DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED. Each has different handler.
3. **Parallel task dispatch** — When tasks are independent, dispatch multiple implementers simultaneously instead of sequentially.
4. **Model selection guidance** — Cheapest model for mechanical work, most capable for architecture decisions.
5. **Subagent prompt structure** — Focused, self-contained, specific about expected output format.
6. **Anti-pattern table** — Too broad scope, no context, no constraints, vague output.

Sources: subagent-driven-development (two-stage review, 4 statuses), dispatching-parallel-agents (flowchart, anti-patterns, when-not-to-use).

---

### A3. ag-clarifier — From Questioner to Full Brainstormer

**Current state:** Socratic questioning only. Asks one question at a time.

**Enhancements:**
1. **Brainstorming workflow** — After initial clarification, propose 2-3 approaches with pros/cons + recommendation. Let user choose.
2. **Visual companion** — Optional browser-based mockup server during brainstorming for UI-heavy tasks.
3. **Spec self-review** — After writing spec: placeholder scan, consistency check, scope check, ambiguity check.
4. **Hard gate** — No implementation until design approved. Even for "simple" projects.
5. **Grill-with-docs patterns** — Glossary-first challenge: when user uses term conflicting with CONTEXT.md, call it out immediately. Sharpen fuzzy language with precise canonical terms. Update CONTEXT.md inline during conversation.
6. **ADR sparingly rules** — Only offer ADR when ALL three: hard to reverse + surprising without context + real trade-off.

Sources: brainstorming (2-3 approaches, visual companion, spec review, hard gate), grill-with-docs (glossary challenge, inline doc updates, ADR rules).

---

### A4. ag-griller — The Hardened Debug Engine

**Current state:** 6-phase adversarial debugging.

**Enhancements:**
1. **3-fail rule** — After 3 hypotheses proven wrong → architecture is wrong, not code. Stop and recommend redesign. Document in learnings.
2. **10 feedback loop strategies** — Ranked by preference: failing test > curl > CLI invocation > headless browser > replay trace > throwaway harness > fuzz > bisection > differential loop > HITL bash script.
3. **HITL bash script template** — Last-resort structured human-in-the-loop debugging with `step()` and `capture()` functions.
4. **Non-deterministic bug techniques** — Loop 100x, parallelize, stress, inject sleeps. 50% flake = debuggable; 1% flake = not.
5. **Rationalization table** — Common excuses ("should work", "passed yesterday", "works on my machine") mapped to counters.
6. **Backward tracing** — Trace data flow backward from symptom through each layer boundary. Add diagnostic instrumentation at each layer.

Sources: diagnose (10 strategies, HITL script, non-deterministic), systematic-debugging (3-fail rule, rationalization table, backward tracing).

---

## Part B: New Skills — Complete Gaps (7 skills)

### B1. ag-architect (was: improve-codebase-architecture)

**Phase:** RESEARCH / DESIGN

**Core:** Find deepening opportunities — refactors that turn shallow modules into deep ones.

Key patterns:
- **8-term precise vocabulary:** Module, Interface, Implementation, Depth, Seam, Adapter, Leverage, Locality. Avoid: component, service, API, boundary.
- **Deletion test:** Imagine deleting the module. If complexity vanishes → pass-through. If reappears across N callers → earning its keep.
- **INTERFACE-DESIGN.md pattern:** "Design It Twice" — frame problem space, spawn 3+ parallel sub-agents with different design constraints, present sequentially then compare.
- **One adapter = hypothetical seam. Two adapters = real seam.**
- **The interface is the test surface.** Callers and tests cross the same seam.

---

### B2. ag-prototype (was: prototype)

**Phase:** DESIGN / BUILD

**Core:** Build throwaway code that answers exactly one question. Two branches.

Two branches:
- **LOGIC branch:** Terminal TUI pushing a state machine through edge cases. Pure logic module + throwaway TUI shell. Logic module can be lifted into production.
- **UI branch:** Radically different UI variations on one route, switchable via `?variant=` param + floating bottom bar.

Key rules:
- State the question explicitly before starting.
- Pick the branch based on question type (logic vs visual).
- One command to run. No persistence. No tests. No polish.
- Surface full state after every action.
- Capture answer, then delete or fold into real code.

---

### B3. ag-tdd (was: tdd — Red-Green-Refactor)

**Phase:** TEST / BUILD

**Core:** Vertical-slice TDD through public interfaces. NOT horizontal (don't write all tests first).

Key patterns:
- **Iron Law:** NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST. Code written before test must be DELETED.
- **RED:** Write one failing test (one behavior, clear name, real code, no mocks unless unavoidable). Watch it fail.
- **GREEN:** Write minimal code to pass. No YAGNI. No over-engineering. Watch it pass.
- **REFACTOR:** Only after all tests pass. Never refactor while RED.
- **Vertical slices:** Each RED→GREEN cycle delivers a complete path through all layers.
- **Mock at system boundaries only:** external APIs, databases, time/randomness, filesystem. Don't mock your own modules.

---

### B4. ag-feedback-receiver (was: receiving-code-review)

**Phase:** REVIEW

**Core:** How to receive and process code review feedback without performative agreement.

The RESPONSE pattern:
1. **READ** — Complete feedback without reacting
2. **UNDERSTAND** — Restate requirement in own words (or ask for clarification)
3. **VERIFY** — Check against codebase reality (is the criticism technically correct?)
4. **EVALUATE** — Technically sound for THIS codebase? (not just theoretically correct)
5. **RESPOND** — Technical acknowledgment or reasoned pushback
6. **IMPLEMENT** — One item at a time, test each

Forbidden: "You're absolutely right!", "Great point!", "Excellent feedback!"
Source-specific handling: Trusted (human partner) vs. External (skeptical but check carefully).
YAGNI check: If reviewer suggests "implementing properly," grep codebase for actual usage first.

---

### B5. ag-skillwriter (was: writing-skills)

**Phase:** REFLECT / META

**Core:** Creating skills IS Test-Driven Development applied to process documentation.

Key patterns:
- **Iron Law:** NO SKILL WITHOUT A FAILING TEST FIRST. Applies to new skills AND edits.
- **RED:** Run pressure scenarios without skill — document baseline behavior verbatim.
- **GREEN:** Write minimal skill addressing specific failures — run scenarios with skill, verify compliance.
- **REFACTOR:** Identify new rationalizations, add explicit counters, re-test until bulletproof.
- **Skill types:** Discipline-enforcing (rigid), Technique (how-to), Pattern (mental models), Reference (documentation).
- **CSO (Claude Search Optimization):** Description = "When to use" NOT "What it does".
- **Token efficiency:** Getting-started <150 words, frequently-loaded <200, others <500.
- **Active naming:** verb-first gerunds (writing-skills, not skill-creation).
- **Bulletproofing:** Close every loophole explicitly, address spirit vs letter, rationalization table, red flags list.

---

### B6. ag-triage (was: triage)

**Phase:** SHIP / PROCESS

**Core:** Issue state machine for managing incoming work through 5 states.

States: unlabeled → needs-triage → needs-info (↻) → ready-for-agent → ready-for-human → wontfix

Key patterns:
- **3 buckets:** Unlabeled (oldest first), needs-triage, needs-info with reporter activity.
- **Agent brief template:** Durable briefs describing interfaces (not file paths), behavioral not procedural, complete acceptance criteria.
- **Out-of-Scope knowledge base:** `.out-of-scope/<concept>.md` for rejected enhancements with substantive reasoning.
- **AI disclaimer:** Every AI-generated comment must start with `> *This was generated by AI during triage.*`

---

### B7. ag-prd (was: to-prd)

**Phase:** PLAN

**Core:** Synthesize conversation context into a Product Requirements Document.

Key patterns:
- **Do NOT interview the user** — just synthesize what you already know.
- **PRD template:** Problem Statement → Solution → User Stories (long numbered list) → Implementation Decisions → Testing Decisions → Out of Scope → Further Notes.
- **Look for deep module opportunities** — modules that encapsulate lots of functionality behind a simple interface.
- **Publish with `ready-for-agent` label** — no additional triage needed.
- **Avoid file paths and code snippets** in decisions (go stale).

---

## Execution Order

```
Phase 1: Orchestrator DNA (the brain)
  └── A1. ag-orchestrator overhaul

Phase 2: New skills (the toolbox) — dispatch in parallel
  ├── B1. ag-architect
  ├── B2. ag-prototype
  ├── B3. ag-tdd
  ├── B4. ag-feedback-receiver
  ├── B5. ag-skillwriter
  ├── B6. ag-triage
  └── B7. ag-prd

Phase 3: Enhanced skills (the upgrades) — dispatch in parallel
  ├── A2. ag-builder enhancement
  ├── A3. ag-clarifier enhancement
  └── A4. ag-griller enhancement
```

Each phase: write → test (verify SKILL.md loads) → commit.
