---
id: tdd
name: tdd
description: 'Building new features from scratch, fixing bugs (write regression test first), or any time you need confidence that code does exactly what it should.'
phase: "TEST / BUILD"
use_when: "Building new features from scratch, fixing bugs (write regression test first), or any time you need confidence that code does exactly what it should."
version: 1.0
---

## Use When

Building new features from scratch, fixing bugs (regression test first), or any time you need confidence code does what it should.

## Core Concept

Write test first. Watch it fail. Write minimal code to pass. Didn't watch fail → don't know if it tests right thing. Vertical slices only — each RED→GREEN cycle delivers complete path through all layers.

## Precise Vocabulary

- **RED**: Newly written test fails (expected — behavior doesn't exist yet)
- **GREEN**: All tests pass after minimal implementation
- **REFACTOR**: Restructure while all tests green — never while red
- **Vertical Slice**: Complete end-to-end path through all layers (schema → API → UI → tests) in one RED→GREEN cycle
- **Iron Law**: No production code without failing test first. Code written before test must be DELETED.
- **YAGNI**: You Ain't Gonna Need It — only code for current test

## Context Requirements

- Project must have test runner configured, runnable from CLI
- Access to project architecture knowledge for slice boundaries
- Git repo for managing state (stash when refactoring hits red)
- Understanding of public interfaces vs implementation details

## Workflow

### The Cycle

1. **RED — Write ONE failing test**
   - One behavior per test. Clear name describing expected behavior.
   - Real code (no mocks unless unavoidable).
   - Test through **public interfaces**, not implementation details.

2. **Verify RED — Watch it fail**
   - Mandatory. Run test, confirm it fails.
   - Check *why*: compilation error (wrong wiring) vs assertion failure (behavior missing — correct RED).

3. **GREEN — Write minimal code to pass**
   - Only enough for **THIS** test.
   - No YAGNI. No over-engineering.

4. **Verify GREEN — Watch it pass**
   - Mandatory. Run **all** tests. Output pristine.
   - Any test red → stop. Fix or revert.

5. **REFACTOR — Only when ALL tests green**
   - Remove duplication. Improve names. Deepen modules.
   - Run tests after **EVERY** refactor step.
   - **NEVER** refactor while RED. See red → `git stash` or revert.

6. **Repeat**
   - Pick next behavior. Start at step 1.

### Vertical Slicing (NOT Horizontal)

| ❌ Wrong | ✅ Correct |
|----------|------------|
| Write ALL tests first | RED→GREEN, one slice at a time |
| Then write ALL implementation | Each slice = narrow but COMPLETE path |
| Tests test *imagined* behavior | Completed slice is demoable/verifiable |

Each vertical slice delivers complete path through **every** layer: schema → API → UI → tests.

### Bug Fix Integration

1. Bug found → write failing test reproducing it **FIRST**
2. Fix code
3. Test passes → bug fixed, will never regress

No fix lands without test proving bug existed and is gone.

### Workflow Summary

```
RED   ─→ Verify RED    ─→ GREEN  ─→ Verify GREEN  ─→ REFACTOR  ─→ Repeat
write      watch it        minimal    watch all        improve
test       fail            code       pass             names/modules
```

## Tool Requirements

- **Test runner**: Configured, runnable via CLI (Bash)
- **Git**: For stashing when refactoring produces red
- **Read/Write/Edit**: For test files and production code

### Executor Discipline

All bash, test runs, builds MUST delegate to @executor. TDD agent never runs bash directly.

When to use @executor:
- Running tests (`npm test`, `pytest`, `cargo test`, `bun test`)
- Running builds, type checks, compilation
- Running linters, formatters, validation
- Installing dependencies or setup
- Any command producing output

@executor returns compact pass/fail with file references. TDD agent reads results, decides next actions (red → implement → green → refactor). Executor doesn't suggest fixes — only TDD agent decides.

Rationale: Preserves TDD agent focus on test logic and implementation. Execution output summarized, not dumped.

## Output

Each RED→GREEN→REFACTOR cycle produces:
- **RED**: One failing test documenting expected behavior
- **GREEN**: Minimal production code passing all tests
- **REFACTOR**: Restructured code with all tests still passing
- **Bug fix**: Test proving bug existed and gone, paired with fix

## Quality Criteria

- **Iron Law enforced**: No production code without failing test first
- **One behavior per test**: Clear name describing expected behavior
- **Public interface only**: Tests through public interfaces, never private methods
- **No internal mocking**: Mock at system boundaries only (external APIs, DB, time, filesystem). Never mock own modules, classes, internal collaborators
- **No YAGNI**: Code only for current test
- **No call-count or call-order assertions**: Don't verify implementation details
- **Pristine test suite**: All tests pass before and after refactoring
- **Complex mocking**: Extract interface at boundary — architecture needs deepening
- **Prefer SDK-style interfaces**: Each function independently mockable

## When NOT to Use

- Exploratory/throwaway code where behavior not yet understood
- Prototyping to discover design rather than verify it
- Legacy code without test infra that can't support test-first
- One-off scripts with no maintenance burden
