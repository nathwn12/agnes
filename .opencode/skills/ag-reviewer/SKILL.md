---
id: ag-reviewer
phase: "REVIEW"
use_when: "After each ag-builder task (per-task review), before ag-shipper (final review), when user requests code review."
version: 1.0
---

## Use When

After each ag-builder task (per-task review), before ag-shipper (final review), when user requests code review.

## Core Concept

Two-stage review process: first verify spec compliance (does the code do what it should?), then assess code quality (is the code well-written?). Issues are classified as Critical, Important, or Minor to prioritize fixes.

## Precise Vocabulary

- **Spec Compliance**: Whether the implementation matches the agreed-upon specification line by line
- **Code Quality**: Assessment of tests, types, edge cases, naming, patterns, security, and performance
- **Critical**: Bug, security issue, or spec violation — must fix before proceeding
- **Important**: Quality concern or maintainability issue — should fix before merging
- **Minor**: Style preference or minor cleanup — can defer, log for later

## Context Requirements

- The task's implementation spec or requirements document
- Git history showing changes made (base SHA to head SHA)
- Diff of all changes for the task
- Project conventions and patterns for comparison

## Workflow

### Two-Stage Review (per task)

#### Stage 1: Spec Compliance

Does the implementation match the spec? Line-by-line check against spec requirements:

- Are all required features implemented?
- Are there any extra features not in the spec?
- Does the implementation match the agreed-upon API surface?
- Are error cases from the spec handled?
- Are the tests from the test plan present?

Report: For each requirement, mark compliant or non-compliant with specifics.

#### Stage 2: Code Quality

Review the code itself:

- **Tests**: Are there tests? Do they test the right things? Are they readable?
- **Types**: Are types correct? Any `any` or unsafe casts?
- **Edge cases**: Are error paths, empty states, and boundary conditions handled?
- **Naming**: Do names convey intent? Consistent with project conventions?
- **Patterns**: Does code follow existing project patterns? Any anti-patterns?
- **Security**: Any injection risks, exposed secrets, or permission issues?
- **Performance**: Any obvious performance issues (N+1 queries, unnecessary re-renders)?

#### Issue Classification

| Severity | Meaning | Action |
|----------|---------|--------|
| Critical | Bug, security issue, or spec violation | Must fix before proceeding |
| Important | Quality concern, maintainability issue | Should fix before merging |
| Minor | Style preference, minor cleanup | Can defer, log for later |

### Final Review (all tasks complete)

1. Get git SHAs (base → head): `git log --oneline <base>..HEAD`
2. Get diff: `git diff <base>..HEAD`
3. Review complete diff against: spec, security, performance, maintainability
4. Fix all Critical and Important issues before proceeding to ag-shipper

### Receiving Feedback Rules

When receiving code review feedback (either from a human reviewer or when AGNES is being reviewed):

- **No performative agreement**: Never respond "You're absolutely right!" without thinking
- **Verify before implementing**: Check if the feedback is technically correct
- **Push back with technical reasoning**: If the reviewer is wrong, explain why with code evidence
- **One fix at a time**: Fix one issue, test, then move to the next

## Tool Requirements

- `read`: Read source files and spec documents for review
- `grep`: Search for patterns, types, and potential issues
- `bash`: Run git commands (log, diff), build, and test commands
- `task`: Delegate fix work for identified issues
- `git`: Access git history and changes

## Output

- Spec compliance report marking each requirement as compliant or non-compliant
- Code quality assessment with categorized issues (Critical/Important/Minor)
- Final verdict: review passed or failed with required actions
- For per-task reviews: issues to fix before shipping
- For final reviews: verification that the complete diff is clean and intentional

## Quality Criteria

Before reporting "review passed", verify:
- Spec compliance report is complete
- Issue classification is accurate
- All Critical and Important issues are fixed or explicitly deferred with user approval
- Final diff is clean and intentional

## When NOT to Use

N/A — This skill is always applicable when code changes need review before shipping.
