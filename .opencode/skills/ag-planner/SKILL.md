---
name: ag-planner
description: Writing specs and implementation plans — takes clarified requirements and produces structured design documents with bite-sized tasks
---

## Phase: PLAN

Use when: requirements are clear, before any implementation begins, needs architecture decisions documented.

## Process

### 1. Explore Project Context

Understand the existing codebase before planning:
- If context is insufficient, call ag-explorer first
- Read existing specs in `docs/agnes/specs/`
- Check ADRs for past architecture decisions
- Understand file layout and conventions

### 2. Propose 2-3 Approaches

Present options with trade-offs and a recommendation:
- Each approach has: summary, pros, cons, estimated effort
- Include code sketches for critical decisions
- Recommend one approach with rationale
- Let the user choose before proceeding

### 3. Present Design In Sections

Get approval per section before moving to the next:
- Architecture overview
- Data model / types
- Component / module tree
- Data flow
- API surface
- Error handling
- Testing strategy

### 4. Write Spec

Output: `docs/agnes/specs/YYYY-MM-DD-<topic>-design.md`

Structure:
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

Output: `docs/agnes/plans/YYYY-MM-DD-<feature>.md`

Structure:
```markdown
# <Feature> — Implementation Plan

## Tasks
1. **[Task name]** — `path/to/file.ts`
   - What to do in 2-5 minutes
   - Exact code or approach
2. ...
```

**Task granularity:** Each task is one action (2-5 minutes). Complete code in every step. Exact file paths always.

### 6. Self-Review

Check the plan for:
- **Placeholder scan**: No "TODO", "FIXME", or incomplete sections
- **Consistency**: All referenced files and functions exist or will be created
- **Scope**: Does every task belong? No scope creep?
- **Ambiguity**: Are all decisions explicit? No "figure out later"?

### 7. User Review Gate

Present the spec and plan to the user. Do NOT proceed to implementation until the user explicitly approves.

### 8. Break Into Issues

If using an issue tracker, decompose into vertical-slice issues:
- Each issue is independently completable
- Each issue adds user-visible value
- Order by dependency: foundational first
