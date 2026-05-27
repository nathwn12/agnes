---
id: architect
name: architect
description: 'Codebase feels hard to change, modules are tightly coupled, need to find refactoring opportunities that improve testability and AI-navigability.'
phase: "RESEARCH / DESIGN"
use_when: "Codebase feels hard to change, modules are tightly coupled, need to find refactoring opportunities that improve testability and AI-navigability."
version: 1.1
---

# Architect

**Tradeoff:** Architectural deepening cuts change-cost long-term but costs velocity now — invest only in modules with high churn or high caller-count.

## Core Concept

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones, aiming for testability and AI-navigability.

### The Deletion Test

Delete the module. Complexity vanishes? **Pass-through** (shallow, not earning its keep). Complexity reappears spread across N callers? **Deep**, earning its keep.

### Seam Rule

One adapter = hypothetical seam. Two adapters = real seam. No port/interface until at least two implementations justified.

### The Interface Is the Test Surface

Callers and tests cross the same seam. Tests use the same interface as production callers. Old unit tests on shallow modules become waste once tests at deepened module's interface exist — delete them.

## Precise Vocabulary

Use these 8 terms. Avoid: component, service, API, boundary (imprecise).

| Term | Definition |
|------|------------|
| Module | A cohesive unit of code with a well-defined responsibility (function, class, package, slice) |
| Interface | Everything a caller must know to use the module: types, invariants, error modes, ordering, config |
| Implementation | The hidden internals behind an interface |
| Depth | Leverage at the interface — how much behaviour per unit of interface a caller must learn |
| Seam | A place where you can alter behaviour without editing in that place |
| Adapter | A concrete thing that satisfies an interface at a seam |
| Leverage | How many callers benefit from a single change; what callers get from depth |
| Locality | Changes, bugs, and knowledge concentrate in one place rather than spreading across callers |

Depth is a property of the interface, not the implementation.

## Context Requirements

- Project domain glossary (`CONTEXT.md`) for precise shared vocabulary
- Existing Architecture Decision Records (`.agnes/adr/`) to avoid redundant design loops
- Full codebase read access for friction-point exploration and deletion test application

## Workflow

### 1. Explore

Read `CONTEXT.md` glossary + ADRs. Use subagent to walk codebase noting friction points. Apply deletion test to candidate modules. Note where understanding requires bouncing between many small modules, where modules are shallow, where pure functions extracted just for testability but real bugs hide in how they're called, where tightly-coupled modules leak across seams. → verify: shallow/deep classification clear per candidate

**Output:** Candidate module list with deletion-test verdicts.

### 2. Present Candidates

Numbered list with: files, problem, solution in plain English, benefits in terms of locality and leverage. Use `CONTEXT.md` vocabulary. Do NOT propose interfaces yet. Each candidate includes recommendation strength: Strong, Worth exploring, or Speculative. → verify: each candidate has strength label

**Output:** Prioritized candidate list ready for grilling.

### 3. Grilling Loop

Walk design tree with user. Side effects: update `CONTEXT.md`, offer ADRs when user rejects a candidate with load-bearing reason. Skip ephemeral reasons ("not worth it right now") and self-evident ones. Explore alternative interfaces via the Interface Design pattern. Name a deepened module after a concept not in `CONTEXT.md`? Add the term there. Sharpening a fuzzy term? Update inline. → verify: vocabulary decisions captured in `CONTEXT.md`

**Output:** Refined candidates + updated glossary + ADRs for load-bearing rejections.

### 4. Interface Design: Design It Twice

1. Frame problem space — user-facing explanation of constraints, dependencies, and dependency category (in-process, local-substitutable, remote-but-owned, true-external)
2. Spawn 3+ parallel subagents with different design constraints:
   - **Agent 1:** Minimise interface (1-3 entry points max)
   - **Agent 2:** Maximise flexibility
   - **Agent 3:** Optimise for most common caller
   - **Agent 4:** Ports & Adapters (if cross-seam dependency)
3. Each outputs: interface (types, methods, params + invariants), usage example, what implementation hides, dependency strategy, trade-offs
4. Present sequentially, compare by depth, locality, seam placement → verify: each design has documented tradeoffs
5. Give opinionated recommendation — strong read, not a menu

**Output:** Interface design with comparison and recommendation.

### 5. Deepening Execution

Classify each candidate's dependencies to determine testing strategy:
- **In-process** (pure computation, no I/O): Merge modules, test through new interface. No adapter.
- **Local-substitutable** (PGLite, in-memory FS): Deepen with stand-in. Seam stays internal.
- **Remote but owned** (microservices, internal APIs): Define port at seam. Production gets HTTP/gRPC adapter; tests use in-memory.
- **True external** (Stripe, Twilio): Inject port; tests provide mock adapter.

Delete old shallow-module tests. Write new tests at deepened module's interface. → verify: new tests pass, old deleted tests removed from codebase

**Output:** Deepened modules + updated tests + any new ADRs.

```
[codebase] → [explore] → [candidates] → [grill] → [design] → [execute] → [deeper modules]
                                                  ↑        │
                                                  └─ reject┘
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| read (source files) | Explore | File paths | Friction points |
| grep | Explore | Pattern | Matching code locations |
| subagent (task) | Explore, Design | Task scope | Parallel analyses / interface designs |
| write | Execute | Deepening document content | `.agnes/architecture/YYYY-MM-DD-<topic>-deepening.md` |
| edit | Grill, Execute | CONTEXT.md / ADR changes | Updated glossary / new ADR |
| question | Grill | Design questions | User decisions |
| skill (planner, documenter) | Execute | Skill name | Supplementary domain guidance |

## Examples

| Scenario | Phase(s) | Approach |
|----------|----------|----------|
| Payment processing spans 6 files, 3 callers duplicate retry logic | Explore → Candidates | Apply deletion test, identify shallow orchestrator module, propose merge |
| Auth module has mock interface but only one implementation | Design | Apply Seam Rule — remove mock until second adapter emerges |
| Reporting module requires reading 5 tiny files to trace one feature | Explore → Execute | Identify cohesion gap, merge into deeper ReportEngine, test through new interface |
| Team debates cache abstraction vs direct Redis calls | Design | Spawn 4 design agents: minimal surface, flexible, caller-optimised, ports-and-adapters. Compare by depth and locality |

## Output

`.agnes/architecture/YYYY-MM-DD-<topic>-deepening.md`

## Quality Criteria

- [ ] Deepening candidates evaluated via Deletion Test before being proposed → verify: shallow/deep verdict present per candidate
- [ ] Interfaces follow Seam Rule: no ports until two implementations justified → verify: each proposed interface has ≤1 or ≥2 adapters documented
- [ ] Test surface aligns with public interface, not implementation details → verify: no tests import private/package-internals
- [ ] Precise Vocabulary used consistently; vague terms (component, service, API, boundary) absent → verify: grep for banned terms in deliverables
- [ ] ADRs created for load-bearing candidate rejections or design decisions → verify: rejection rationale captured in standalone ADR
- [ ] `CONTEXT.md` updated to reflect decisions and vocabulary refinements from grilling loop → verify: diff shows glossary changes inline
- [ ] Dependency categories classified before deepening execution begins → verify: every candidate has dependency category label

## Protocol Shells

All architectural analysis follows the protocol shell format:

```
/protocol {
  intent="Analyze codebase for structural improvements",
  input={ codebase="<target>", concern="<coupling|testability|cohesion>" },
  process=[ /abstract{patterns}, /compare{alternatives}, /synthesize{recommendation} ],
  output={ result="<architecture-report>", files="<refactoring-candidates>" }
}
```

## Cognitive Tools

| Tool | When | Use |
|------|------|-----|
| /abstract | Explore | Extract coupling patterns from multiple modules |
| /compare | Design | Evaluate refactoring alternatives against depth, locality, seam placement |
| /synthesize | Execute | Combine observations into actionable recommendations |

## When NOT to Use

- Team not ready to invest in architectural refactoring or interface design work
- Codebase scheduled for replacement or deprecation
- Only cosmetic, formatting, or trivial changes without structural impact
- No access to project's domain glossary or decision records
