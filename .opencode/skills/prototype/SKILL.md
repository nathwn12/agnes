---
id: prototype
phase: "DESIGN / BUILD"
use_when: "Need to explore a design before committing, sanity-check a data model, mock up UI variations, or answer \"does this feel right?\" without building real infrastructure."
version: 1.0
---

## Use When

Need to explore a design before committing, sanity-check a data model, mock up UI variations, or answer "does this feel right?" without building real infrastructure.

## Core Concept

Build throwaway code that answers **exactly one question**. No persistence. No tests. No polish. Capture the answer, then delete or fold into real code.

Two branches exist depending on the nature of the question:

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

## Precise Vocabulary

| Term | Meaning |
|------|---------|
| LOGIC branch | Terminal TUI prototype exploring a state model or business logic |
| UI branch | Visual prototype exploring structural UI layout variations |
| LIFTED | Logic module extracted from prototype into production code without the TUI shell |
| Variant | One of 3–5 structurally different UI implementations in a UI prototype |
| Throwaway code | Code written to answer exactly one question, then discarded |

## Context Requirements

- The exact question the prototype must answer
- Whether the question is about logic/state models (LOGIC branch) or UI/layout (UI branch)
- For LOGIC branch: the domain language and data model to use
- For UI branch: the existing route or page that will host the variants

## Workflow

1. State the question explicitly
2. Pick the branch (LOGIC or UI) based on question type
3. One command to run
4. Explore until the question is answered
5. Capture the answer
6. Delete prototype OR manually fold logic module into production

## Tool Requirements

- **Bash**: Run the prototype (terminal TUI for LOGIC branch, dev server for UI branch)
- **Question**: Clarify and state the exact question being explored

## Output

Throwaway code answering exactly one question. LOGIC branch produces a cleanly separated state module ready for LIFTING into production. UI branch produces 3–5 structurally different UI variants gated behind a `?variant=` query parameter, hidden in production builds.

## Quality Criteria

- The question is answered with confidence (yes / no / direction chosen)
- Exactly one question was explored — no scope creep
- LOGIC branch: state module is independently portable and testable
- UI branch: variants are structurally different, not just cosmetic

## When NOT to Use

- When tests are needed (prototypes explore, they don't verify)
- When real persistence or a database is required
- When generalisation is the goal (solve exactly ONE question, not all of them)
- When prototype code should be promoted directly to production — rewrite with proper architecture first
