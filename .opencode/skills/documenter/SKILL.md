---
id: documenter
phase: "REFLECT"
use_when: "After shipping, when new features need documentation, when existing docs are stale, when ADRs are needed for significant decisions."
version: 1.0
---

## Use When

After shipping, when new features need documentation, when existing docs are stale, when ADRs are needed for significant decisions.

## Core Concept

The Diataxis framework organizes documentation into four distinct types, each serving a different user need.

### 1. Tutorial

Step-by-step walkthrough for new users:
- Assumes no prior knowledge
- Complete end-to-end flow
- Each step produces visible results
- No unexplained jargon

Output: `.agnes/tutorials/<topic>.md`

### 2. How-to Guide

Practical solutions to specific problems:
- Goal-oriented: "How to do X"
- Concise steps, no background explanation
- Assumes basic familiarity

Output: `.agnes/guides/<topic>.md`

### 3. Reference

Technical descriptions, API docs, config specs:
- Complete and accurate
- Auto-generated where possible
- Includes types, parameters, return values
- No tutorial content

Output: Inline code comments + `.agnes/api/<module>.md`

### 4. Explanation

Background, context, design rationale:
- Why this approach over alternatives
- Design decisions and trade-offs
- Architectural concepts
- Links to related ADRs

Output: `.agnes/architecture/<topic>.md` or `.agnes/adr/<NNNN>-<title>.md`

## Precise Vocabulary

- **Tutorial**: Step-by-step learning-oriented walkthrough for beginners. Assumes no prior knowledge.
- **How-to Guide**: Goal-oriented recipe for solving a specific problem. Assumes basic familiarity.
- **Reference**: Complete, accurate technical description of APIs, configs, or internals.
- **Explanation**: Background, context, and design rationale behind decisions.
- **ADR (Architecture Decision Record)**: A recorded significant decision with context, decision, and consequences.
- **CHANGELOG**: A curated, chronologically ordered list of notable changes per version.
- **Sell-Test Voice**: A changelog rubric where each entry describes what's valuable (sell) and how it was verified (test).

## Context Requirements

- Knowledge of the project's domain and architecture
- Familiarity with existing documentation structure and conventions
- Understanding of target audience and their skill levels
- Access to recent code changes (diff, PR descriptions, commit messages)

## Workflow

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
| Read | Review existing documentation structure and content |
| Write | Create new documentation files |
| Edit | Update existing documentation |
| Grep | Find TODOs, FIXMEs, HACKs, XXXs and stale patterns |
| Glob | Locate documentation files across project |
| Bash | Run documentation generators, formatters, or linters |

## Output

- `.agnes/tutorials/<topic>.md` — Step-by-step tutorials
- `.agnes/guides/<topic>.md` — How-to guides
- `.agnes/api/<module>.md` + inline code comments — Reference documentation
- `.agnes/architecture/<topic>.md` or `.agnes/adr/<NNNN>-<title>.md` — Explanations and ADRs
- `README.md` — Updated user-facing project description
- `CHANGELOG.md` — Updated changelog with sell-test voice entries

## Quality Criteria

- Documentation type matches user need: tutorial for learning, guide for solving, reference for lookup, explanation for understanding
- No unexplained jargon or skipped prerequisites in tutorials
- Reference docs are complete, accurate, and auto-generated where possible
- ADRs clearly state context, decision, and consequences
- CHANGELOG entries follow sell-test voice rubric consistently
- All TODOs, FIXMEs, HACKs, and XXXs are addressed (fixed, issued, or deleted)
- README accurately reflects current user-facing behavior

## When NOT to Use

- During active development before shipping (code still in flux)
- For bug fixes or refactoring that don't change user-facing behavior or architecture
- When documentation already exists and is current (no staleness)
- When the project has no users or consumers (internal-only experimental code)
