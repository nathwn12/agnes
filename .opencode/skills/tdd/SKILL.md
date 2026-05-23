---
id: tdd
phase: "TEST / BUILD"
use_when: "Building new features from scratch, fixing bugs (write regression test first), or any time you need confidence that code does exactly what it should."
version: 1.0
---

## Use When

Building new features from scratch, fixing bugs (write regression test first), or any time you need confidence that code does exactly what it should.

## Core Concept

Write the test first. Watch it fail. Write minimal code to pass. If you didn't watch the test fail, you don't know if it tests the right thing. Vertical slices only — each RED→GREEN cycle delivers a complete path through all layers.

## Precise Vocabulary

- **RED**: State where a newly written test fails (expected — behavior doesn't exist yet)
- **GREEN**: State where all tests pass after writing minimal implementation
- **REFACTOR**: Restructuring code while all tests remain green — never done while red
- **Vertical Slice**: A complete end-to-end path through all layers (schema → API → UI → tests) delivered in one RED→GREEN cycle
- **Iron Law**: No production code without a failing test first. Code written before the test must be DELETED. Delete means delete.
- **YAGNI**: You Ain't Gonna Need It — don't write code for future needs, only for the current test

## Context Requirements

- Project must have a test runner configured and runnable from command line
- Access to project architecture knowledge for identifying vertical slice boundaries
- Git repository for managing state (stashing when refactoring hits red)
- Understanding of public interfaces vs implementation details

## Workflow

### The Cycle

1. **RED — Write ONE failing test**
   - One behavior per test. Clear name describing the expected behavior.
   - Real code (no mocks unless unavoidable).
   - Test through **public interfaces**, not implementation details.

2. **Verify RED — Watch it fail**
   - Mandatory step. Run the test and confirm it fails.
   - Check *why* it failed: compilation error (test wiring is wrong) vs assertion failure (behavior doesn't exist yet — correct RED).

3. **GREEN — Write minimal code to pass**
   - Only enough code for **THIS** test.
   - No YAGNI. No over-engineering. Resist the urge to build for "what's next."

4. **Verify GREEN — Watch it pass**
   - Mandatory step. Run **all** tests. Output must be pristine.
   - If any test is red, stop. Fix or revert.

5. **REFACTOR — Only when ALL tests are green**
   - Remove duplication. Improve names. Deepen modules.
   - Run tests after **EVERY** refactor step.
   - **NEVER** refactor while RED. If you see red while refactoring, `git stash` or revert.

6. **Repeat**
   - Pick the next behavior. Start at step 1.

### Vertical Slicing (NOT Horizontal)

| ❌ Wrong | ✅ Correct |
|----------|------------|
| Write ALL tests first | RED→GREEN, one slice at a time |
| Then write ALL implementation | Each slice = narrow but COMPLETE path |
| Tests test *imagined* behavior | A completed slice is demoable/verifiable |

Each vertical slice delivers a complete path through **every** layer: schema → API → UI → tests. No layer-skipping.

### Bug Fix Integration

1. Bug found → write failing test reproducing it **FIRST**
2. Then fix the code
3. Test passes → bug is fixed and will never regress

No fix lands without a test proving the bug existed and is now gone.

### Workflow Summary

```
RED   ─→ Verify RED    ─→ GREEN  ─→ Verify GREEN  ─→ REFACTOR  ─→ Repeat
write      watch it        minimal    watch all        improve
test       fail            code       pass             names/modules
```

## Tool Requirements

- **Test runner**: Configured for project language, runnable via command line (Bash)
- **Git**: Required for stashing when refactoring produces red state
- **Read/Write/Edit**: For creating test files and production code

### Executor Discipline

All bash commands, test runs, and build steps MUST be delegated to the @executor subagent. The TDD agent itself must NEVER run bash directly.

When to use @executor:
- Running tests (`npm test`, `pytest`, `cargo test`, `bun test`)
- Running builds, type checks, or compilation
- Running linters, formatters, or any validation tools
- Installing dependencies or running setup commands
- Any command that produces output that can be summarized

The @executor returns compact pass/fail results with file references. The TDD agent reads these results and decides next actions (red → implement → green → refactor). The executor does not suggest fixes — only the TDD agent decides.

Rationale: Keeping bash execution in the executor role preserves the TDD agent's focus on test logic and implementation. Execution output is summarized, not dumped, into the main context.

## Output

Each RED→GREEN→REFACTOR cycle produces:
- **RED output**: One failing test documenting expected behavior
- **GREEN output**: Minimal production code passing all tests
- **REFACTOR output**: Restructured code with all tests still passing
- **Bug fix output**: A test proving the bug existed and is gone, paired with the fix

## Quality Criteria

- **Iron Law enforced**: No production code without a failing test first
- **One behavior per test**: Clear name describing expected behavior
- **Public interface only**: Tests verify through public interfaces, never private methods
- **No internal mocking**: Mock at system boundaries only (external APIs, DB, time, filesystem). Never mock own modules, classes, or internal collaborators
- **No YAGNI**: Code only enough for the current test — no over-engineering
- **No call-count or call-order assertions**: Tests don't verify implementation details
- **Pristine test suite**: All tests pass before and after refactoring
- **If mocking is complex**: Extract an interface at the boundary — architecture needs deepening
- **Prefer SDK-style interfaces**: Each function independently mockable

## When NOT to Use

- Exploratory or throwaway code where behavior is not yet understood
- Prototyping to discover design rather than verify it
- Legacy code without test infrastructure that cannot support a test-first workflow
- One-off scripts with no maintenance burden
