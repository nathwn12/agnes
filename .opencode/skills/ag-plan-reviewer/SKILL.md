---
name: ag-plan-reviewer
description: Multi-lens plan quality gate — reviews plans through CEO, Engineering, Design, and DX modes before implementation begins
---

## Phase: PLAN REVIEW

Use when: after ag-planner produces a spec and implementation plan, before ag-builder begins any implementation work.

**Gate rule**: No implementation starts until ag-plan-reviewer passes.

## 4 Review Modes

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

## Process

1. **Select modes**: Choose which modes apply (e.g., backend-only plans skip Design mode)
2. **Run sequentially**: Run CEO → Eng → Design → DX, applying fixes between modes
3. **Apply fixes**: After each mode, update the plan document with the mode's recommendations
4. **Final verdict**:
   - **Approve**: All modes pass. Proceed to implementation.
   - **Revise**: Minor issues found. Fix and re-review specific mode only.
   - **Reject**: Major issues found. Send back to ag-planner with detailed feedback.

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
