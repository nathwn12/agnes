---
id: documenter
name: documenter
description: 'After shipping, when new features need documentation, when existing docs are stale, when ADRs are needed for significant decisions.'
phase: "REFLECT"
use_when: "After shipping, when new features need documentation, when existing docs are stale, when ADRs are needed for significant decisions."
version: 1.0
---

## Use When

After shipping, new features need docs, existing docs stale, ADRs needed for decisions.

## Core Concept

Diataxis framework: four documentation types for different user needs.

### 1. Tutorial

Step-by-step for new users:
- No prior knowledge assumed
- Complete end-to-end flow
- Each step produces visible results
- No unexplained jargon

Output: `.agnes/tutorials/<topic>.md`

### 2. How-to Guide

Practical solutions to specific problems:
- Goal-oriented: "How to do X"
- Concise steps, no background
- Assumes basic familiarity

Output: `.agnes/guides/<topic>.md`

### 3. Reference

Technical descriptions, API docs, config specs:
- Complete and accurate
- Auto-generated where possible
- Types, parameters, return values
- No tutorial content

Output: Inline comments + `.agnes/api/<module>.md`

### 4. Explanation

Background, context, design rationale:
- Why this approach
- Design decisions and trade-offs
- Architectural concepts
- Links to ADRs

Output: `.agnes/architecture/<topic>.md` or `.agnes/adr/<NNNN>-<title>.md`

## Precise Vocabulary

- **Tutorial**: Learning-oriented walkthrough for beginners
- **How-to Guide**: Goal-oriented recipe for specific problem
- **Reference**: Complete technical description of APIs, configs, internals
- **Explanation**: Background, context, design rationale
- **ADR**: Recorded decision with context, decision, consequences
- **CHANGELOG**: Curated list of notable changes per version
- **Sell-Test Voice**: Each entry describes value (sell) and verification (test)

## Context Requirements

- Knowledge of project domain and architecture
- Familiarity with existing docs structure
- Understanding of target audience
- Access to recent changes (diff, PRs, commits)

## Workflow

1. **Update README** if feature changed user-facing behavior
   - Install unchanged? Skip.
   - New visible feature? Add section.
2. **Update CHANGELOG** with sell-test voice
   - Sell: value of this change?
   - Test: how verified?
   - Format: `- <feature>: <sell> (<test>)`
3. **Write/update ADRs** for significant decisions
   - ADR criteria: architecture decision, dependency choice, design trade-off
   - Skip: bug fixes, refactoring without behavioral change, trivial
4. **Clean up TODOs and stale comments**
   - Search TODO, FIXME, HACK, XXX in changed files
   - Fix, convert to issue, or delete

### ADR Template

```markdown
# ADR-<NNNN>: <Title>

## Status
Accepted | Proposed | Deprecated

## Context
[What forces led to this decision?]

## Decision
[What was decided?]

## Consequences
[What trade-offs were accepted?]
```

## Tool Requirements

| Tool | Purpose |
|------|---------|
| Read | Review existing docs |
| Write | Create new docs |
| Edit | Update existing docs |
| Grep | Find TODOs, FIXMEs, HACKs, XXXs |
| Glob | Locate doc files |
| Bash | Run doc generators, formatters, linters |

## Output

- `.agnes/tutorials/<topic>.md` — Tutorials
- `.agnes/guides/<topic>.md` — How-to guides
- `.agnes/api/<module>.md` + inline comments — Reference
- `.agnes/architecture/<topic>.md` or `.agnes/adr/<NNNN>-<title>.md` — Explanations/ADRs
- `README.md` — Updated project description
- `CHANGELOG.md` — Updated with sell-test entries

## Quality Criteria

- Doc type matches need: tutorial for learning, guide for solving, reference for lookup, explanation for understanding
- No unexplained jargon in tutorials
- Reference docs complete, accurate, auto-generated where possible
- ADRs clearly state context, decision, consequences
- CHANGELOG entries follow sell-test voice
- All TODOs/FIXMEs/HACKs/XXXs addressed
- README reflects current behavior

## When NOT to Use

- During active development before shipping
- Bug fixes or refactoring without behavioral or architectural change
- Docs already current
- Internal-only experimental code with no users
