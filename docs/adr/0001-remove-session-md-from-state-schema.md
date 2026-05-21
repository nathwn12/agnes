# ADR-0001: Remove `session.md` from State Schema

## Status

Accepted

## Context

AGNES originally defined four state files in `docs/agnes/`: `goal.md`, `plan.md`, `session.md`, and `handoff.md`. The `session.md` file was intended for smart-zone tracking — a runtime artifact recording session age and boundary decisions.

In practice, `session.md` was never implemented by the runtime (`src/runtime.ts`, `src/state.ts`). It existed only as a template in the `ag-init` skill and as references across docs and skills. The smart/dumb zone boundary decision is a runtime heuristic (token count, turn count) that doesn't benefit from being persisted to a file — it's assessed per-wave, not stored.

The mismatch between the documented schema (4 files) and the code (3 recognized files) created drift. Every doc and skill had to maintain the fiction of a `session.md` that didn't function.

## Decision

Reduce the state file schema from 4 to 3 files. Remove all references to `session.md` across:
- `ag-init/SKILL.md` — template and verify steps
- `ag-orchestrator/SKILL.md` — lifecycle diagram
- `README.md` — state directory tree

The concept of "session age" remains in the orchestrator's lifecycle as a runtime check, not a file. The diagram now reads "Check session age" instead of "Check session.md".

## Consequences

- One fewer file for users to create and maintain in `docs/agnes/`
- All skills and runtime now agree on a 3-file schema
- Existing projects with `session.md` won't break — unrecognized files are harmless
- `ag-init` will no longer create `session.md` templates for new projects
