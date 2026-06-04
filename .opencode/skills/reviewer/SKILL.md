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

Two-stage review: verify spec compliance (does code do what it should?), then assess code quality (is it well-written?). Issues classified P0–P3 to prioritize fixes.

## Precise Vocabulary

- **Spec Compliance**: Implementation matches agreed-upon spec line by line
- **Code Quality**: Assessment of tests, types, edge cases, naming, patterns, security, performance
- **[P0] Blocking**: production breakage, data corruption, security exploit
- **[P1] High**: serious user/operational/security impact
- **[P2] Medium**: meaningful but non-blocking risk
- **[P3] Low**: valid low-impact improvement, can defer

## Context Requirements

- Task implementation spec or requirements document
- Git history (base SHA to head SHA)
- Diff of all task changes
- Project conventions and patterns for comparison

## Workflow

### Two-Stage Review (per task)

#### Stage 1: Spec Compliance

Does implementation match spec? Line-by-line:

- All required features implemented?
- Any extra features not in spec?
- API surface matches agreed-upon?
- Error cases from spec handled?
- Tests from test plan present?

Report: mark each requirement compliant or non-compliant with specifics.

#### Stage 2: Code Quality

- **Tests**: Exist? Test right things? Readable?
- **Types**: Correct? Any `any` or unsafe casts?
- **Edge cases**: Error paths, empty states, boundaries handled?
- **Naming**: Convey intent? Consistent with conventions?
- **Patterns**: Follow existing patterns? Anti-patterns?
- **Security**: Injection risks, exposed secrets, permission issues?
- **Performance**: N+1 queries, unnecessary re-renders?

#### Issue Classification

| Severity | Meaning | Action |
|----------|---------|--------|
| P0 | Blocking: breakage, corruption, exploit | Must fix before proceeding |
| P1 | High: serious user/op/security impact | Should fix before merging |
| P2 | Medium: meaningful but non-blocking | Can defer, log for later |
| P3 | Low: valid low-impact improvement | Can defer indefinitely |

### Evidence and Impact Requirement

Every finding must include:
1. **Evidence** — specific code/behavior/pattern triggering finding (file:line references)
2. **Impact** — what could go wrong, how bad, under what conditions

Findings without both: don't raise.

### Final Review (all tasks complete)

1. Get SHAs: `git log --oneline <base>..HEAD`
2. Get diff: `git diff <base>..HEAD`
3. Review against: spec, security, performance, maintainability
4. Fix all P0/P1 before shipper

### Receiving Feedback Rules

When receiving code review feedback:

- **No performative agreement**. Verify before implementing.
- **Push back with technical reasoning** if reviewer is wrong.
- **One fix at a time** — fix, test, move on.

## Tool Requirements

- `read`: Source files and spec documents
- `grep`: Search patterns, types, issues
- `bash`: Git commands (log, diff), build, test
- `task`: Delegate fix work for identified issues
- `git`: Access history and changes

## Output

- Spec compliance report (compliant/non-compliant by requirement)
- Code quality assessment with categorized issues (P0/P1/P2/P3)
- Final verdict: passed or failed with required actions
- Per-task: issues to fix before shipping
- Final: verification that complete diff is clean and intentional

## Quality Criteria

Before reporting "review passed":
- Spec compliance report complete
- Issue classification accurate
- All P0/P1 fixed or explicitly deferred with user approval
- Final diff clean and intentional

### Do Not Report

- Style-only preferences without real risk (tabs vs spaces, naming style)
- Hypothetical issues without plausible failure path
- Duplicate findings for same root cause (merge them)
- Low-value nits not materially improving correctness, security, maintainability

## When NOT to Use

N/A — Always applicable when code changes need review before shipping.
