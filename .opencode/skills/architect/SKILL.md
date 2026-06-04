---
id: architect
name: architect
description: 'Codebase feels hard to change, modules are tightly coupled, need to find refactoring opportunities that improve testability and AI-navigability.'
phase: "RESEARCH / DESIGN"
use_when: "Codebase feels hard to change, modules are tightly coupled, need to find refactoring opportunities that improve testability and AI-navigability."
version: 1.1
---

## Use When

Codebase feels hard to change, modules tightly coupled, need refactoring for testability and AI-navigability.

## Core Concept

Surface architectural friction, propose **deepening opportunities** — refactors turning shallow modules deep. Module passing deletion test → keep; failing → deepen or merge.

No port/interface until ≥2 implementations justified. One adapter = hypothetical seam. Two adapters = real seam. Callers and tests cross same seam. Tests use same interface as production callers.

### The Deletion Test

Delete module entirely. Complexity vanishes → **pass-through** (shallow). Complexity reappears across N callers → **deep**. Filters noise before design.

### Seam Rule

One adapter = hypothetical seam. Two adapters = real seam. Single-adapter seam is indirection.

### The Interface Is the Test Surface

Callers and tests cross same seam. Tests use same interface as production callers. Test bypasses interface → module shape wrong. Old unit tests on shallow modules become waste once deepened module interface tests exist — delete.

## Precise Vocabulary

Use these 8 terms. Avoid: component, service, API, boundary.

| Term | Definition |
|------|-----------|
| Module | Cohesive code unit with defined responsibility (function, class, package, slice) |
| Interface | Everything caller must know: types, invariants, error modes, ordering, config |
| Implementation | Hidden internals behind interface |
| Depth | Behaviour per unit of interface caller must learn |
| Seam | Place where you alter behaviour without editing there |
| Adapter | Concrete thing satisfying interface at seam |
| Leverage | How many callers benefit from single change |
| Locality | Changes, bugs, knowledge concentrate in one place |

Depth is interface property, not implementation. Deep module can have internal seams (private to impl, used by own tests) plus external seam at interface.

## Context Requirements

- Access to project domain glossary (`CONTEXT.md`)
- Existing ADRs (`.agnes/adr/`) to understand prior decisions
- Full codebase read access for friction-point exploration

## Workflow

### 1. Explore

Read `CONTEXT.md` glossary + ADRs first. Subagent walks codebase noting friction points. Apply deletion test. Explore organically. Note where understanding requires bouncing between small modules, modules are shallow (interface ≈ implementation), pure functions extracted for testability but bugs hide in how called, tightly-coupled modules leak across seams.

### 2. Present Candidates

Numbered list: files, problem, solution in plain English, benefits (locality, leverage). Use `CONTEXT.md` vocabulary. No interfaces yet. Recommendation: Strong, Worth exploring, Speculative.

### 3. Grilling Loop

Walk design tree with user. Side effects: update `CONTEXT.md`, offer ADRs when user rejects candidate with load-bearing reason. Skip ephemeral ("not worth it now") or self-evident.

Explore alternative interfaces via Design It Twice. Naming deepened module after concept not in `CONTEXT.md`? Add term there. Sharpening fuzzy term? Update `CONTEXT.md` inline.

### 4. Interface Design: Design It Twice

1. Frame problem — write user-facing explanation of constraints, dependencies, category (in-process, local-substitutable, remote-but-owned, true-external)
2. Spawn 3+ parallel sub-agents:
   - **Agent 1:** Minimise interface (smallest surface, 1-3 entry points)
   - **Agent 2:** Maximise flexibility (many use cases, extension)
   - **Agent 3:** Optimise for most common caller (make default trivial)
   - **Agent 4:** Ports & Adapters (if cross-seam dependency)
3. Each outputs: interface (types, methods, params + invariants), usage example, what impl hides, dependency strategy, trade-offs
4. Present sequentially, compare by depth, locality, seam placement
5. Give recommendation — be opinionated

### 5. Deepening Execution

Classify each candidate's dependencies for testing strategy:
- **In-process** (pure computation, no I/O): Merge modules, test through new interface. No adapter.
- **Local-substitutable** (PGLite, in-memory FS): Deepen with stand-in. Seam stays internal.
- **Remote but owned** (microservices, internal APIs): Define port at seam. Production gets HTTP/gRPC adapter; tests use in-memory.
- **True external** (Stripe, Twilio): Injected port; tests provide mock adapter.

Old unit tests on shallow modules become waste once deepened module interface tests exist — delete. Write new tests at deepened module interface. Tests describe behaviour, not implementation.

## Tool Requirements

- File read for codebase exploration, CONTEXT.md / ADR review
- grep for pattern-based search
- Subagent (task) spawning for parallel exploration and interface design
- write for deepening documents and ADR proposals
- edit for updating CONTEXT.md
- question for interactive grilling
- skill loading for supplementary skills

## Output

Write to `.agnes/architecture/YYYY-MM-DD-<topic>-deepening.md`

## Quality Criteria

- Candidates evaluated via Deletion Test before proposal
- Interfaces follow Seam Rule: no ports until two implementations justified
- Test surface aligns with public interface, not implementation details
- Precise Vocabulary used consistently; vague terms avoided
- ADRs created for load-bearing rejections
- `CONTEXT.md` updated from grilling loop
- Dependency categories classified before deepening execution

## When NOT to Use

- Team not ready for architectural refactoring
- Codebase scheduled for replacement
- Only cosmetic/trivial changes needed
- No access to domain glossary or decision records
