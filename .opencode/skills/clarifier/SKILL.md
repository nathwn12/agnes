---
id: clarifier
name: clarifier
description: 'Vague requests, incomplete bug reports, cross-domain terminology conflicts, before planning to ensure shared understanding.'
phase: "THINK"
use_when: "Vague requests, incomplete bug reports, cross-domain terminology conflicts, before planning to ensure shared understanding."
version: 1.0
---

**Tradeoff:** More upfront questions reduce ambiguity waste later, but too many rounds frustrate users. Keep it tight.

## Core Concept

Socratic questioning that builds shared understanding one question at a time. Sharpens terminology against project glossary, proposes recommended answers, hands off clarified work. No implementation until user explicitly approves.

Methodology:
- **Socratic**: Questions lead user to discover answer themselves
- **Empathetic**: Assume good intent, start from user's context
- **Precise**: Use exact terminology from codebase
- **Concise**: One question, one answer, repeat

**Hard gate**: Clarification must produce written, user-approved spec before any BUILD-phase skill is invoked.

## Precise Vocabulary

| Term | Definition |
|------|------------|
| Shared Understanding | State where agent can describe the task back in user's words, user confirms, no ambiguities remain about scope/approach/constraints |
| Glossary-first Challenge | When user uses term conflicting with existing CONTEXT.md or ADRs, call it out immediately — show conflict, ask for resolution |
| Fuzzy Language | Vague/overloaded terms ("thing", "stuff", "manage", "handle") that must be sharpened into precise canonical terms |
| Context Scope | Active project domain (from CONTEXT-MAP.md) that should prefix each question when multiple contexts exist |
| Hard Gate | No implementation until design is approved — written, user-approved spec before any BUILD-phase skill |

## Context Requirements

- Project files and structure
- CONTEXT.md, AGENTS.md, or standing briefs
- ADRs (.agnes/adr/) for past decisions
- Recent commits and their messages
- Issue tracker for similar requests
- CONTEXT-MAP.md at root — if multiple contexts exist, note which context applies before each question

**Inline CONTEXT.md Updates:** Update CONTEXT.md DURING conversation, not batched. Each resolved term definition written immediately.

**ADR Sparingly:** Only offer ADR when ALL three conditions met:
1. Decision is hard to reverse
2. Decision is surprising without context
3. Decision is result of real trade-off

Otherwise a note in CONTEXT.md suffices.

## Workflow

### 1. Explore Context

Check existing context before asking questions:
- Read project files and structure
- Read CONTEXT.md, AGENTS.md, standing briefs
- Check ADRs for past decisions
- Scan recent commits → verify: understood project state and trajectory
- Check CONTEXT-MAP.md for multi-context awareness

**Output:** Grounded understanding of project domain, language, and history.

### 2. Ask One Question at a Time

**Never** ask multiple questions in one message. Overwhelming user → incomplete answers.

Format each question:
- State what you understand so far
- Propose a recommended interpretation
- Ask a single, specific question

Example:
> "I understand you want user authentication. Codebase uses NextAuth. I think you want OAuth with Google — is that right?"

→ verify: user answered the single question before next question

**Output:** One resolved ambiguity per turn.

### 3. Sharpen Terminology

Cross-reference user's words against project glossary:
- Check CONTEXT.md for domain language
- Check existing code for naming conventions
- **Glossary-first challenge**: Term conflicts with existing doc? Call it out IMMEDIATELY. Show conflict → ask resolution
- **Sharpen fuzzy language**: "thing", "stuff", "manage", "handle" → propose precise canonical terms → get agreement
- **Concrete scenario probing**: Invent edge-case scenarios to force precision about domain boundaries

→ verify: all fuzzy terms replaced with precise project vocabulary

**Output:** Terminology resolved, glossary updated inline in CONTEXT.md.

### 4. Propose Recommended Answers

Don't just ask — offer best guess:
- "I think you mean X — is that right?"
- "Codebase suggests Y over Z. Use Y?"
- "Two options: A or B. Which one?"

→ verify: each question includes a concrete proposal

**Output:** User can confirm or correct, not start from blank.

### 5. Brainstorm Approaches

After initial clarity, propose 2-3 approaches with pros/cons.

Each approach:
- **Summary**: One-sentence description
- **Pros**: What makes this attractive
- **Cons**: Trade-offs, risks, downsides
- **Estimated effort**: Rough sizing (hours/days)

Include code sketches for critical decisions when helpful.

Recommend one approach with clear rationale. Let user choose.

→ verify: user selected an approach before proceeding

**Output:** Prioritized set of options with one recommendation.

### 6. Build Shared Understanding

Continue until:
- You can describe task back in user's words
- User confirms understanding
- No remaining ambiguities about scope, approach, or constraints

→ verify: user explicitly confirmed the clarified task description

**Output:** Shared understanding captured as written spec.

### 7. Spec Self-Review

Before marking complete, run checklist:
- **Placeholder scan**: No "TODO", "FIXME", "TBD" remain in spec
- **Consistency**: All referenced files and functions exist (or will be created)
- **Scope check**: Every item belongs in this task? No scope creep?
- **Ambiguity check**: All decisions explicit. No "figure out later" clauses

→ verify: checklist passes with zero exceptions

**Output:** Clean, complete spec ready for handoff.

### 8. Handoff

Route to appropriate next skill:
- Planning → planner
- Debugging → debugger
- Building → planner first (plans before builds)

→ verify: next skill receives clarified spec with user approval

**Output:** Clarified task routed to correct phase.

## Flow Diagram

```
[vague request] → [explore context] → [ask one question] → [sharpen terms]
                                                              │
                                                              ▼
[user confirms] ← [build understanding] ← [brainstorm] ← [propose answers]
      │
      ▼
[spec self-review] → [pass] → [handoff to next skill]
      │                      ↑
      └── [fail] → [fix] ────┘
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| read / grep | 1, 3 | Project files, doc paths | Domain context, existing terminology |
| write / edit | 3, 6 | Resolved terms | Updated CONTEXT.md, spec |
| task | 8 | Clarified spec | Routed to next skill |
| webfetch | 1 | Issue tracker URLs | External context |

## Examples

| Pattern | Before | After |
|---------|--------|-------|
| Fuzzy language | "Add user management" | "Add CRUD for user accounts with invite flow, roles, and deactivation" |
| Glossary conflict | "Add a hook for payments" (codebase uses "webhook") | "Add a webhook handler for Stripe payment events" |
| Unclear scope | "Make it faster" | "Reduce API response time for GET /products from 2s to <200ms" |
| Missing context | "Fix the bug" | "Fix auth redirect loop in middleware.ts when session token expires" |

## Output

- Clarified task description ready for routing
- Documented assumptions and decisions
- Shared understanding confirmed by user
- Inline glossary updates to CONTEXT.md

## Quality Criteria

- **Hard Gate**: No implementation until user-approved spec exists. → verify: user explicitly approved written spec before any BUILD-phase skill invoked
- **Spec Self-Review**: No TODOs/FIXMEs/TBDs, all referenced files exist, no scope creep, all decisions explicit. → verify: checklist passes
- **Shared Understanding**: Can describe task in user's words and user confirms. → verify: user verbal confirmation

## Protocol Shells

```
/protocol {
  intent="Resolve ambiguity in user request",
  input={ request="<original>", unknowns="<gaps>" },
  process=[ /decompose{gaps}, /trace{assumptions}, /synthesize{questions} ],
  output={ result="<clarified-requirements>", assumptions="<documented>" }
}
```

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break ambiguity into specific unknowns |
| /trace | Trace assumptions through their implications |
| /synthesize | Combine gaps into precise clarifying questions |

## When NOT to Use

- Task already precisely specified with no terminology conflicts or ambiguity
- During BUILD phase — this is THINK phase only
- User just needs direct implementation with no design decisions
- Purely operational request (e.g., "run this command") with no ambiguity
