---
id: prototype
name: prototype
description: 'Need to explore a design before committing, sanity-check a data model, mock up UI variations, or answer "does this feel right?" without building real infrastructure.'
phase: "DESIGN / BUILD"
use_when: "Need to explore a design before committing, sanity-check a data model, mock up UI variations, or answer \"does this feel right?\" without building real infrastructure."
version: 1.1
---

## Use When

Explore design before committing, sanity-check data model/state machine, mock UI variations, answer "does this feel right?" without building real infra. User says "prototype this", "let me play with it", "try a few designs", or quick experiment beats long planning.

## Core Concept

Prototype = **throwaway code answering exactly one question**. Question decides shape. Two branches:

- **"Does this logic / state model feel right?"** → LOGIC branch. Tiny interactive terminal app pushing state machine through hard-to-reason cases.
- **"What should this look like?"** → UI branch. Several radically different UI variations on one route, switchable via URL search param + floating bottom bar.

Branches produce very different artifacts — wrong branch wastes prototype. If ambiguous, default to branch matching surrounding code (backend → logic; page/component → UI). State assumption explicitly.

No persistence. No tests. No polish. Capture answer, delete or fold into real code.

## Rules That Apply to Both Branches

1. **Throwaway from day one, clearly marked.** Locate near usage context. Name so casual reader sees prototype, not production.
2. **One command to run.** Use existing task runner — `pnpm <name>`, `python <path>`, `bun <path>`. User starts without thinking.
3. **No persistence by default.** State in memory. If question involves DB, hit scratch store with "PROTOTYPE — wipe me" name.
4. **Skip polish.** No tests, no error handling beyond runnability, no abstractions. Learn fast, delete.
5. **Surface state.** After every action (logic) or variant switch (UI), print/render full relevant state.
6. **Delete or absorb when done.** Don't leave rotting in repo.

## LOGIC Branch — "Does this logic / state model feel right?"

Question about business logic, state transitions, data shape — looks reasonable on paper, feels wrong when pushed through real cases.

### When This Is the Right Shape

- "I'm not sure if this state machine handles edge case X then Y."
- "Does this data model let me represent case where..."
- "I want to feel out API shape before writing it."
- Anything where user presses buttons and watches state change.

### Process

1. **State question.** Write state model + question at top of file. Prototype answering wrong question = pure waste.

2. **Pick language.** Use host project's language. Match tooling conventions — no new package manager/runtime.

3. **Isolate logic in portable module.** Pure interface that can lift into real codebase. TUI is throwaway; logic module isn't. Pick shape:
   - **Pure reducer** — `(state, action) => state`. Discrete events, single value state.
   - **State machine** — explicit states/transitions. "Which actions are legal right now" is part of question.
   - **Pure functions** over plain data type. No implicit current state — just transformations.
   - **Class/module with clear method surface** when logic owns ongoing internal state.
   
   Keep pure: no I/O, no terminal code, no `console.log` for control flow. TUI imports and calls into it; nothing flows other direction. This makes prototype useful past its life — validated reducer/machine/function set lifts into real module.

4. **Build smallest TUI exposing state.** Clear screen, re-render whole frame each tick. Two parts:
   - **Current state** — pretty-printed, diff-friendly (one field per line or formatted JSON). Bold field names, dim less important context. Native ANSI codes fine.
   - **Keyboard shortcuts** at bottom: `[a] add user  [d] delete user  [q] quit`.
   
   Init state → render first frame → read keystroke → dispatch → re-render → loop until quit. Whole frame fits one screen.

5. **One command to run.** Add script to project's task runner. User runs `pnpm run <prototype-name>` — never remembers path.

6. **Hand it over.** Give run command. User drives. Interesting moments: "wait, that shouldn't be possible" or "huh, I assumed X would be different" — bugs in the _idea_, which is the point.

7. **Capture answer.** Answer is only thing worth keeping. If user around, ask what it taught. If not, leave NOTES.md next to prototype for answer before deletion.

### LOGIC Anti-patterns

- **Don't add tests.** Prototype needing tests isn't a prototype.
- **Don't wire to real DB.** In-memory store unless question is about persistence.
- **Don't generalise.** No "what if we wanted X later." One question.
- **Don't blur logic and TUI.** Reducer referencing `console.log` or terminal codes isn't portable. TUI = thin shell over pure module.
- **Don't ship TUI shell to production.** Shell optimised for terminal driving. Logic module behind it is worth keeping.

## UI Branch — "What should this look like?"

Generate radically different UI variations on one route, switchable from floating bottom bar. User flips variants in browser, picks one (or steals bits from each), throws rest away.

### When This Is the Right Shape

- "What should this page look like?"
- "I want to see options for this dashboard before committing."
- "Try a different layout for settings."
- User would spend a day picking between vague mockups in their head.

### Two Sub-shapes — Strongly Prefer Sub-shape A

UI prototype easier to judge against real app — real header, sidebar, data, density.

**Sub-shape A — adjustment to existing page (preferred).** Route exists. Variants rendered on same route, gated by `?variant=` URL param. Existing data fetching, params, auth stay — only rendering swaps. For something without a page that would live inside one (new dashboard section, new card on settings), mount variants inside host page.

**Sub-shape B — new page (last resort).** Only when prototyped thing has no existing page. Create throwaway route following project routing convention. Name obviously prototype. Same `?variant=` pattern. Sanity-check: really no existing page to embed in?

### Process

1. **State question, pick N variants.** Default 3. >5 stops being radically different, becomes noise. One-line plan: "Three variants of settings page, switchable via `?variant=`, on existing `/settings` route."

2. **Generate radically different variants.** Structurally different — layout, info hierarchy, primary affordance, not colours. Three slightly-tweaked card grids isn't a UI prototype. If two drafts too similar, redo one with "do not use card grid" guidance. Each variant: clear exported component name — `VariantA`, `VariantB`, `VariantC`.

3. **Wire with switcher component.**
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
   Sub-shape A: keep data fetching above switcher; only rendered subtree changes. Sub-shape B: throwaway route mounts same pattern.

4. **Build floating switcher.** Fixed-position bar at bottom-centre:
   - Left arrow — cycles to previous variant (wraps).
   - Variant label — current variant key + name, e.g. `B — Sidebar layout`.
   - Right arrow — cycles forward (wraps).
   
   Clicking updates URL search param — shareable, reload-stable. `←` `→` keys also cycle (don't intercept when input focused). Visually distinct from page. Hidden in production (`NODE_ENV !== 'production'`). Single shared component for both sub-shapes.

5. **Hand it over.** Surface URL + `?variant=` keys. User flips through. Interesting feedback: "I want header from B with sidebar from C" — that's actual design they want.

6. **Capture answer + clean up.** Once variant wins, write down which and why. Sub-shape A: delete losing variants + switcher, fold winner into existing page. Sub-shape B: promote winner to real route, delete throwaway route + switcher.

### UI Anti-patterns

- **Variants differing only in colour/copy.** Tweak, not prototype. Real variants disagree about structure.
- **Sharing too much code between variants.** Shared `<Header>` fine; shared `<Layout>` defeats point. Each variant free to throw out layout.
- **Wiring variants to real mutations.** Read-only prototypes fine. If variant needs mutate, point at stub — question is "what should this look like", not "does backend work".
- **Promoting prototype directly to production.** Written under prototype constraints (no tests, minimal error handling). Rewrite properly when folding in.

## Precise Vocabulary

| Term | Meaning |
|------|---------|
| LOGIC branch | Terminal TUI prototype exploring state model or business logic |
| UI branch | Visual prototype exploring structural UI layout variations |
| LIFTED | Logic module extracted from prototype into production without TUI shell |
| Variant | One of 3–5 structurally different UI implementations in UI prototype |
| Throwaway code | Code written to answer exactly one question, then discarded |
| Sub-shape A | Prototype variants hosted on existing route with real data fetching |
| Sub-shape B | Prototype variants hosted on dedicated throwaway route |
| Switcher | Floating bottom-centre bar for cycling between UI variants |

## Context Requirements

- Exact question prototype must answer
- Whether question is about logic/state models (LOGIC) or UI/layout (UI)
- LOGIC branch: domain language and data model
- UI branch: existing route/page hosting variants

## Workflow

1. State question explicitly
2. Pick branch (LOGIC or UI) based on question type
3. One command to run
4. Explore until question answered
5. Capture answer
6. Delete prototype OR fold logic module into production

## Tool Requirements

- **Bash**: Run prototype (terminal TUI for LOGIC, dev server for UI)
- **Question**: Clarify and state exact question being explored

## Output

Throwaway code answering exactly one question. LOGIC: cleanly separated state module ready for LIFTING into production. UI: 3–5 structurally different UI variants gated behind `?variant=` param, hidden in production builds.

## Quality Criteria

- Question answered with confidence (yes / no / direction chosen)
- Exactly one question explored — no scope creep
- LOGIC: state module independently portable and testable
- UI: variants structurally different, not cosmetic
- Prototype clearly marked throwaway, deletable with no side effects
- Winning design direction captured durably (commit message, ADR, NOTES.md)

## When NOT to Use

- When tests needed (prototypes explore, don't verify)
- When real persistence or DB required
- When generalisation is goal (solve ONE question)
- When prototype code promotes directly to production — rewrite with proper architecture first
- When question already answered — don't prototype for curiosity
