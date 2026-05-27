---
id: prd
name: prd
description: 'A feature request has been discussed enough to write requirements, before detailed implementation planning begins.'
phase: "PLAN"
use_when: "A feature request has been discussed enough to write requirements, before detailed implementation planning begins."
version: 1.1
---

# PRD

**Tradeoff:** More spec time upfront reduces rework during implementation, but can delay coding when requirements are still fluid.

## Use When

Feature request discussed enough to write requirements, before implementation planning. Captures WHAT and WHY, not HOW. Distinct from planner (implementation specs).

## Core Concept

Synthesize known context into structured PRD. Do NOT interview user — work from existing context. If context insufficient, reflect that as open questions. PRD captures product requirements. Implementation details (file paths, code, APIs) belong in planner.

## Precise Vocabulary

- **PRD:** Structured doc capturing what to build and why
- **ready-for-agent:** Issue label — no additional triage needed
- **deep module:** Rich functionality behind simple, stable interface
- **shallow module:** Interface as complex as implementation
- **Implementation Decisions:** Architecture constraints that constrain implementation, not file paths or code
- **User Stories:** "As a [actor], I want [feature] so that [benefit]"
- **Vertical slice:** End-to-end path through all layers, independently verifiable
- **Tracer bullet:** First end-to-end impl path to validate architecture decisions
- **HITL:** Human-In-The-Loop
- **AFK:** Away From Keyboard — fully automatable

## Context Requirements

- Existing conversation with feature discussion
- Repo architecture — domain glossary, ADRs, patterns
- Issue tracker access (for publishing)

## Workflow

### Phase 1: Research

1. Explore repo — ADRs, domain glossary, CONTEXT.md, existing PRDs in `.agnes/prd/`
   → verify: domain terms and ADRs understood
2. Sketch major modules needed / modified. For each:
   - Purpose (one sentence)
   - Public interface (how to use it)
   - Dependencies
   - Deep or shallow? Can it be deepened?
   → verify: each module has single-sentence purpose and interface defined
3. Look for deep module extraction opportunities
   → verify: deep module candidates identified

**Output:** Module sketch with deep module analysis

### Phase 2: Design

4. If design unsettled: explore 2-3 approaches with trade-offs. Lead with recommendation.
   → verify: each approach analyzed (enables/costs/risks)
5. User check — present module sketch + approach
   → verify: user approved direction

**Output:** Chosen approach with trade-offs documented

### Phase 3: Write

6. Write PRD from template to `.agnes/prd/YYYY-MM-DD-<feature>-prd.md`
   → verify: all template sections populated or explicitly N/A
7. Self-review — no placeholders, contradictions, missing sections
   → verify: user stories cover all aspects, decisions capture constraints not paths

**Output:** PRD document

### Phase 4: Publish

8. Create issue with `ready-for-agent` label (if issue tracker in use)
   → verify: issue exists and labeled

**Output:** Published issue

## Flow Diagram

```
┌──────────┐   ┌──────────┐   ┌────────┐   ┌─────────┐
│ Research │ → │  Design  │ → │  Write │ → │ Publish │
└──────────┘   └──────────┘   └────────┘   └─────────┘
     │              │              │              │
     ▼              ▼              ▼              ▼
 verify:       verify:         verify:         verify:
 glossary      approach        all sections    issue +
 understood    approved        populated       label
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| read | Research | Repo files, ADRs, glossary | Domain understanding |
| write | Write | Template + decisions | PRD document |
| webfetch | Research, Design | External links | Competitor analysis, prior art |
| bash | Publish | Issue data | Created issue |

## Examples

| Scenario | Approach | Output |
|----------|----------|--------|
| New feature from discussion | Full PRD pipeline | `.agnes/prd/YYYY-MM-DD-feature-prd.md` |
| Small change, settled design | Skip Research/Design phases | Short PRD, 2-3 user stories |
| Unsettled design | Explore 2-3 approaches first | Approach comparison doc + approved direction |

## Output

`.agnes/prd/YYYY-MM-DD-<feature>-prd.md` using template:

```markdown
# [Feature Name] — Product Requirements Document

## Problem Statement
[What problem? Who has it? User perspective.]

## Solution
[High-level approach. What does success look like?]

## User Stories
- As a [actor], I want [feature] so that [benefit]
- (Long numbered list, ordered by priority)

## Implementation Decisions
[Architecture constraints, tech choices, integration points]
_(Decisions that constrain implementation, not paths or file names)_
Exception: prototype snippets encoding decisions (state machine, reducer, schema, type shape).

## Testing Decisions
[What to test, how, testability requirements, which modules get tests]

## Out of Scope
[Explicit non-goals — prevents scope creep]

## Open Questions
[Risks, unknowns, dependencies]

## Further Notes
[Research links, competitor analysis, prior art]
```

## Quality Criteria

- Do NOT interview user → verify: all content from existing context
- No implementation details (file paths, code) except decision-encoding snippets
- Look for deep module opportunities → verify: module sketch includes depth analysis
- All PRD template sections populated or N/A → verify: no empty sections
- User stories extensive, cover all aspects → verify: every feature aspect has story
- Implementation Decisions capture constraints, not paths → verify: no file paths in decisions
- If unsettled, explore approaches before PRD → verify: approach exploration exists

## Protocol Shells

```
/protocol {
  intent="Create product requirements document from discussion",
  input={ discussion="<conversation>", stakeholders="<inputs>" },
  process=[ /decompose{requirements}, /verify{completeness}, /synthesize{prd} ],
  output={ result="<PRD-document>" }
}
```

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break discussion into distinct requirements |
| /verify | Check PRD completeness against user needs |
| /synthesize | Combine requirements into coherent document |

## When NOT to Use

- Feature insufficiently discussed — context too thin for meaningful PRD
- Need to interview user for info (use clarifier)
- Task is implementation planning (use planner)
- Writing tutorials, how-to guides, or reference docs (use documenter)
