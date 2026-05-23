---
id: plan-reviewer
phase: "PLAN REVIEW"
use_when: "After planner produces a spec and implementation plan, before builder begins any implementation work."
version: 1.0
---

## Use When

After planner produces a spec and implementation plan, before builder begins any implementation work.

**Gate rule**: No implementation starts until plan-reviewer passes.

## Core Concept

The plan reviewer applies up to four distinct review modes sequentially, each providing a score and recommendations. After each mode, the plan is updated before the next mode begins.

### CEO Mode — Business Value & Scope

Questions:
- Is this ambitious enough? What's the 10x version?
- Does this solve the user's real problem?
- What's the narrowest wedge that delivers value?
- Are we building the right thing?

Score 0-10 with specific recommendations.

### Eng Mode — Architecture & Data Flow

Questions:
- Does this scale? What are the edge cases?
- Is the architecture clean and maintainable?
- Are error paths handled?
- Is the data flow correct and complete?
- What could break in production?

Score 0-10 with specific fix recommendations.

### Design Mode — UI/UX & Visual Consistency

Questions:
- Does the design hold up under scrutiny?
- Is there visual consistency with existing components?
- What would make the design a 10?
- Are interactions and transitions considered?
- Is accessibility handled?

Score 0-10 with specific improvement suggestions.

### DX Mode — Developer Experience

Questions:
- How fast is time-to-Hello-World (TTHW)?
- What friction points exist for developers?
- Are error messages helpful?
- Is the API intuitive?
- What debugging support is provided?

Score 0-10 with specific recommendations.

## Precise Vocabulary

- **Plan**: The specification and implementation plan produced by planner
- **Review mode**: One of four lenses (CEO, Engineering, Design, DX) used to evaluate the plan
- **Score**: A 0-10 rating per mode indicating quality
- **Verdict**: Final outcome — Approve, Revise, or Reject
- **Gate rule**: Enforcement that no implementation begins until review passes

## Context Requirements

The plan document being reviewed must be accessible. The reviewer must know which modes apply (e.g., backend-only plans skip Design mode).

## Workflow

1. **Select modes**: Choose which modes apply based on plan scope
2. **Run sequentially**: CEO → Eng → Design → DX, applying fixes between modes
3. **Apply fixes**: After each mode, update the plan document with the mode's recommendations
4. **Final verdict**:
   - **Approve**: All modes pass. Proceed to implementation.
   - **Revise**: Minor issues found. Fix and re-review specific mode only.
   - **Reject**: Major issues found. Send back to planner with detailed feedback.

## Tool Requirements

- `read` — access the plan document
- `write` — produce review output
- `edit` — update the plan document with recommendations between modes
- `question` — ask clarifying questions if plan details are ambiguous
- `bash` — run any verification scripts if needed

## Output

```markdown
## Plan Review Results

### CEO Score: 8/10
[Notes and recommendations]

### Eng Score: 7/10
[Notes and recommendations]

### Design Score: N/A (backend-only plan)

### DX Score: 9/10
[Notes and recommendations]

### Verdict: APPROVE (with minor revisions applied)
```

## Quality Criteria

- Each mode answers its specific questions thoroughly
- Each score is justified with specific, actionable recommendations
- The plan is updated after each mode before proceeding
- Final verdict provides a clear decision path
- No implementation begins without an approved review

## When NOT to Use

- When there is no plan document to review
- When the plan has not been produced by planner
- When execution is needed instead of review
- When the task is in discovery or clarification phase
- When rapid prototyping iteration makes formal review overhead unjustified
