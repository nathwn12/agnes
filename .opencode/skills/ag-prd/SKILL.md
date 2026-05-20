---
name: ag-prd
description: Synthesize current conversation context into a Product Requirements Document and publish it — does NOT interview the user, uses what it already knows
---

## Phase: PLAN

Use when: a feature request has been discussed enough to write requirements, before detailed implementation planning begins. Distinct from ag-planner (which writes implementation specs) — this captures the WHAT and WHY, not the HOW.

## Core Concept

Synthesize what you already know into a structured PRD. Do NOT interview the user for more information — work from existing context. If context is insufficient, the PRD will reflect that with open questions.

## Key Rules

- **Do NOT interview the user** — just synthesize what you already know
- **Do NOT include implementation details** (file paths, code snippets) — those go in the implementation plan
- **Exception:** prototype snippets that encode decisions precisely are OK
- **Look for deep module opportunities** — modules that encapsulate lots of functionality behind a simple interface
- **Publish with `ready-for-agent` label** — no additional triage needed

## Workflow

### 1. Explore Repo (if not already done)
Use domain glossary, respect ADRs, understand existing architecture.

### 2. Sketch Major Modules
Identify which modules need to be built or modified. Look for deep module extraction opportunities — modules that encapsulate rich functionality behind a simple interface.

### 3. User Check
Present module sketch to the user:
- Does this match expectations?
- Which modules should have tests?

### 4. Write PRD
Use the PRD template below. Output to `docs/agnes/prd/YYYY-MM-DD-<feature>-prd.md`.

### 5. Publish to Issue Tracker
Create an issue with `ready-for-agent` label — no additional triage needed.

## PRD Template

```markdown
# [Feature Name] — Product Requirements Document

## Problem Statement
[What problem does this solve? Who has this problem?]

## Solution
[High-level approach. What does success look like?]

## User Stories
- As a [actor], I want [feature] so that [benefit]
- (Long numbered list, ordered by priority)

## Implementation Decisions
[Architecture constraints, technology choices, integration points]
_(Not implementation details — the DECISIONS that constrain implementation)_

## Testing Decisions
[What to test and how, testability requirements]

## Out of Scope
[Explicitly what this PRD does NOT cover]

## Open Questions
[What we don't know yet — risks, unknowns, dependencies]

## Further Notes
[Anything else — research links, competitor analysis, prior art]
```

## Output

`docs/agnes/prd/YYYY-MM-DD-<feature>-prd.md`
