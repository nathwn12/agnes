---
id: prototype
name: prototype
description: 'Need to explore a design before committing, sanity-check a data model, mock up UI variations, or answer "does this feel right?" without building real infrastructure.'
phase: "DESIGN / BUILD"
use_when: "Need to explore a design before committing, sanity-check a data model, mock up UI variations, or answer \"does this feel right?\" without building real infrastructure."
version: 1.2
---

# Prototype Skill

> **Tradeoff:** Speed vs confidence. Prototypes answer one question fast with throwaway code (no tests, no persistence, no polish). Cost: manual delete-or-fold at end. Use when exploration beats planning. Avoid when verified, shippable quality required.

## Use When

Need to explore a design before committing, sanity-check a data model or state machine, mock up UI variations, or answer "does this feel right?" without building real infrastructure. Invoke when user says "prototype this", "let me play with it", "try a few designs" — any time a quick experiment beats a long planning session.

## Core Concept

Prototype is **throwaway code that answers exactly one question**. Two branches:

- **LOGIC branch** — business logic / state model → interactive terminal TUI
- **UI branch** — visual layout → N structurally different variants switchable via `?variant=`

**No persistence. No tests. No polish. Capture answer, delete or fold.**

### Rules That Apply to Both

1. **Throwaway, clearly marked.** Named so a reader knows it's not production.
2. **One command to run.** `pnpm <name>`, `python <path>`, `bun <path>` — whatever project uses.
3. **No persistence by default.** State in memory. If question is about DB, scratch store with clear "PROTOTYPE — wipe me" name.
4. **Skip polish.** No tests, no error handling beyond runnability, no abstractions. Learn fast, delete fast.
5. **Surface state.** After every action (LOGIC) or variant switch (UI), render full relevant state.
6. **Delete or absorb when done.** No rotting prototype code in repo.

### LOGIC Branch — "Does this logic / state model feel right?"

Use when question is about business logic, state transitions, or data shape. Looks reasonable on paper but needs to be pushed through real cases.

**When this is the right shape:**
- "Does this state machine handle edge case X→Y?"
- "Does this data model let me represent case Z?"
- "What should the API feel like before I write it?"
- Anything where user wants to press buttons and watch state change.

**Process:**

1. **State the question.** One paragraph at top of file. Wrong question = pure waste.
2. **Pick the language.** Match host project conventions. No new package manager or runtime.
3. **Isolate logic in a portable pure module** — reducer `(state, action) => state`, state machine, pure functions, or class with clear method surface. No I/O, no terminal code, no `console.log` for control flow. TUI imports it, nothing flows back.
   → verify: module has zero I/O dependencies, is liftable into real codebase
4. **Build smallest TUI exposing state.** Clear screen, re-render whole frame each tick. Two parts: current state (pretty-printed, diff-friendly) + keyboard shortcuts at bottom. Init → render → read keystroke → dispatch → re-render → loop.
   → verify: whole frame fits one screen, state visible after every action
5. **Make runnable in one command.** Add script to existing task runner.
   → verify: `pnpm run <prototype-name>` launches it
6. **Hand it over.** User drives. Interesting moments: "wait, that shouldn't be possible" — bugs in the *idea*, which is the point.
7. **Capture answer.** If user around, ask what it taught. If not, leave NOTES.md for answer before deletion.
   → verify: answer documented or user confirmed understanding

**Anti-patterns:**
- No tests (prototype needing tests isn't a prototype)
- No real DB (in-memory unless question is about persistence)
- No generalisation ("what if we wanted X later" — answer ONE question)
- No blurring logic/TUI (reducer referencing console.log = no longer portable)
- Don't ship TUI shell to production (logic module behind it is worth keeping)

### UI Branch — "What should this look like?"

N structurally different UI variations on one route, switchable from floating bottom bar. User flips between variants, picks one (or steals bits), throws rest away.

**When this is the right shape:**
- "What should this page look like?"
- "Try a few options for this dashboard before committing."
- "Different layout for settings screen."
- Any time user would spend a day picking between vague mockups.

**Sub-shape A — adjustment to existing page (preferred).** Variants on same route gated by `?variant=`. Existing data fetching, params, auth stay — only rendering swaps.

**Sub-shape B — new throwaway route (last resort).** Only when prototype genuinely has no existing page to live inside.

**Process:**

1. **State question, pick N variants (default 3, max 5).** Write plan in one line: "Three variants of settings page on `/settings?variant=`".
   → verify: N between 3–5, question explicitly stated
2. **Generate radically different variants.** Different layout, info hierarchy, primary affordance — not just colours. If two look similar, redo one with "do not use card grid" guidance. Exported names: `VariantA`, `VariantB`, `VariantC`.
   → verify: each variant structurally distinct, not just cosmetic
3. **Wire with switcher component:**
   ```tsx
   const variant = searchParams.get('variant') ?? 'A';
   return (
     <>
       {variant === 'A' && <VariantA {...data} />}
       {variant === 'B' && <VariantB {...data} />}
       {variant === 'C' && <VariantC {...data} />}
       <PrototypeSwitcher variants={['A','B','C']} current={variant} />
     </>
   );
   ```
   Sub-shape A: keep data fetching above switcher. Sub-shape B: throwaway route mounts same pattern.
   → verify: `?variant=` param URL-stable and shareable
4. **Build floating switcher.** Fixed bottom-centre bar: left arrow, variant label (`B — Sidebar layout`), right arrow. Click updates URL. `←` `→` keyboard (not when input focused). Hidden in production (`NODE_ENV !== 'production'`).
   → verify: arrows cycle, keyboard works, hidden in production
5. **Hand it over.** Surface URL and `?variant=` keys. User feedback: "header from B, sidebar from C" — that's the design.
6. **Capture answer, clean up.** Write down winner and why. Sub-shape A: delete losers + switcher, fold winner into page. Sub-shape B: promote winner to real route, delete throwaway route + switcher.
   → verify: loser variants deleted, winner folded, no leftover prototype artifacts

**Anti-patterns:**
- Variants differing only in colour/copy (tweak ≠ prototype)
- Shared `<Layout>` between variants (defeats purpose — free to throw out layout)
- Wiring to real mutations (read-only is fine; stub if mutation needed)
- Promoting prototype directly to production (rewrite with proper architecture)

## Precise Vocabulary

| Term | Meaning |
|------|---------|
| LOGIC branch | Terminal TUI prototype exploring state model or business logic |
| UI branch | Visual prototype exploring structural layout variations |
| LIFTED | Logic module extracted from prototype into production without TUI shell |
| Variant | One of 3–5 structurally different UI implementations |
| Throwaway code | Code written to answer one question, then discarded |
| Sub-shape A | Variants hosted on existing route with real data fetching |
| Sub-shape B | Variants hosted on dedicated throwaway route |
| Switcher | Floating bottom-centre bar for cycling UI variants |

## Context Requirements

- Exact question prototype must answer
- Question type: logic/state (LOGIC) or UI/layout (UI)
- LOGIC: domain language and data model
- UI: existing route/page that will host variants

## Workflow

1. State question explicitly
2. Pick branch (LOGIC / UI) based on question type
3. One command to run
4. Explore until answer found
5. Capture answer
6. Delete prototype OR fold logic module into production

## Flow Diagram

```
                    ┌──────────────┐
                    │  Question?   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Pick branch │
                    └──┬───────┬───┘
                       │       │
              ┌────────▼┐  ┌───▼────────┐
              │  LOGIC   │  │     UI     │
              │ terminal │  │  variants  │
              │  TUI     │  │ switchable │
              └────┬─────┘  └─────┬──────┘
                   │              │
              ┌────▼─────┐  ┌────▼──────┐
              │  Answer  │  │  Answer   │
              │ captured │  │ captured  │
              └──────────┘  └───────────┘
```

## Tool-Phase Mapping

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| Bash | BUILD | run command | prototype execution |
| Question | DESIGN | prototype question | clarified scope |
| Write | BUILD | prototype code | throwaway files |
| Edit | BUILD | code changes | variant adjustments |

## Examples

| Scenario | Branch | Question | Output |
|----------|--------|----------|--------|
| State machine edge cases | LOGIC | "Does this state handle X→Y?" | TUI + portable reducer |
| Dashboard layout options | UI | "What should dashboard look like?" | 3 variants on existing route |
| API shape exploration | LOGIC | "Does this API feel ergonomic?" | Terminal mock client |
| New settings page | UI | "Try layouts for settings" | 3 variants on throwaway route |
| Data model validation | LOGIC | "Can this model represent edge case Z?" | TUI + liftable pure functions |

## Phase Outputs

- **LOGIC branch**: portable pure state module (LIFT-able) + throwaway terminal TUI
- **UI branch**: N structurally different UI variants + switcher component + winner documented

## Quality Criteria

→ verify: question answered with confidence (yes / no / direction chosen)
→ verify: exactly one question explored — no scope creep
→ verify: LOGIC branch state module independently portable and testable
→ verify: UI branch variants structurally different, not cosmetic
→ verify: prototype clearly marked as throwaway, deletable with no side effects
→ verify: winning direction captured (commit message, ADR, or NOTES.md)

## Protocol Shell

```
/protocol {
  intent="Explore design space before committing to implementation",
  input={ question="<what-to-validate>", constraints="<boundaries>" },
  process=[ /decompose{variations}, /compare{tradeoffs}, /synthesize{recommendation} ],
  output={ result="<prototype>" }
}
```

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break design into independent validation axes |
| /compare | Evaluate alternative approaches against criteria |
| /abstract | Extract general patterns from prototype results |

## When NOT to Use

- When tests are needed (prototypes explore, they don't verify)
- When real persistence or DB required
- When generalisation is the goal (solve ONE question)
- When prototype code should be promoted directly to production — rewrite with proper architecture
- When question already answered — don't prototype for curiosity's sake
