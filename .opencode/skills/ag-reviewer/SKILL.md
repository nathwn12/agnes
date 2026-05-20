---
name: ag-reviewer
description: Code quality gate — two-stage review of spec compliance and code quality with Critical/Important/Minor issue classification
---

## Phase: REVIEW

Use when: after each ag-builder task (per-task review), before ag-shipper (final review), when user requests code review.

## Two-Stage Review (per task)

### Stage 1: Spec Compliance

Does the implementation match the spec? Line-by-line check against spec requirements:

- Are all required features implemented?
- Are there any extra features not in the spec?
- Does the implementation match the agreed-upon API surface?
- Are error cases from the spec handled?
- Are the tests from the test plan present?

Report: For each requirement, mark compliant or non-compliant with specifics.

### Stage 2: Code Quality

Review the code itself:

- **Tests**: Are there tests? Do they test the right things? Are they readable?
- **Types**: Are types correct? Any `any` or unsafe casts?
- **Edge cases**: Are error paths, empty states, and boundary conditions handled?
- **Naming**: Do names convey intent? Consistent with project conventions?
- **Patterns**: Does code follow existing project patterns? Any anti-patterns?
- **Security**: Any injection risks, exposed secrets, or permission issues?
- **Performance**: Any obvious performance issues (N+1 queries, unnecessary re-renders)?

### Issue Classification

| Severity | Meaning | Action |
|----------|---------|--------|
| Critical | Bug, security issue, or spec violation | Must fix before proceeding |
| Important | Quality concern, maintainability issue | Should fix before merging |
| Minor | Style preference, minor cleanup | Can defer, log for later |

## Final Review (all tasks complete)

1. Get git SHAs (base → head): `git log --oneline <base>..HEAD`
2. Get diff: `git diff <base>..HEAD`
3. Review complete diff against: spec, security, performance, maintainability
4. Fix all Critical and Important issues before proceeding to ag-shipper

## Receiving Feedback Rules

When receiving code review feedback (either from a human reviewer or when AGNES is being reviewed):

- **No performative agreement**: Never respond "You're absolutely right!" without thinking
- **Verify before implementing**: Check if the feedback is technically correct
- **Push back with technical reasoning**: If the reviewer is wrong, explain why with code evidence
- **One fix at a time**: Fix one issue, test, then move to the next

## Verification

Before reporting "review passed", verify:
- Spec compliance report is complete
- Issue classification is accurate
- All Critical and Important issues are fixed or explicitly deferred with user approval
- Final diff is clean and intentional
