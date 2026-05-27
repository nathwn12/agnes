---
id: reviewer
name: reviewer
description: 'After each builder task (per-task review), before shipper (final review), when user requests code review.'
phase: "REVIEW"
use_when: "After each builder task (per-task review), before shipper (final review), when user requests code review."
version: 1.0
---

## Use When

After each builder task (per-task review), before shipper (final review), when user requests code review.

## Core Concept

Two-stage review process: first verify spec compliance (does the code do what it should?), then assess code quality (is the code well-written?). Issues are classified as P0, P1, P2, or P3 to prioritize fixes.

## Precise Vocabulary

- **Spec Compliance**: Whether the implementation matches the agreed-upon specification line by line
- **Code Quality**: Assessment of tests, types, edge cases, naming, patterns, security, and performance
- **[P0] Blocking**: likely production breakage, data corruption, or exploitable security issue
- **[P1] High**: serious user, operational, or security impact
- **[P2] Medium**: meaningful but non-blocking risk
- **[P3] Low**: valid low-impact improvement that can be deferred

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
| P0 | Blocking: production breakage, data corruption, security exploit | Must fix before proceeding |
| P1 | High: serious user, operational, or security impact | Should fix before merging |
| P2 | Medium: meaningful but non-blocking risk | Can defer, log for later |
| P3 | Low: valid low-impact improvement | Can defer indefinitely |

### Evidence and Impact Requirement

Every finding must include:
1. **Evidence** — the specific code, behavior, or pattern that triggers the finding (with file:line references)
2. **Impact** — what could go wrong, how bad it would be, and under what conditions

Findings without both evidence and impact should not be raised.

### Final Review (all tasks complete)

1. Get git SHAs (base → head): `git log --oneline <base>..HEAD`
2. Get diff: `git diff <base>..HEAD`
3. Review complete diff against: spec, security, performance, maintainability
4. Fix all P0 and P1 issues before proceeding to shipper

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
- Code quality assessment with categorized issues (P0/P1/P2/P3)
- Final verdict: review passed or failed with required actions
- For per-task reviews: issues to fix before shipping
- For final reviews: verification that the complete diff is clean and intentional

## Quality Criteria

Before reporting "review passed", verify:
- Spec compliance report is complete
- Issue classification is accurate
- All P0 and P1 issues are fixed or explicitly deferred with user approval
- Final diff is clean and intentional

### Do Not Report

The following do NOT warrant a finding:

- Style-only preferences without real risk (tabs vs spaces, naming style preferences)
- Hypothetical issues without a plausible failure path
- Duplicate findings for the same root cause (merge them)
- Low-value nits that do not materially improve correctness, security, or maintainability

## When NOT to Use

N/A — This skill is always applicable when code changes need review before shipping.

## Protocol Shells

All code reviews follow the protocol shell format:

/protocol {
  intent="Review code diff against correctness and maintainability criteria",
  input={ diff="<code-changes>", scope="<task-boundary>" },
  process=[ /verify{correctness}, /verify{style}, /synthesize{findings} ],
  output={ result="<review-findings>", blockers="<issues-to-fix>" }
}

## Cognitive Tools

| Tool | When |
|------|------|
| /verify | Check code against correctness, security, and style criteria |
| /compare | Evaluate alternative implementations |
| /synthesize | Combine findings into a review summary with severity |
