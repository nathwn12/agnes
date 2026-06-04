---
id: clarify
name: clarify
description: 'Vague requests, incomplete bug reports, cross-domain terminology conflicts, before planning to ensure shared understanding.'
phase: "THINK"
use_when: "Vague requests, incomplete bug reports, cross-domain terminology conflicts, before planning to ensure shared understanding."
version: 1.0
---

## Use When

Vague requests, incomplete bug reports, cross-domain terminology conflicts, before planning.

## Core Concept

Socratic questioning building shared understanding one question at a time. Sharpens terminology against project glossary, proposes answers, handoffs clarified work. No implementation until user approves.

Methodology:
- **Socratic**: Questions lead user to discover answer
- **Empathetic**: Assume good intent, start from user's context
- **Precise**: Use exact codebase terminology
- **Concise**: One question, one answer, repeat

**Hard gate**: written, user-approved spec before BUILD-phase skill invoked.

## Precise Vocabulary

| Term | Definition |
|------|-----------|
| Shared Understanding | Agent describes task back in user's words, user confirms, no ambiguities |
| Glossary-first Challenge | User term conflicts with CONTEXT.md/ADRs — call out immediately |
| Fuzzy Language | Vague terms ("thing", "stuff", "manage") sharpened into precise terms |
| Context Scope | Active project domain (from CONTEXT-MAP.md) prefixing each question |
| Hard Gate | No implementation until user-approved written spec |

## Context Requirements

Before asking, check:
- Project files and structure
- CONTEXT.md, AGENTS.md, standing briefs
- ADRs (.agnes/adr/)
- Recent commits
- Issue tracker
- CONTEXT-MAP.md — if multiple contexts, prefix questions with active scope

**Inline CONTEXT.md Updates:** Update DURING conversation. Each resolved term written immediately.

**ADR Sparingly:** Only when ALL three:
1. Decision hard to reverse
2. Surprising without context
3. Result of real trade-off

Otherwise note in CONTEXT.md.

## Workflow

### 1. Explore Context

Check project files, CONTEXT.md/AGENTS.md, ADRs, recent commits, issue tracker, CONTEXT-MAP.md.

### 2. Ask One Question at a Time

**Critical rule:** Never multiple questions in one message.

Format:
- State what you understand
- Propose recommended interpretation
- Ask single, specific question

### 3. Sharpen Terminology

Cross-reference user's words against glossary:
- Check CONTEXT.md for domain language
- Check code naming conventions
- **Glossary-first challenge**: Conflicts → call out IMMEDIATELY
- **Sharpen fuzzy language**: Propose precise canonical terms
- **Concrete scenarios**: Edge-case scenarios forcing precision

### 4. Propose Recommended Answers

Offer best guess:
- "I think you mean X — right?"
- "Based on codebase, Y seems more appropriate. Use Y?"
- "Two interpretations: A or B. Which?"

### 5. Brainstorming Workflow

After clarification, propose 2-3 approaches with pros/cons.

Each includes:
- **Summary**: One sentence
- **Pros**: Advantages
- **Cons**: Trade-offs, risks
- **Estimated effort**: Rough hours/days

Include code sketches for critical decisions. Recommend one. Let user choose.

#### Visual Companion

For UI-heavy tasks, consider browser mockup server:
- Quick HTML mockups for visual exploration
- Layout, component hierarchies, user flow validation
- Optional: ask if user wants visual options
- Can handoff to prototype

### 6. Build Shared Understanding

Continue until:
- Can describe task back in user's words
- User confirms
- No remaining ambiguities

### 7. Spec Self-Review Checklist

Before marking complete:
- **Placeholder scan**: No "TODO", "FIXME", "TBD"
- **Consistency**: All referenced files exist
- **Scope check**: All items belong? No scope creep?
- **Ambiguity check**: All decisions explicit

### 8. Handoff

Route to next skill:
- Planning → planner
- Debugging → debugger
- Building → planner first

## Tool Requirements

- **read / grep**: Explore context
- **task**: Route clarified work
- **write / edit**: Update CONTEXT.md inline
- **webfetch**: Access issue trackers

## Output

- Clarified task description ready for routing
- Documented assumptions and decisions
- Shared understanding confirmed by user

## Quality Criteria

- **Hard Gate**: No implementation until design approved. Gate: user approved spec, self-review passes, all terminology resolved.
- **Spec Self-Review**: No TODOs/FIXMEs/TBDs, files exist, no scope creep, decisions explicit.
- **Shared Understanding**: Describe task back, user confirms.

## When NOT to Use

- Task already precisely specified with no ambiguity
- During BUILD phase — THINK only
- User needs direct implementation
- Purely operational ("run this command")
