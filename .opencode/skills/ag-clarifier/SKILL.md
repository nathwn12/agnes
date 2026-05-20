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

### 4. Propose Recommended Answers

Don't just ask — offer your best guess:
- "I think you mean X — is that right?"
- "Based on the codebase, Y seems more appropriate than Z. Shall I use Y?"
- "I see two possible interpretations: A or B. Which one?"

### 5. Build Shared Understanding

Keep going until:
- You can describe the task back to the user in their own words
- The user confirms your understanding
- There are no remaining ambiguities about scope, approach, or constraints

### 6. Handoff

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

## Output

- Clarified task description ready for routing
- Documented assumptions and decisions
- Shared understanding confirmed by user
