---
name: ag-prototype
description: Build throwaway code to answer exactly one question — two branches: logic (terminal TUI) or UI (variant-switching route)
phase: DESIGN / BUILD
---

## Use When

Need to explore a design before committing, sanity-check a data model, mock up UI variations, or answer "does this feel right?" without building real infrastructure.

## Core Concept

Build throwaway code that answers **exactly one question**. No persistence. No tests. No polish. Capture the answer, then delete or fold into real code.

## Branches

### LOGIC branch — "Does this logic / state model feel right?"

- Isolate pure logic in a portable module (reducer, state machine, pure functions — no I/O)
- Build a tiny interactive terminal TUI that pushes the state machine through edge cases
- TUI is a thin shell: clear screen + re-render on every keystroke
- Surface full state after every action
- The logic module can be **LIFTED** into production; only the TUI is deleted
- State the question explicitly before starting
- Pick language based on what best models the domain

### UI branch — "What should this look like?"

- 3 variants by default (max 5), must be **STRUCTURALLY** different (not just different colors)
- Sub-shape A (preferred): variants render on same existing route, same data fetching, gated by `?variant=` param
- Sub-shape B: throwaway route only when no plausible host page exists
- Floating bottom-centre bar with arrows and keyboard ←/→ for switching
- Shareable via URL (variant in query string)
- Hidden in production builds (`NODE_ENV !== 'production'`)

## Anti-patterns (Enforced)

- No tests (you're exploring, not verifying)
- No real database or persistence
- No generalisation (solve exactly ONE question)
- Do NOT share too much code between UI variants (they should be structurally different)
- Do NOT promote prototype code directly to production (rewrite with proper architecture)

## Workflow

1. State the question explicitly
2. Pick the branch (LOGIC or UI) based on question type
3. One command to run
4. Explore until the question is answered
5. Capture the answer
6. Delete prototype OR manually fold logic module into production
