---
id: prototype
name: prototype
description: 'Need to explore a design before committing, sanity-check a data model, mock up UI variations, or answer "does this feel right?" without building real infrastructure.'
phase: "DESIGN / BUILD"
use_when: "Need to explore a design before committing, sanity-check a data model, mock up UI variations, or answer \"does this feel right?\" without building real infrastructure."
version: 1.1
---

## Use When

Need to explore a design before committing, sanity-check a data model or state machine, mock up UI variations, or answer "does this feel right?" without building real infrastructure. Invoke when the user says "prototype this", "let me play with it", "try a few designs", or any time a quick experiment would beat a long planning session.

## Core Concept

A prototype is **throwaway code that answers exactly one question**. The question decides the shape. Two branches exist depending on the nature of the question:

- **"Does this logic / state model feel right?"** → LOGIC branch. Build a tiny interactive terminal app that pushes the state machine through cases that are hard to reason about on paper.
- **"What should this look like?"** → UI branch. Generate several radically different UI variations on a single route, switchable via a URL search param and a floating bottom bar.

The two branches produce very different artifacts — getting this wrong wastes the whole prototype. If the question is genuinely ambiguous, default to whichever branch better matches the surrounding code (a backend module → logic; a page or component → UI) and state the assumption explicitly.

No persistence. No tests. No polish. Capture the answer, then delete or fold into real code.

## Rules That Apply to Both Branches

1. **Throwaway from day one, clearly marked.** Locate prototype code close to where it will actually be used so context is obvious — but name it so a casual reader can see it's a prototype, not production.
2. **One command to run.** Whatever the project's existing task runner supports — `pnpm <name>`, `python <path>`, `bun <path>`, etc. The user must be able to start it without thinking.
3. **No persistence by default.** State lives in memory. Persistence is the thing the prototype is _checking_, not something it should depend on. If the question explicitly involves a database, hit a scratch store with a clear "PROTOTYPE — wipe me" name.
4. **Skip the polish.** No tests, no error handling beyond what makes the prototype _runnable_, no abstractions. The point is to learn something fast and then delete it.
5. **Surface the state.** After every action (logic) or on every variant switch (UI), print or render the full relevant state so the user can see what changed.
6. **Delete or absorb when done.** When the prototype has answered its question, either delete it or fold the validated decision into the real code — don't leave it rotting in the repo.

## LOGIC Branch — "Does this logic / state model feel right?"

Use when the question is about business logic, state transitions, or data shape — the kind of thing that looks reasonable on paper but only feels wrong once you push it through real cases.

### When This Is the Right Shape

- "I'm not sure if this state machine handles the edge case where X then Y."
- "Does this data model actually let me represent the case where..."
- "I want to feel out what the API should look like before writing it."
- Anything where the user wants to press buttons and watch state change.

### Process

1. **State the question.** Write down what state model and what question you're prototyping. One paragraph at the top of the file. A logic prototype that answers the wrong question is pure waste.

2. **Pick the language.** Use whatever the host project uses. Match existing conventions for tooling — don't add a new package manager or runtime just for the prototype.

3. **Isolate the logic in a portable module.** Put the actual logic behind a small, pure interface that could be lifted out and dropped into the real codebase later. The TUI around it is throwaway; the logic module shouldn't be. Choose the right shape for the question:
   - **A pure reducer** — `(state, action) => state`. Good when actions are discrete events and state is a single value.
   - **A state machine** — explicit states and transitions. Good when "which actions are even legal right now" is part of the question.
   - **A small set of pure functions** over a plain data type. Good when there's no implicit current state — just transformations.
   - **A class or module with a clear method surface** when the logic genuinely owns ongoing internal state.
   
   Keep it pure: no I/O, no terminal code, no `console.log` for control flow. The TUI imports it and calls into it; nothing flows the other direction. This is what makes the prototype useful past its own lifetime — the validated reducer / machine / function set can be lifted into the real module.

4. **Build the smallest TUI that exposes the state.** On every tick, clear the screen and re-render the whole frame. Each frame has two parts:
   - **Current state**, pretty-printed and diff-friendly (one field per line, or formatted JSON). Bold field names, dim less important context. Native ANSI escape codes are fine.
   - **Keyboard shortcuts**, listed at the bottom: `[a] add user  [d] delete user  [q] quit`.
   
   Behaviour: initialise state → render first frame → read keystroke → dispatch → re-render → loop until quit. The whole frame should fit on one screen.

5. **Make it runnable in one command.** Add a script to the project's existing task runner. The user should run `pnpm run <prototype-name>` — never need to remember a path.

6. **Hand it over.** Give the user the run command. They'll drive it themselves; the interesting moments are when they say "wait, that shouldn't be possible" or "huh, I assumed X would be different" — those are bugs in the _idea_, which is the whole point.

7. **Capture the answer.** When the prototype has done its job, the answer is the only thing worth keeping. If the user is around, ask what it taught them. If not, leave a NOTES.md next to the prototype so the answer can be filled in before deletion.

### LOGIC Anti-patterns

- **Don't add tests.** A prototype that needs tests is no longer a prototype.
- **Don't wire it to the real database.** Use an in-memory store unless the question is specifically about persistence.
- **Don't generalise.** No "what if we wanted to support X later." The prototype answers one question.
- **Don't blur the logic and TUI together.** If the reducer references `console.log` or terminal escape codes, it's no longer portable. Keep the TUI as a thin shell over a pure module.
- **Don't ship the TUI shell into production.** The shell is optimised for terminal driving. The logic module behind it is the bit worth keeping.

## UI Branch — "What should this look like?"

Generate several radically different UI variations on a single route, switchable from a floating bottom bar. The user flips between variants in the browser, picks one (or steals bits from each), then throws the rest away.

### When This Is the Right Shape

- "What should this page look like?"
- "I want to see a few options for this dashboard before committing."
- "Try a different layout for the settings screen."
- Any time the user would otherwise spend a day picking between vague mockups in their head.

### Two Sub-shapes — Strongly Prefer Sub-shape A

A UI prototype is much easier to judge when it's butting up against the rest of the app — real header, real sidebar, real data, real density.

**Sub-shape A — adjustment to an existing page (preferred).** The route already exists. Variants are rendered on the same route, gated by a `?variant=` URL search param. The existing data fetching, params, and auth all stay — only the rendering swaps. If the prototype is for something that doesn't yet have a page but would naturally live inside one (a new section of the dashboard, a new card on the settings screen), mount the variants inside the host page.

**Sub-shape B — a new page (last resort).** Only when the thing being prototyped genuinely has no existing page to live inside. Create a throwaway route following whatever routing convention the project already uses. Name it so it's obviously a prototype. Same `?variant=` pattern. Before committing, sanity-check: is there really no existing page this could be embedded in?

### Process

1. **State the question and pick N variants.** Default to 3. More than 5 stops being radically different and starts being noise. Write down the plan in one line: "Three variants of the settings page, switchable via `?variant=`, on the existing `/settings` route."

2. **Generate radically different variants.** Variants must be structurally different — different layout, different information hierarchy, different primary affordance, not just different colours. Three slightly-tweaked card grids isn't a UI prototype. If two drafts come out too similar, redo one with explicit "do not use a card grid" guidance. Each variant should have a clear exported component name: `VariantA`, `VariantB`, `VariantC`.

3. **Wire them together with a switcher component.**
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
   For sub-shape A: keep existing data fetching above the switcher; only the rendered subtree changes. For sub-shape B: the throwaway route mounts the same pattern.

4. **Build the floating switcher.** A small fixed-position bar at the bottom-centre with three pieces:
   - Left arrow — cycles to the previous variant (wraps around).
   - Variant label — shows the current variant key and name, e.g. `B — Sidebar layout`.
   - Right arrow — cycles forward (wraps around).
   
   Clicking updates the URL search param so the variant is shareable and reload-stable. Keyboard `←` and `→` also cycle (don't intercept when an input is focused). Visually distinct from the page. Hidden in production builds (`NODE_ENV !== 'production'`). Put the switcher in a single shared component so both sub-shapes can reuse it.

5. **Hand it over.** Surface the URL and `?variant=` keys. The user flips through. The interesting feedback is usually "I want the header from B with the sidebar from C" — that's the actual design they want.

6. **Capture the answer and clean up.** Once a variant has won, write down which one and why. Then: for sub-shape A, delete losing variants and the switcher, fold the winner into the existing page. For sub-shape B, promote the winner to a real route, delete the throwaway route and the switcher.

### UI Anti-patterns

- **Variants that differ only in colour or copy.** That's a tweak, not a prototype. Real variants disagree about structure.
- **Sharing too much code between variants.** A shared `<Header>` is fine; a shared `<Layout>` defeats the point. Each variant should be free to throw out the layout.
- **Wiring variants to real mutations.** Read-only prototypes are fine. If a variant needs to mutate, point it at a stub — the question is "what should this look like", not "does the backend work".
- **Promoting the prototype directly to production.** The variant code was written under prototype constraints (no tests, minimal error handling). Rewrite it properly when you fold it in.

## Precise Vocabulary

| Term | Meaning |
|------|---------|
| LOGIC branch | Terminal TUI prototype exploring a state model or business logic |
| UI branch | Visual prototype exploring structural UI layout variations |
| LIFTED | Logic module extracted from prototype into production code without the TUI shell |
| Variant | One of 3–5 structurally different UI implementations in a UI prototype |
| Throwaway code | Code written to answer exactly one question, then discarded |
| Sub-shape A | Prototype variants hosted on an existing route with real data fetching |
| Sub-shape B | Prototype variants hosted on a dedicated throwaway route |
| Switcher | Floating bottom-centre bar for cycling between UI variants |

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
- Prototype is clearly marked as throwaway and deletable with no side effects
- Winning design direction is captured somewhere durable (commit message, ADR, NOTES.md)

## When NOT to Use

- When tests are needed (prototypes explore, they don't verify)
- When real persistence or a database is required
- When generalisation is the goal (solve exactly ONE question, not all of them)
- When prototype code should be promoted directly to production — rewrite with proper architecture first
- When the question is already answered — don't prototype for curiosity's sake
