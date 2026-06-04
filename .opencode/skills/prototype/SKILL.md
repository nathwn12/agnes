---
name: prototype
id: prototype
phase: 'DESIGN / BUILD'
description: 'Need to explore a design before committing, sanity-check a data model, mock up UI variations, or answer "does this feel right?" without building real infrastructure.'
---
## RULES
- Prototype = throwaway code answering exactly one question
- No tests, no persistence, no polish, no error handling beyond runnability
- Clearly marked throwaway. One command to run
- Surface full state after every action or variant switch
- Delete or absorb when done. Never leave rotting in repo
- LOGIC branch: portable pure module (reducer/machine/functions). TUI = thin shell
- UI branch: 3-5 structurally different variants, switchable via `?variant=` URL param
- Variants disagree on structure/layout/info hierarchy — not cosmetic
- No TUI code in production. No promoting prototype directly

## FLOW
1. State exact question prototype must answer
2. Pick branch: LOGIC (state/business logic) or UI (visual layout)
3. Build minimal artifact — one command to run
4. Explore until question answered
5. Capture answer (NOTES.md or discussion)
6. Delete prototype OR fold logic module into production

## TRIGGERS
- "Prototype this", "let me play with it", "try a few designs"
- Need to explore design before committing
- Sanity-check data model, state machine, or UI variations before building real infra

## NEXT
- tdd — after prototype validated, write proper tests
- general — after prototype validated, build production version

