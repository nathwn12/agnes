---
id: tdd
name: tdd
description: 'Building new features from scratch, fixing bugs (write regression test first), or any time you need confidence that code does exactly what it should.'
phase: "TEST / BUILD"
use_when: "Building new features from scratch, fixing bugs (write regression test first), or any time you need confidence that code does exactly what it should."
version: 1.0
---

# TDD

**Tradeoff:** Tests cost time now; save time later. RED→GREEN cycles slower per-feature than freeform coding, but catch regressions and force better interface design. Skip for throwaway prototypes. Use everywhere else.

## Core Concept

Write test first. Watch it fail. Write minimal code to pass. No failure watch = no confidence the test tests the right thing. Each RED→GREEN cycle delivers a complete vertical slice through all layers.

## Precise Vocabulary

- **RED**: New test fails (expected — behavior doesn't exist yet)
- **GREEN**: All tests pass after minimal implementation
- **REFACTOR**: Restructure while green. Never while red.
- **Vertical Slice**: Complete path schema→API→UI→tests in one RED→GREEN
- **Iron Law**: No production code without prior failing test. Untested code = DELETE.
- **YAGNI**: Only code for current test, not imagined future needs

## Context Requirements

- Test runner configured, runnable from CLI
- Project architecture knowledge for slice boundaries
- Git for stashing during refactor red state
- Public vs private interface awareness

## Workflow

1. **RED — Write ONE failing test**
   - One behavior per test. Clear name.
   - Real code, no mocks unless unavoidable.
   - Public interfaces only.
   [RED] → verify: test file exists, tests new behavior

2. **Verify RED — Watch it fail**
   - Run test, confirm failure.
   - Compilation error = wiring wrong. Assertion failure = correct RED.
   [Verify RED] → verify: test runner shows red, reason is assertion not compile

3. **GREEN — Write minimal code to pass**
   - Only enough for THIS test. No YAGNI.
   [GREEN] → verify: code compiles, targets only current test

4. **Verify GREEN — Watch it pass**
   - Run ALL tests. Pristine output.
   - Any red = stop. Fix or revert.
   [Verify GREEN] → verify: test runner exits 0, all tests pass

5. **REFACTOR — Only when ALL tests green**
   - Remove duplication. Improve names. Deepen modules.
   - Run tests after EVERY step.
   - Red while refactoring = `git stash` or revert.
   [REFACTOR] → verify: all tests still green after each change

6. **Repeat** — next behavior, back to step 1.

### Vertical Slicing

| ❌ Wrong | ✅ Correct |
|----------|------------|
| Write ALL tests first | RED→GREEN one slice at a time |
| Then write ALL impl | Each slice = narrow but complete path |
| Tests test imagined behavior | Completed slice is demoable |

Vertical slice = schema → API → UI → tests. No layer-skipping.

### Bug Fix Integration

1. Bug found → write failing test reproducing it FIRST
2. Then fix code
3. Test passes → bug fixed, never regresses
   [Bug fix] → verify: regression test existed before fix, passes after

```
RED ─→ Verify RED ─→ GREEN ─→ Verify GREEN ─→ REFACTOR ─→ Repeat
test   watch fail    code    all pass           improve
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| @executor | Verify RED, Verify GREEN, REFACTOR verify | Test/build command | Pass/fail + output refs |
| read/write/edit | RED, GREEN, REFACTOR | File paths | Test/code files |
| glob/grep | All | Search patterns | File references |
| git | REFACTOR recovery | Stash/revert | Clean state |

## Examples

| Scenario | RED | GREEN | REFACTOR | Verify |
|----------|-----|-------|----------|--------|
| New feature | Test for new behavior | Minimal impl | Clean duplication | `npm test` all pass |
| Bug fix | Regression test reproducing bug | Fix code | None | Regression passes |
| API endpoint | Integration test | Handler + schema | Extract middleware | `npm test` + typecheck |

## Output

Per-cycle deliverables:
- **RED**: One failing test documenting expected behavior
- **GREEN**: Minimal production code, full suite green
- **REFACTOR**: Clean code, suite still green
- **Bug fix**: Regression test + fix, paired

## Quality

- [Iron Law] → verify: no production code committed without prior failing test
- [One behavior/test] → verify: test name describes exactly one behavior
- [Public interface] → verify: tests call public APIs only, no private methods
- [No internal mocking] → verify: mocks at system boundaries (DB/time/filesystem/API) only
- [No YAGNI] → verify: code covers only current test requirements
- [No call-count assertions] → verify: tests don't verify impl details
- [Pristine suite] → verify: all tests green before and after refactor
- [Complex mock] → verify: extract interface at boundary, deepen architecture

## Protocol Shells

```
/protocol {
  intent="Build feature test-first with regression coverage",
  input={ feature="<description>", spec="<requirements>" },
  process=[ /decompose{cases}, /implement{test}, /implement{code}, /verify{pass} ],
  output={ result="<passing-suite>", coverage="<coverage-report>" }
}
```

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break feature into test cases (happy, edge, error) |
| /verify | Check test coverage against requirements |
| /reflect | Review test quality before implementation |

## When NOT to Use

- Exploratory/throwaway code with unknown behavior
- Design discovery prototyping
- Legacy code without test infra that can't support test-first
- One-off scripts with no maintenance burden
