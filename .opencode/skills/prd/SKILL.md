---
id: prd
name: prd
description: 'A feature request has been discussed enough to write requirements, before detailed implementation planning begins.'
phase: "PLAN"
use_when: "A feature request has been discussed enough to write requirements, before detailed implementation planning begins."
version: 1.1
---

## Use When

Feature request discussed enough to write requirements, before detailed impl planning. Distinct from planner (impl specs) — captures WHAT and WHY, not HOW.

## Core Concept

Synthesize known context into structured PRD. Do NOT interview user for more info. Insufficient context → PRD reflects open questions.

PRD captures product requirements: what to build and why. Implementation details (file paths, code, APIs) belong in planner phase.

## Precise Vocabulary

- **PRD (Product Requirements Document):** Structured doc capturing what to build and why
- **ready-for-agent label:** Issue tracker label — no additional triage needed
- **deep module:** Rich functionality behind simple, testable interface that rarely changes
- **shallow module:** Interface as complex as implementation; harder to test, more coupled
- **Implementation Decisions:** Architecture constraints and tech choices, not file paths or code
- **User Stories:** Structured from actor perspective: "As a [actor], I want [feature] so that [benefit]"
- **Vertical slice:** Thin end-to-end path through all layers (schema, API, UI, tests), independently verifiable
- **Tracer bullet:** First end-to-end impl path validating architecture decisions
- **HITL:** Human-In-The-Loop — task needing human review
- **AFK:** Away From Keyboard — fully automatable

## Process Flow

1. **Explore repo** — domain glossary, ADRs, existing patterns, codebase state
2. **Sketch modules** — identify what to build/modify; find deep module extraction opportunities
3. **Explore 2-3 approaches** (if design unsettled) — options with trade-offs and recommendation
4. **User check** — present module sketch and approach for approval before writing PRD
5. **Write PRD** — template below, output to `.agnes/prd/YYYY-MM-DD-<feature>-prd.md`
6. **Self-review** — placeholders, contradictions, missing sections
7. **Publish** — create issue with `ready-for-agent` label if tracker in use

## Deep Module Design

Actively look for deep modules:

| Shallow Module (avoid) | Deep Module (prefer) |
|------------------------|---------------------|
| Exposes many methods mirroring internal logic | Simple interface hiding complexity |
| Hard to test without mocking internals | Easy to test through public interface |
| Changes frequently (interface leaks internals) | Rarely changes (stable interface) |
| Consumer code coupled to internals | Consumer code decoupled from internals |

Classic example: database driver. Connection pooling, query parsing, caching hidden behind `query(sql, params) → results`.

## Approach Exploration

Design unsettled? Explore before specifying:
1. Propose 2-3 approaches with trade-offs
2. Lead with recommendation, explain why
3. Consider: what each approach enables, costs, risks
4. Get user approval before writing full PRD

## Context Requirements

- Existing conversation with feature discussion
- Repo architecture: domain glossary, ADRs, patterns
- Issue tracker access (if publishing)

## Workflow

### 1. Explore Repo (if not done)

Use domain glossary, respect ADRs, understand architecture. Read CONTEXT.md if exists. Check existing PRDs in `.agnes/prd/`.

### 2. Sketch Major Modules

Identify what to build/modify. Look for deep module extraction.

Document each module:
- What does it do? (1 sentence)
- How to use it? (public interface)
- Dependencies?
- Deep or shallow? Can it be deepened?

### 3. User Check

Present module sketch:
- Match expectations?
- Which modules need tests?

Iterate on corrections.

### 4. Write PRD

Use template. Output to `.agnes/prd/YYYY-MM-DD-<feature>-prd.md`.

### 5. Publish

Create issue with `ready-for-agent` label.

## Tool Requirements

- `read` — explore repo, ADRs, domain glossary
- `write` — write PRD to `.agnes/prd/`
- `webfetch` — research links, competitor analysis, prior art
- `bash` — git ops, issue tracker CLI

## Output

`.agnes/prd/YYYY-MM-DD-<feature>-prd.md`:

```markdown
# [Feature Name] — Product Requirements Document

## Problem Statement
[What problem? Who has it? From user perspective.]

## Solution
[High-level approach. What does success look like? From user perspective.]

## User Stories
- As a [actor], I want [feature] so that [benefit]
- (Long numbered list, priority order — cover all aspects)

## Implementation Decisions
[Architecture constraints, tech choices, integration points]
_(Decisions that constrain impl, not impl details)_
Exception: prototype snippets encoding decisions (state machine, reducer, schema, type shape). Trim to decision-rich parts.

## Testing Decisions
[What to test and how, testability requirements, which modules get tests]
Describe good test: test external behavior, not impl details.

## Out of Scope
[Explicitly what PRD does NOT cover — prevents creep]

## Open Questions
[Unknowns — risks, unknowns, dependencies]

## Further Notes
[Research links, competitor analysis, prior art]
```

## Quality Criteria

- Do NOT interview user — synthesize from existing context only
- No implementation details (file paths, code) except decision-encoding snippets
- Look for deep module opportunities
- All PRD template sections populated or marked N/A
- User Stories extensive, cover all feature aspects
- Implementation Decisions capture constraints, not file paths
- Design unsettled? Explore approaches before writing PRD

## When NOT to Use

- Feature insufficiently discussed, context too thin
- User needs interviewing (use clarifier)
- Task is implementation planning (use planner)
- Writing tutorials, how-to guides, reference docs (use documenter)
