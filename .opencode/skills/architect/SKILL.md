---
id: architect
name: architect
description: 'Codebase feels hard to change, modules are tightly coupled, need to find refactoring opportunities that improve testability and AI-navigability.'
phase: "RESEARCH / DESIGN"
use_when: "Codebase feels hard to change, modules are tightly coupled, need to find refactoring opportunities that improve testability and AI-navigability."
version: 1.0
---

## Use When

Codebase feels hard to change, modules are tightly coupled, need to find refactoring opportunities that improve testability and AI-navigability.

## Core Concept

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones, aiming for testability and AI-navigability.

A module that passes the deletion test should be kept; one that fails should be deepened or merged.

Do not introduce a port/interface until at least two implementations are justified. One adapter = hypothetical seam. Two adapters = real seam.

Callers and tests cross the same seam. Tests should use the same interface as production callers, not bypass it.

### The Deletion Test

Imagine deleting the module entirely. If complexity vanishes → it was a **pass-through** (shallow, not earning its keep). If complexity reappears spread across N callers → it was **deep**, earning its keep.

### Seam Rule

One adapter = hypothetical seam. Two adapters = real seam.

Do not introduce a port/interface until at least two implementations are justified.

### The Interface Is the Test Surface

Callers and tests cross the same seam. Tests should use the same interface as production callers, not bypass it.

## Precise Vocabulary

Use these 8 terms. Avoid: component, service, API, boundary (imprecise).

| Term | Definition |
|------|------------|
| Module | A cohesive unit of code with a well-defined responsibility |
| Interface | The public surface another module calls |
| Implementation | The hidden internals behind an interface |
| Depth | Ratio of implementation complexity to interface size (deep = small interface, big implementation) |
| Seam | A place where you can change behavior without changing the module |
| Adapter | A module that translates one interface to another |
| Leverage | How many callers benefit from a single change |
| Locality | Changes to one module don't cascade to others |

## Context Requirements

- Access to the project's domain glossary (`CONTEXT.md`) for precise shared vocabulary
- Existing Architecture Decision Records (`.agnes/adr/`) to understand prior decisions and avoid redundant design loops
- Full codebase read access for friction-point exploration and deletion test application

## Workflow

### 1. Explore

Read `CONTEXT.md` glossary + ADRs first. Use subagent to walk codebase noting friction points. Apply deletion test to candidate modules.

### 2. Present Candidates

Numbered list with: files, problem, solution in plain English, benefits in terms of locality and leverage. Use `CONTEXT.md` vocabulary. Do NOT propose interfaces yet.

### 3. Grilling Loop

Walk design tree with user. Side effects: update `CONTEXT.md`, offer ADRs when user rejects a candidate with load-bearing reason. Explore alternative interfaces via the Interface Design pattern below.

### 4. Interface Design: Design It Twice

1. Frame the problem space
2. Spawn 3+ parallel sub-agents with different design constraints:
   - **Agent 1:** Minimise interface (smallest possible surface area)
   - **Agent 2:** Maximise flexibility
   - **Agent 3:** Optimise for most common caller
   - **Agent 4:** Ports & Adapters (if external dependency)
3. Present designs sequentially, then compare
4. Let the user choose or hybridize

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

## When NOT to Use

- The team is not ready to invest in architectural refactoring or interface design work
- The codebase is scheduled for replacement or deprecation
- Only cosmetic, formatting, or trivial changes are needed without structural impact
- No access to the project's domain glossary or decision records to ground the work
