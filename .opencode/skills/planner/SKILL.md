---
id: planner
name: planner
description: 'Requirements are clear, before any implementation begins, needs architecture decisions documented.'
phase: "PLAN"
use_when: "Requirements are clear, before any implementation begins, needs architecture decisions documented."
version: 1.0
---

**Tradeoff:** Formal design docs prevent rework but cost upfront time — skip when task is trivial (≤3 steps, no ambiguity).

## Core Concept

Transform clarified requirements into structured design docs + actionable impl plans. Enforces: explore context → propose approaches → design incrementally (approval per section) → spec + plan → self-review → user gate.

## Precise Vocabulary

- **Spec** — `.agnes/specs/` doc covering architecture, data model, component tree, data flow, API surface, error handling, testing strategy.
- **Implementation Plan** — `.agnes/plans/` ordered task list. Each task = one action (2-5 min) with exact code + file paths.
- **ADR** — Architecture Decision Record; past decisions constraining current design.
- **Vertical Slice** — Independently completable issue adding user-visible value.

### Requirement IDs

Every plan includes a Requirements Snapshot with stable IDs (R1, R2, R3...). Sub-tasks reference these via `requirementIds`.

```yaml
requirements:
  - id: R1
    description: "Description of the requirement"
    source: "Source file or document"
```

## Context Requirements

Requires codebase context before planning:
- Insufficient context → call explorer first
- Read existing specs in `.agnes/specs/`
- Check ADRs for past decisions
- Understand file layout + conventions

## Workflow

### 1. Explore Project Context
Understand codebase before planning. → verify: can you list existing specs, ADRs, and file layout?

**Output:** Context summary ready for design decisions.

### 2. Propose 2-3 Approaches
Present options with trade-offs + recommendation. → verify: each approach has summary, pros, cons, effort estimate.

- Include code sketches for critical decisions
- Recommend one with rationale
- Let user choose before proceeding

**Output:** Chosen approach with rationale.

### 3. Present Design In Sections
Get approval per section before moving on:
- Architecture overview → data model → component/module tree → data flow → API surface → error handling → testing strategy
→ verify: user approved current section before moving to next.

**Output:** Fully approved design section-by-section.

### 4. Write Spec
Output: `.agnes/specs/YYYY-MM-DD-<topic>-design.md`

Structure:
```markdown
# <Feature> — Design Spec

## Overview
## Architecture
## Data Model
## Implementation
## Testing Strategy
## Open Questions
```

→ verify: all sections complete, no placeholder text.

**Output:** Design spec document.

### 5. Write Implementation Plan
Output: `.agnes/plans/YYYY-MM-DD-<feature>.md`

Each task: one action (2-5 min), complete code, exact file paths. → verify: every file path exists or is creation-marked, every task has complete code.

**Output:** Implementation plan with granular tasks.

### 6. Self-Review
- **Placeholder scan**: No "TODO", "FIXME", or incomplete sections → verify: zero placeholders found.
- **Consistency**: All referenced files/functions exist or will be created → verify: cross-reference every path.
- **Scope**: No scope creep → verify: every task belongs to feature.
- **Ambiguity**: All decisions explicit, nothing deferred → verify: no "figure out later" language.

**Output:** Clean, reviewed plan.

### 7. User Review Gate
Present spec + plan. Do NOT proceed to impl until user explicitly approves. → verify: user said "go ahead" or equivalent.

**Output:** Signed-off plan ready for execution.

### 8. Break Into Issues
If using issue tracker: decompose into vertical-slice issues. → verify: each issue independently completable, adds user-visible value, ordered by dependency.

**Output:** List of vertical-slice issues.

## Flow Diagram

```
Requirements
     │
     ▼
[1. Explore Context] ──→ verify: specs/ADRs/layout known
     │
     ▼
[2. Propose Approaches] ──→ verify: 2-3 options with tradeoffs
     │
     ▼ (user chooses)
[3. Design Per Section] ──→ verify: approved per section
     │
     ▼
[4. Write Spec] ──→ verify: no placeholders
     │
     ▼
[5. Write Plan] ──→ verify: granular tasks, exact paths
     │
     ▼
[6. Self-Review] ──→ verify: clean + consistent
     │
     ▼
[7. User Gate] ──→ verify: explicit approval
     │
     ▼
[8. Break Into Issues] ──→ verify: vertical slices ordered
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| read | 1, 3, 4, 5, 6 | Specs, ADRs, codebase files | Context for design decisions |
| write | 4, 5 | Design outline, task list | Spec + plan documents |
| task | 1 | Context-gathering request | Codebase research results |
| skill | 1 | Explorer invocation | Deeper codebase understanding |

## Examples

| Scenario | Plan Format | Sections | Output |
|----------|-------------|----------|--------|
| New feature (complex) | Full spec + plan | Architecture, data model, API, testing, error handling | `.agnes/specs/*.md` + `.agnes/plans/*.md` |
| Simple feature (≤3 steps) | Short plan | Just tasks, no spec | `.agnes/plans/*.md` |
| Refactor | Plan only | Before/after, migration steps | `.agnes/plans/*.md` |
| Library/API design | Spec only | API surface, data flow, error handling | `.agnes/specs/*.md` |
| Exploratory (no impl) | None | Skip — no formal planning needed | N/A |

## Output

1. **Design Spec** at `.agnes/specs/YYYY-MM-DD-<topic>-design.md`
2. **Implementation Plan** at `.agnes/plans/YYYY-MM-DD-<feature>.md`

## Quality Criteria

- **No placeholders**: Scan for "TODO", "FIXME", incomplete sections → verify: zero matches.
- **Consistency**: All referenced files/functions exist or will be created → verify: cross-reference every path.
- **Scope**: Every task belongs to feature; no scope creep → verify: each task ties to requirement.
- **Ambiguity**: All decisions explicit; nothing deferred → verify: no "figure out later" language.

## Protocol Shells

```
/protocol {
  intent="Create implementation plan from requirements",
  input={ requirements="<spec>", constraints="<boundaries>" },
  process=[ /decompose{steps}, /compare{routes}, /synthesize{plan} ],
  output={ result="<plan-NNN.yaml>", dependencies="<order>" }
}
```

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break requirements into independent implementation steps |
| /compare | Evaluate alternative implementation routes |
| /synthesize | Combine steps into a coherent ordered plan |

## When NOT to Use

- Requirements unclear or being explored (use clarifier first)
- No implementation follows planning phase
- Architecture decisions don't need formal docs
- Purely exploratory with no design decisions

### Proportionality Rules

- No formal plans for advisory, exploratory, or review-only requests
- Keep plan proportional to task size + risk
- Simple tasks (≤3 steps, no ambiguity) → short plan, only necessary steps
- Complex/high-risk tasks → include dependencies, risks, validation, rollout
- Prefer fewest steps that still make execution clear
- Preserve acceptance criteria, edge cases, out-of-scope limits when present
- Don't convert speculative ideas into binding requirements
