---
id: architect
name: architect
description: 'Codebase feels hard to change, modules are tightly coupled, need to find refactoring opportunities that improve testability and AI-navigability.'
phase: "RESEARCH / DESIGN"
use_when: "Codebase feels hard to change, modules are tightly coupled, need to find refactoring opportunities that improve testability and AI-navigability."
version: 1.1
---

## Use When

Codebase feels hard to change, modules are tightly coupled, need to find refactoring opportunities that improve testability and AI-navigability.

## Core Concept

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones, aiming for testability and AI-navigability. A module that passes the deletion test should be kept; one that fails should be deepened or merged.

Do not introduce a port/interface until at least two implementations are justified. One adapter = hypothetical seam. Two adapters = real seam. Callers and tests cross the same seam. Tests should use the same interface as production callers, not bypass it.

### The Deletion Test

Imagine deleting the module entirely. If complexity vanishes → it was a **pass-through** (shallow, not earning its keep). If complexity reappears spread across N callers → it was **deep**, earning its keep. This filters out noise before any design work begins.

### Seam Rule

One adapter = hypothetical seam. Two adapters = real seam. Do not introduce a port/interface until at least two implementations are justified. A single-adapter seam is just indirection.

### The Interface Is the Test Surface

Callers and tests cross the same seam. Tests should use the same interface as production callers, not bypass it. If you want to test past the interface, the module is probably the wrong shape. Old unit tests on shallow modules become waste once tests at the deepened module's interface exist — delete them.

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

Depth is a property of the interface, not the implementation. A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface.

## Context Requirements

- Access to the project's domain glossary (`CONTEXT.md`) for precise shared vocabulary
- Existing Architecture Decision Records (`.agnes/adr/`) to understand prior decisions and avoid redundant design loops
- Full codebase read access for friction-point exploration and deletion test application

## Workflow

### 1. Explore

Read `CONTEXT.md` glossary + ADRs first. Use subagent to walk codebase noting friction points. Apply deletion test to candidate modules. Explore organically — don't follow rigid heuristics. Note where understanding one concept requires bouncing between many small modules, where modules are shallow (interface nearly as complex as implementation), where pure functions were extracted just for testability but real bugs hide in how they're called, and where tightly-coupled modules leak across their seams.

### 2. Present Candidates

Numbered list with: files, problem, solution in plain English, benefits in terms of locality and leverage. Use `CONTEXT.md` vocabulary. Do NOT propose interfaces yet. Each candidate includes recommendation strength: Strong, Worth exploring, or Speculative.

### 3. Grilling Loop

Walk design tree with user. Side effects: update `CONTEXT.md`, offer ADRs when user rejects a candidate with load-bearing reason. Only offer ADRs when the reason would actually prevent re-suggesting the same thing — skip ephemeral reasons ("not worth it right now") and self-evident ones.

Explore alternative interfaces via the Interface Design pattern below. Naming a deepened module after a concept not in `CONTEXT.md`? Add the term to `CONTEXT.md` right there. Sharpening a fuzzy term during conversation? Update `CONTEXT.md` inline.

### 4. Interface Design: Design It Twice

1. Frame the problem space — write a user-facing explanation of constraints, dependencies, and dependency category (in-process, local-substitutable, remote-but-owned, true-external)
2. Spawn 3+ parallel sub-agents with different design constraints:
   - **Agent 1:** Minimise interface (smallest possible surface area, 1-3 entry points max)
   - **Agent 2:** Maximise flexibility (support many use cases and extension)
   - **Agent 3:** Optimise for most common caller (make the default case trivial)
   - **Agent 4:** Ports & Adapters (if cross-seam dependency)
3. Each agent outputs: interface (types, methods, params plus invariants), usage example, what the implementation hides, dependency strategy, trade-offs
4. Present designs sequentially, then compare by depth, locality, and seam placement
5. Give your own recommendation — be opinionated, the user wants a strong read not a menu

### 5. Deepening Execution

Classify each candidate's dependencies to determine testing strategy:
- **In-process** (pure computation, no I/O): Merge the modules, test through the new interface. No adapter needed.
- **Local-substitutable** (PGLite, in-memory FS): Deepen with the stand-in. Seam stays internal.
- **Remote but owned** (microservices, internal APIs): Define a port at the seam. Production gets an HTTP/gRPC adapter; tests use in-memory.
- **True external** (Stripe, Twilio): Take as injected port; tests provide mock adapter.

Old unit tests on shallow modules become waste once tests at the deepened module's interface exist — delete them. Write new tests at the deepened module's interface. Tests must survive internal refactors — they describe behaviour, not implementation.

## Tool Requirements

- File read access for codebase exploration and CONTEXT.md / ADR review
- grep for pattern-based searching across the codebase
- Subagent (task) spawning for parallel codebase exploration and interface design
- write for creating deepening documents and ADR proposals
- edit for updating CONTEXT.md in response to design decisions
- question for interactive grilling and design tree navigation
- skill loading for supplementary skills (e.g., planner, documenter)

## Output

Write to `.agnes/architecture/YYYY-MM-DD-<topic>-deepening.md`

## Quality Criteria

- Deepening candidates are evaluated via the Deletion Test before being proposed
- Interfaces follow the Seam Rule: no ports introduced until two implementations are justified
- Test surface aligns with the public interface, not with implementation details
- Precise Vocabulary terms used consistently; vague terms (component, service, API, boundary) avoided
- ADRs are created for any load-bearing rejection of a candidate or design decision
- `CONTEXT.md` is updated to reflect decisions and vocabulary refinements from the grilling loop
- Dependency categories are classified before deepening execution begins

## When NOT to Use

- The team is not ready to invest in architectural refactoring or interface design work
- The codebase is scheduled for replacement or deprecation
- Only cosmetic, formatting, or trivial changes are needed without structural impact
- No access to the project's domain glossary or decision records to ground the work

## Protocol Shells

All architectural analysis follows the protocol shell format:

/protocol {
  intent="Analyze codebase for structural improvements",
  input={ codebase="<target>", concern="<coupling|testability|cohesion>" },
  process=[ /abstract{patterns}, /compare{alternatives}, /synthesize{recommendation} ],
  output={ result="<architecture-report>", files="<refactoring-candidates>" }
}

## Cognitive Tools

| Tool | When |
|------|------|
| /abstract | Extract coupling patterns from multiple modules |
| /compare | Evaluate refactoring alternatives against criteria |
| /synthesize | Combine observations into actionable recommendations |
