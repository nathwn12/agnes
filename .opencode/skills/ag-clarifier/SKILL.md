---
name: ag-clarifier
description: Socratic questioning skill that builds shared understanding — asks one question at a time, sharpens terminology against project glossary, and handoffs to the next skill
---

## Phase: THINK

Use when: vague requests, incomplete bug reports, cross-domain terminology conflicts, before planning to ensure shared understanding.

## Process

### 1. Explore Context

Before asking questions, check existing context:
- Project files and structure
- CONTEXT.md, AGENTS.md, or standing briefs
- ADRs (docs/adr/) for past decisions
- Recent commits and their messages
- Existing issue tracker for similar requests
- **CONTEXT-MAP.md** at root — if multiple contexts exist, note which context applies before each question

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
- Check `CONTEXT.md` for domain language
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

After initial clarification is achieved, propose 2-3 approaches with pros/cons:

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
- Can hand off to ag-prototype for deeper exploration if needed

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
- If planning: route to ag-planner
- If debugging: route to ag-debugger
- If building: route to ag-planner first (plans before builds)

## Methodology

- **Socratic**: Questions lead the user to discover the answer themselves
- **Empathetic**: Assume good intent, start from user's context
- **Precise**: Use exact terminology from the codebase
- **Concise**: One question, one answer, repeat

### Inline CONTEXT.md Updates

Update CONTEXT.md DURING the conversation, not batched at the end. Each resolved term definition should be written immediately so the project glossary stays current in real time.

### ADR Sparingly

Only offer an ADR when ALL three conditions are met:
1. The decision is hard to reverse
2. The decision is surprising without context
3. The decision is the result of a real trade-off

Otherwise, a note in CONTEXT.md suffices.

### Multi-Context Awareness

Check for CONTEXT-MAP.md at project root. If multiple contexts exist, note which context applies before each question. Prefix questions with the active context scope to avoid confusion.

## Hard Gate

**No implementation until design is approved.** Even for "simple" projects. "I'll just start coding" is not allowed. Clarification must produce a written, user-approved spec before any BUILD-phase skill is invoked. The gate passes only when:
- User has explicitly approved the clarified task description
- Spec passes self-review checklist (Section 7)
- All terminology conflicts are resolved and documented

## Output

- Clarified task description ready for routing
- Documented assumptions and decisions
- Shared understanding confirmed by user
