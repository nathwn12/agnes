---
id: planner
name: planner
description: 'Requirements are clear, before any implementation begins, needs architecture decisions documented.'
phase: "PLAN"
use_when: "Requirements are clear, before any implementation begins, needs architecture decisions documented."
version: 1.0
---

## Use When

Requirements clear, before implementation begins, needs architecture decisions documented.

## Core Concept

Transforms clarified requirements into structured design docs and actionable implementation plans. Enforces: explore context, propose approaches with trade-offs, design incrementally with user approval per section, produce spec and plan, self-review, gate on user approval.

## Precise Vocabulary

- **Spec** — Structured design doc in `.agnes/specs/` covering architecture, data model, component tree, data flow, API surface, error handling, testing strategy
- **Implementation Plan** — Ordered task list in `.agnes/plans/`, each task 2-5 min with exact code and file paths
- **ADR** — Architecture Decision Record; past decisions constraining current design
- **Vertical Slice** — Independently completable issue adding user-visible value
- **Task Granularity** — 1 action per task, 2-5 min, complete code, exact file paths

### Requirement IDs

Every plan includes Requirements Snapshot with stable IDs (R1, R2, R3...) referenced by sub-tasks. Replaces separate task.md.

Format in plan-NNN.yaml:
```yaml
requirements:
  - id: R1
    description: "Description of the requirement"
    source: "Source file or document"
```

Each sub-task includes `requirementIds` field. Provides traceability from requirements through impl to verification.

## Context Requirements

Requires codebase context before planning:
- Insufficient → call explorer first
- Read existing specs in `.agnes/specs/`
- Check ADRs for past decisions
- Understand file layout and conventions

## Workflow

### 1. Explore Project Context

- Insufficient context? Call explorer first
- Read existing specs
- Check ADRs
- Understand layout and conventions

### 2. Propose 2-3 Approaches

Options with trade-offs and recommendation:
- Summary, pros, cons, estimated effort
- Code sketches for critical decisions
- Recommend one with rationale
- User chooses before proceeding

### 3. Present Design In Sections

Get approval per section:
- Architecture overview
- Data model / types
- Component/module tree
- Data flow
- API surface
- Error handling
- Testing strategy

### 4. Write Spec

Output: `.agnes/specs/YYYY-MM-DD-<topic>-design.md`

```markdown
# <Feature> — Design Spec

## Overview
[One paragraph]

## Architecture
[Diagram or description]

## Data Model
[Types, interfaces, schemas]

## Implementation
[Key modules, files to create/modify]

## Testing Strategy
[What to test and how]

## Open Questions
[Anything unresolved]
```

### 5. Write Implementation Plan

Output: `.agnes/plans/YYYY-MM-DD-<feature>.md`

```markdown
# <Feature> — Implementation Plan

## Tasks
1. **[Task name]** — `path/to/file.ts`
   - What to do in 2-5 minutes
   - Exact code or approach
2. ...
```

**Task granularity:** 1 action (2-5 min). Complete code every step. Exact file paths always.

### 6. Self-Review

- **Placeholder scan**: No TODO, FIXME, incomplete sections
- **Consistency**: All referenced files/functions exist or will be created
- **Scope**: Every task belongs? No creep?
- **Ambiguity**: All decisions explicit? No "figure out later"?

### 7. User Review Gate

Present spec and plan. No implementation until user explicitly approves.

### 8. Break Into Issues

For issue trackers: vertical-slice issues. Each independently completable, adds user-visible value. Order by dependency.

## Tool Requirements

- **read** — Explore specs, ADRs, codebase, conventions
- **write** — Create spec and plan documents
- **task** — Delegate context-gathering when insufficient
- **skill** — Invoke explorer for deeper research

## Output

1. **Design Spec** at `.agnes/specs/YYYY-MM-DD-<topic>-design.md`: overview, architecture, data model, impl modules, testing, open questions
2. **Implementation Plan** at `.agnes/plans/YYYY-MM-DD-<feature>.md`: ordered granular tasks (2-5 min) with exact code and file paths

## Quality Criteria

- **Placeholder scan**: No TODO, FIXME, incomplete sections
- **Consistency**: All referenced files/functions exist or marked for creation
- **Scope**: Every task belongs; no creep
- **Ambiguity**: All decisions explicit

## When NOT to Use

- Requirements unclear (use clarify first)
- No implementation following planning
- Architecture decisions don't need formal docs
- Purely exploratory, no design decisions

### Proportionality Rules

- No formal plans for advisory/exploratory/review-only requests
- Plan proportional to task size and risk
- Simple tasks (≤3 steps, no ambiguity) → short plan
- Complex/high-risk → dependencies, risks, validation, rollout
- Fewest steps that make execution clear
- Preserve acceptance criteria, edge cases, out-of-scope limits
- Don't convert speculative ideas into binding requirements
