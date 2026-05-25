---
id: prd
name: prd
description: 'A feature request has been discussed enough to write requirements, before detailed implementation planning begins.'
phase: "PLAN"
use_when: "A feature request has been discussed enough to write requirements, before detailed implementation planning begins."
version: 1.1
---

## Use When

A feature request has been discussed enough to write requirements, before detailed implementation planning begins. Distinct from planner (which writes implementation specs) — this captures the WHAT and WHY, not the HOW.

## Core Concept

Synthesize what you already know into a structured PRD. Do NOT interview the user for more information — work from existing context. If context is insufficient, the PRD will reflect that with open questions.

The PRD captures product requirements: what needs to be built and why. Implementation details (file paths, code snippets, exact APIs) belong in the planner phase.

## Precise Vocabulary

- **PRD (Product Requirements Document):** A structured document capturing what needs to be built and why, distinct from implementation specs
- **ready-for-agent label:** Issue tracker label indicating no additional triage needed
- **deep module:** A module that encapsulates rich functionality behind a simple, testable interface that rarely changes
- **shallow module:** A module whose interface is as complex as its implementation — harder to test, more coupled
- **Implementation Decisions:** Architecture constraints and technology choices that constrain implementation, not implementation details like file paths or code
- **User Stories:** Structured requirements from an actor's perspective following the pattern "As a [actor], I want [feature] so that [benefit]"
- **Vertical slice:** A thin end-to-end path through all integration layers (schema, API, UI, tests) that is independently verifiable
- **Tracer bullet:** The first end-to-end implementation path used to validate architecture decisions
- **HITL:** Human-In-The-Loop — a task requiring human review or decision
- **AFK:** Away From Keyboard — a task that can be fully executed by automated agents

## Process Flow

Before writing the PRD, explore the problem space to ensure alignment:

1. **Explore the repo** — understand domain glossary, ADRs, existing patterns, and current codebase state
2. **Sketch modules** — identify which modules need building or modification; look for deep module extraction opportunities
3. **Explore 2-3 approaches** (if design is not settled) — present options with trade-offs and a recommendation
4. **User check** — present module sketch and approach for approval before writing the full PRD
5. **Write PRD** — use the template below, output to `.agnes/prd/YYYY-MM-DD-<feature>-prd.md`
6. **Self-review** — check for placeholders, contradictions, missing sections
7. **Publish** — create issue with `ready-for-agent` label if an issue tracker is in use

## Deep Module Design

When sketching modules, actively look for opportunities to extract deep modules:

| Shallow Module (avoid) | Deep Module (prefer) |
|------------------------|---------------------|
| Exposes many methods that mirror internal logic | Exposes a simple interface that hides complexity |
| Hard to test without mocking internals | Easy to test through its public interface |
| Changes frequently because interface leaks internals | Rarely changes because interface is stable |
| Consumer code is coupled to internal details | Consumer code is decoupled from internal details |

A deep module encapsulates rich functionality behind a simple, stable interface. The classic example: a database driver. Complex internals (connection pooling, query parsing, result caching) hidden behind `query(sql, params) → results`.

## Approach Exploration

If the feature's design is not yet settled, explore before specifying:

1. Propose 2-3 different approaches with trade-offs
2. Lead with your recommended option and explain why
3. Consider: what does each approach enable, what does it cost, what risks does it carry?
4. Get user approval on approach before writing the full PRD

This reduces the chance of writing a PRD for the wrong design.

## Context Requirements

- Existing conversation context containing feature discussion
- Repo architecture understanding — domain glossary, ADRs, existing patterns
- Issue tracker access for publishing (if applicable)

## Workflow

### 1. Explore Repo (if not already done)

Use domain glossary, respect ADRs, understand existing architecture. If the repo has CONTEXT.md, read it first. Check existing PRDs in `.agnes/prd/` for related work.

### 2. Sketch Major Modules

Identify which modules need to be built or modified. Look for deep module extraction opportunities — modules that encapsulate rich functionality behind a simple interface.

Document for each module:
- What does it do? (one sentence)
- How do you use it? (its public interface)
- What does it depend on?
- Is it a deep module or shallow module? Can it be deepened?

### 3. User Check

Present module sketch to the user:
- Does this match expectations?
- Which modules should have tests?

Iterate if the user has corrections.

### 4. Write PRD

Use the PRD template below. Output to `.agnes/prd/YYYY-MM-DD-<feature>-prd.md`.

### 5. Publish to Issue Tracker

Create an issue with `ready-for-agent` label — no additional triage needed.

## Tool Requirements

- `read` — explore repo files, ADRs, domain glossary
- `write` — write PRD to `.agnes/prd/`
- `webfetch` — research links, competitor analysis, prior art
- `bash` — git operations, issue tracker CLI

## Output

`.agnes/prd/YYYY-MM-DD-<feature>-prd.md` following the template below:

```markdown
# [Feature Name] — Product Requirements Document

## Problem Statement
[What problem does this solve? Who has this problem? From the user's perspective.]

## Solution
[High-level approach. What does success look like? From the user's perspective.]

## User Stories
- As a [actor], I want [feature] so that [benefit]
- (Long numbered list, ordered by priority — cover all aspects of the feature)

## Implementation Decisions
[Architecture constraints, technology choices, integration points]
_(Not implementation details — the DECISIONS that constrain implementation)_
Exception: prototype snippets that encode decisions precisely are OK (state machine, reducer, schema, type shape). Trim to the decision-rich parts.

## Testing Decisions
[What to test and how, testability requirements, which modules get tests]
Describe what makes a good test for this system (test external behavior, not implementation details).

## Out of Scope
[Explicitly what this PRD does NOT cover — prevents scope creep]

## Open Questions
[What we don't know yet — risks, unknowns, dependencies]

## Further Notes
[Anything else — research links, competitor analysis, prior art]
```

## Quality Criteria

- Do NOT interview the user — synthesize only from existing context
- Do NOT include implementation details (file paths, code snippets) except prototype snippets that encode decisions
- Look for deep module opportunities — prefer simple interfaces over complex ones
- All PRD template sections populated or explicitly marked N/A
- User Stories are extensive and cover all aspects of the feature
- Implementation Decisions capture constraints, not file paths
- If the design is unsettled, explore approaches before writing the PRD

## When NOT to Use

- When the feature has not been sufficiently discussed and context is too thin for a meaningful PRD
- When the user needs to be interviewed for more information (use clarifier instead)
- When the task is implementation planning (use planner instead)
- When writing tutorials, how-to guides, or reference docs (use documenter instead)
