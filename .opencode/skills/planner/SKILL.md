---
id: planner
name: planner
description: 'Requirements are clear, before any implementation begins, needs architecture decisions documented.'
phase: "PLAN"
use_when: "Requirements are clear, before any implementation begins, needs architecture decisions documented."
version: 1.0
---

## Use When

Requirements are clear, before any implementation begins, needs architecture decisions documented.

## Core Concept

The planner skill transforms clarified requirements into structured design documents and actionable implementation plans. It enforces a disciplined workflow: explore context, propose approaches with trade-offs, design incrementally with user approval per section, produce a formal spec and plan, self-review for quality, and gate on user approval before any implementation begins.

## Precise Vocabulary

- **Spec** — A structured design document in `.agnes/specs/` covering architecture, data model, component tree, data flow, API surface, error handling, and testing strategy.
- **Implementation Plan** — An ordered task list in `.agnes/plans/` where each task is a single action (2-5 minutes) with exact code and file paths.
- **ADR** — Architecture Decision Record; past decisions that constrain current design choices.
- **Vertical Slice** — An independently completable issue that adds user-visible value.
- **Task Granularity** — Each task is one action taking 2-5 minutes, with complete code and exact file paths.

### Requirement IDs

Every plan includes a Requirements Snapshot with stable requirement IDs (R1, R2, R3...) that sub-tasks reference. This replaces the need for a separate task.md file.

Format in plan-NNN.yaml:
```yaml
requirements:
  - id: R1
    description: "Description of the requirement"
    source: "Source file or document"
```

Each sub-task in the plan includes a `requirementIds` field listing which requirements it satisfies. This provides traceability from requirements through implementation to verification.

## Context Requirements

Requires codebase context before planning:
- Insufficient context triggers a call to explorer first
- Existing specs in `.agnes/specs/` must be read
- ADRs must be checked for past architecture decisions
- File layout and conventions must be understood

## Workflow

### 1. Explore Project Context

Understand the existing codebase before planning:
- If context is insufficient, call explorer first
- Read existing specs in `.agnes/specs/`
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

Output: `.agnes/specs/YYYY-MM-DD-<topic>-design.md`

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

Output: `.agnes/plans/YYYY-MM-DD-<feature>.md`

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

## Tool Requirements

- **read** — Explore existing specs, ADRs, codebase files, and conventions
- **write** — Create spec and plan documents
- **task** — Delegate context-gathering to subagents when insufficient
- **skill** — Invoke explorer when deeper codebase research is needed

## Output

Two document types written to the project:

1. **Design Spec** at `.agnes/specs/YYYY-MM-DD-<topic>-design.md` — covers overview, architecture, data model, implementation modules, testing strategy, and open questions.

2. **Implementation Plan** at `.agnes/plans/YYYY-MM-DD-<feature>.md` — ordered list of granular tasks (2-5 minutes each) with exact code and file paths, and a placeholder/polish pass at the end.

## Quality Criteria

- **Placeholder scan**: No "TODO", "FIXME", or incomplete sections remain
- **Consistency**: All referenced files and functions exist or are explicitly marked for creation
- **Scope**: Every task belongs to the feature; no scope creep
- **Ambiguity**: All decisions are explicit; nothing deferred to "figure out later"

## When NOT to Use

- When requirements are unclear or still being explored (use clarifier first)
- When no implementation will follow the planning phase
- When architecture decisions do not need formal documentation
- When the task is purely exploratory with no design decisions to make

### Proportionality Rules

- Do not create formal plans for purely advisory, exploratory, or review-only requests.
- Keep the plan proportional to the task size and risk.
- For simple tasks (≤3 steps, no ambiguity), use a short plan with only the necessary steps.
- For complex or high-risk tasks, include dependencies, risks, validation, and rollout considerations.
- Prefer the fewest steps that still make execution clear.
- Preserve explicit acceptance criteria, edge cases, and out-of-scope limits when present.
- Do not convert speculative implementation ideas into binding requirements.

## Protocol Shells

All plan creation follows the protocol shell format:

/protocol {
  intent="Create implementation plan from requirements",
  input={ requirements="<spec>", constraints="<boundaries>" },
  process=[ /decompose{steps}, /compare{routes}, /synthesize{plan} ],
  output={ result="<plan-NNN.yaml>", dependencies="<order>" }
}

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break requirements into independent implementation steps |
| /compare | Evaluate alternative implementation routes |
| /synthesize | Combine steps into a coherent ordered plan |
