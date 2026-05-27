---
id: documenter
name: documenter
description: 'After shipping, when new features need documentation, when existing docs are stale, when ADRs are needed for significant decisions.'
phase: "REFLECT"
use_when: "After shipping, when new features need documentation, when existing docs are stale, when ADRs are needed for significant decisions."
version: 1.0
---

# Documenter

**Tradeoff:** Thorough docs improve long-term maintainability at the cost of shipping velocity.

## Core Concept

Diataxis framework — four doc types, each serving a distinct need.

### 1. Tutorial

Step-by-step walkthrough for new users:
- Assumes no prior knowledge
- Complete end-to-end flow
- Each step produces visible results
- No unexplained jargon

Output: `.agnes/tutorials/<topic>.md`

### 2. How-to Guide

Goal-oriented solutions to specific problems:
- "How to do X"
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
- Trade-offs and decisions
- Architectural concepts
- Links to related ADRs

Output: `.agnes/architecture/<topic>.md` or `.agnes/adr/<NNNN>-<title>.md`

## Precise Vocabulary

- **Tutorial**: Learning-oriented walkthrough for beginners. No prior knowledge assumed.
- **How-to Guide**: Goal-oriented recipe. Assumes basic familiarity.
- **Reference**: Complete technical description of APIs, configs, internals.
- **Explanation**: Background, context, design rationale.
- **ADR**: Architecture Decision Record with context, decision, consequences.
- **CHANGELOG**: Curated, chronologically ordered list of notable changes per version.
- **Sell-Test Voice**: Each changelog entry describes value (sell) and verification (test).

## Context Requirements

- Project domain and architecture knowledge
- Existing doc structure and conventions
- Target audience and skill levels
- Recent code changes (diff, PR descriptions, commit messages)

## Workflow

1. **Update README** if feature changed user-facing behavior
   - Installation unchanged? Skip.
   - New user-visible feature? Add section.
   → verify: README matches current CLI/API surface

2. **Update CHANGELOG** with sell-test voice
   - Sell: What's valuable?
   - Test: How was it verified?
   - Format: `- <feature>: <sell> (<test>)`
   → verify: every new entry has sell + test

3. **Write/update ADRs** for significant decisions
   - Criteria: architecture decision, dependency choice, design trade-off
   - Skip: bug fixes, refactors without behavioral change, trivial changes
   → verify: ADR has context, decision, consequences

4. **Clean up TODOs and stale comments**
   - Search TODO, FIXME, HACK, XXX in changed files
   - Fix, convert to issue, or delete
   → verify: no TODO/FIXME/HACK/XXX remain in changed files

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

```
[changed files] → [update README] → [update CHANGELOG] → [write ADRs] → [clean TODOs] → [documentation]
                                                                    ↑ error            │
                                                                    └──────────────────┘
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| Read | All | Existing docs | Understanding of structure |
| Write | All | Doc content | New documentation files |
| Edit | README, CHANGELOG, ADRs | Updates | Updated docs |
| Grep | TODO cleanup | Changed files | TODO/FIXME/HACK/XXX locations |
| Glob | All | Search patterns | File paths |
| Bash | ADR gen, lint | Source + config | Generated/formatted docs |

## Examples

| Scenario | Doc Type | Format |
|----------|----------|--------|
| New user setup flow | Tutorial | `.agnes/tutorials/getting-started.md` |
| How to configure API keys | How-to Guide | `.agnes/guides/configure-keys.md` |
| CLI command reference | Reference | `.agnes/api/cli.md` |
| Why PostgreSQL vs MySQL | Explanation / ADR | `.agnes/adr/0001-database-choice.md` |
| Bug fix shipped (no doc) | Skip | — |

## Output

- `.agnes/tutorials/<topic>.md` — Tutorials
- `.agnes/guides/<topic>.md` — How-to guides
- `.agnes/api/<module>.md` + inline comments — Reference
- `.agnes/architecture/<topic>.md` or `.agnes/adr/<NNNN>-<title>.md` — Explanations/ADRs
- `README.md` — Updated project description
- `CHANGELOG.md` — Updated changelog

## Quality Criteria

- → verify: doc type matches user need (tutorial/guide/reference/explanation)
- → verify: no unexplained jargon or skipped prerequisites in tutorials
- → verify: reference docs complete, accurate, auto-generated where possible
- → verify: ADRs state context, decision, consequences
- → verify: CHANGELOG entries follow sell-test voice
- → verify: all TODOs, FIXMEs, HACKs, XXXs addressed
- → verify: README accurate for current user-facing behavior

## Protocol Shells

All doc operations follow protocol shell format:

/protocol {
  intent="Create or update documentation for shipped work",
  input={ feature="<description>", audience="<who-reads>" },
  process=[ /decompose{sections}, /verify{clarity}, /synthesize{docs} ],
  output={ result="<documentation>", files="<created-or-updated>" }
}

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break docs into audience-appropriate sections |
| /verify | Check accuracy and completeness |
| /reflect | Self-critique draft before publishing |

## When NOT to Use

- Active development before shipping (code still in flux)
- Bug fixes or refactoring without behavior/architecture change
- Docs already exist and are current
- Internal-only experimental code with no consumers
