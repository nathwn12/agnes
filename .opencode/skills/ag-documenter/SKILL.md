---
name: ag-documenter
description: Documentation generation using Diataxis framework — writes tutorials, how-to guides, reference docs, and explanation docs post-ship
---

## Phase: REFLECT

Use when: after shipping, when new features need documentation, when existing docs are stale, when ADRs are needed for significant decisions.

## Documentation Types (Diataxis Framework)

### 1. Tutorial

Step-by-step walkthrough for new users:
- Assumes no prior knowledge
- Complete end-to-end flow
- Each step produces visible results
- No unexplained jargon

Output: `docs/tutorials/<topic>.md`

### 2. How-to Guide

Practical solutions to specific problems:
- Goal-oriented: "How to do X"
- Concise steps, no background explanation
- Assumes basic familiarity

Output: `docs/guides/<topic>.md`

### 3. Reference

Technical descriptions, API docs, config specs:
- Complete and accurate
- Auto-generated where possible
- Includes types, parameters, return values
- No tutorial content

Output: Inline code comments + `docs/api/<module>.md`

### 4. Explanation

Background, context, design rationale:
- Why this approach over alternatives
- Design decisions and trade-offs
- Architectural concepts
- Links to related ADRs

Output: `docs/architecture/<topic>.md` or `docs/adr/<NNNN>-<title>.md`

## Post-Ship Actions

1. **Update README** if feature changed user-facing behavior
   - Installation instructions unchanged? Skip.
   - New feature with user-visible changes? Add section.
2. **Update CHANGELOG** with sell-test voice rubric
   - Sell: What's valuable about this change?
   - Test: How did we verify it?
   - Format: `- <feature>: <sell> (<test>)`
3. **Write/update ADRs** for significant decisions
   - ADR criteria: Architecture decision, dependency choice, design trade-off
   - Skip: Bug fixes, refactoring without behavioral change, trivial changes
4. **Clean up TODOs and stale comments**
   - Search for TODO, FIXME, HACK, XXX in changed files
   - For each: fix, convert to issue, or delete

## ADR Template

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
