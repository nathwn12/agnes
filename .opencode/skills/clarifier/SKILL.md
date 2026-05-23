---
id: clarifier
phase: "THINK"
use_when: "Vague requests, incomplete bug reports, cross-domain terminology conflicts, before planning to ensure shared understanding."
version: 1.0
---

## Use When

Vague requests, incomplete bug reports, cross-domain terminology conflicts, before planning to ensure shared understanding.

## Core Concept

Socratic questioning that builds shared understanding through one-question-at-a-time dialogue. Sharpens terminology against the project glossary, proposes recommended answers, and handoffs clarified work to the next skill. No implementation happens until the user explicitly approves the clarified task description.

Methodology:
- **Socratic**: Questions lead the user to discover the answer themselves
- **Empathetic**: Assume good intent, start from user's context
- **Precise**: Use exact terminology from the codebase
- **Concise**: One question, one answer, repeat

A **hard gate** enforces that clarification must produce a written, user-approved spec before any BUILD-phase skill is invoked.

## Precise Vocabulary

| Term | Definition |
|------|------------|
| Shared Understanding | State where agent can describe the task back in user's words, user confirms, and no ambiguities remain about scope, approach, or constraints |
| Glossary-first Challenge | When user uses a term conflicting with existing CONTEXT.md or ADRs, call it out immediately — show the conflict and ask for resolution |
| Fuzzy Language | Vague or overloaded terms ("thing", "stuff", "manage", "handle") that must be sharpened into precise canonical terms |
| Context Scope | Active project domain (from CONTEXT-MAP.md) that should prefix each question when multiple contexts exist |
| Hard Gate | No implementation until design is approved — clarification must produce a written, user-approved spec before any BUILD-phase skill is invoked |

## Context Requirements

Before asking questions, check existing context:
- Project files and structure
- CONTEXT.md, AGENTS.md, or standing briefs
- ADRs (.agnes/adr/) for past decisions
- Recent commits and their messages
- Existing issue tracker for similar requests
- CONTEXT-MAP.md at root — if multiple contexts exist, note which context applies before each question

**Multi-Context Awareness:** Check for CONTEXT-MAP.md at project root. If multiple contexts exist, note which context applies before each question. Prefix questions with the active context scope to avoid confusion.

**Inline CONTEXT.md Updates:** Update CONTEXT.md DURING the conversation, not batched at the end. Each resolved term definition should be written immediately so the project glossary stays current in real time.

**ADR Sparingly:** Only offer an ADR when ALL three conditions are met:
1. The decision is hard to reverse
2. The decision is surprising without context
3. The decision is the result of a real trade-off

Otherwise, a note in CONTEXT.md suffices.

## Workflow

### 1. Explore Context

Before asking questions, check existing context:
- Project files and structure
- CONTEXT.md, AGENTS.md, or standing briefs
- ADRs (.agnes/adr/) for past decisions
- Recent commits and their messages
- Existing issue tracker for similar requests
- CONTEXT-MAP.md at root — if multiple contexts exist, note which context applies before each question

### 2. Ask One Question at a Time

**Critical rule**: Never ask multiple questions in a single message. Overwhelming the user leads to incomplete answers.

Format each question:
- State what you understand so far
- Propose a recommended interpretation
- Ask a single, specific question

Example:
> "I understand you want to add user authentication. Based on the existing codebase, it looks like you're using NextAuth. I think you want OAuth with Google — is that right?"

### 3. Sharpen Terminology

Cross-reference the user's words against the project glossary:
- Check CONTEXT.md for domain language
- Check existing code for naming conventions
- If terms conflict, point out the discrepancy and propose alignment
- **Glossary-first challenge**: When user uses a term that conflicts with existing CONTEXT.md or ADRs, call it out IMMEDIATELY. Show the conflict and ask for resolution.
- **Sharpen fuzzy language**: When user uses vague/overloaded terms ("thing", "stuff", "manage", "handle"), propose precise canonical terms. Get agreement.
- **Concrete scenario probing**: Invent edge-case scenarios to force precision about domain boundaries.

### 4. Propose Recommended Answers

Don't just ask — offer your best guess:
- "I think you mean X — is that right?"
- "Based on the codebase, Y seems more appropriate than Z. Shall I use Y?"
- "I see two possible interpretations: A or B. Which one?"

### 5. Brainstorming Workflow

After initial clarification is achieved, propose 2-3 approaches with pros/cons.

For each approach include:
- **Summary**: One-sentence description of the approach
- **Pros**: What makes this approach attractive
- **Cons**: Trade-offs, risks, or downsides
- **Estimated effort**: Rough sizing (hours/days)

Include code sketches for critical decisions when helpful to illustrate trade-offs.

Recommend one approach with clear rationale. Let the user choose before proceeding.

#### Visual Companion

For UI-heavy tasks, consider offering a browser-based mockup server during brainstorming:
- Quick HTML mockups to explore visual directions before committing to implementation
- Useful for layout decisions, component hierarchies, or user flow validation
- **Optional**: Ask the user if they'd like to see visual options
- Can hand off to prototype for deeper exploration if needed

### 6. Build Shared Understanding

Keep going until:
- You can describe the task back to the user in their own words
- The user confirms your understanding
- There are no remaining ambiguities about scope, approach, or constraints

### 7. Spec Self-Review Checklist

Before marking clarification complete, run through this checklist:

- **Placeholder scan**: No "TODO", "FIXME", or "TBD" remain in the spec or task description
- **Consistency**: All referenced files and functions exist (or will be created)
- **Scope check**: Every item belongs in this task? No scope creep from adjacent concerns?
- **Ambiguity check**: All decisions are explicit. No "figure out later" or "decided by implementer" clauses

### 8. Handoff

Once clarified, route to the appropriate next skill:
- Call `ag_route` with the clarified task
- If planning: route to planner
- If debugging: route to debugger
- If building: route to planner first (plans before builds)

## Tool Requirements

- **read / grep**: Explore project context, files, and structure
- **task**: Route clarified work to the next skill
- **write / edit**: Update CONTEXT.md inline with resolved terminology
- **webfetch**: Access issue trackers and external context

## Output

- Clarified task description ready for routing
- Documented assumptions and decisions
- Shared understanding confirmed by user

## Quality Criteria

- **Hard Gate**: No implementation until design is approved. Even for "simple" projects. "I'll just start coding" is not allowed. Clarification must produce a written, user-approved spec before any BUILD-phase skill is invoked. The gate passes only when:
  - User has explicitly approved the clarified task description
  - Spec passes self-review checklist
  - All terminology conflicts are resolved and documented
- **Spec Self-Review**: Before marking complete, run the checklist: no TODOs/FIXMEs/TBDs, all referenced files exist, no scope creep, all decisions explicit.
- **Shared Understanding**: You can describe the task back in user's words and user confirms.

## When NOT to Use

- When the task is already precisely specified with no terminology conflicts or ambiguity
- During execution or BUILD phase — this skill is for THINK phase only
- When the user just needs direct implementation with no design decisions needed
- When the issue is purely operational (e.g., "run this command") with no ambiguity
