---
id: brainstorming
name: brainstorming
description: 'Use before any creative work — exploring features, building components, adding functionality, or modifying behavior. Explores user intent, requirements, and design space before committing to an implementation path.'
phase: "THINK"
use_when: "Ambiguous creative direction, no clear implementation path, need to explore design space before committing, before any feature work that isn't purely mechanical"
version: 1.0.0
---

## Use When

Ambiguous creative direction, no clear implementation path, need to explore design space before committing, before any feature work that isn't purely mechanical.

## Core Concept

Collaborative exploration that turns fuzzy ideas into concrete designs through structured forcing questions and iterative proposal cycles. Brainstorming **generates** a creative/design space — it does not resolve ambiguity in an existing description (that is the clarifier's job).

**Brainstorming** = explore creative/design space when no clear path exists. Propose approaches, generate alternatives, reframe the problem. The output is a design ready for planning.

**Clarifier** = resolve existing ambiguity in a given description. Socratic questioning, terminology sharpening, glossary-first challenges. The output is a clarified task description.

Brainstorming asks "what should we build?" Clarifier asks "what exactly did you mean?"

A **hard gate** enforces that no implementation begins until the user has approved the written design.

## Precise Vocabulary

| Term | Definition |
|------|------------|
| Forcing Question | A question designed to reframe assumptions and reveal hidden constraints before solution generation begins |
| Design Space | The set of possible approaches, architectures, and trade-offs for a given problem |
| Premise | An assumption underpinning the current approach that must be validated |
| Narrowest Wedge | The smallest version of the idea that delivers real value — the minimal viable expression |
| Wedge First | Ship the narrowest useful version; expand from strength rather than pre-building infrastructure |

## Forcing Questions

Ask these **one at a time**. Push until the answer is specific, concrete, and grounded in evidence rather than hypothesis. Comfort means you haven't pushed deep enough.

### Q1: Problem Reality

**Ask:** "What's the strongest evidence that this is actually a problem someone has — not hypothetical, but a real pain someone experiences today?"

**Push until you hear:** Specific behavior. Someone actively working around it. Time or money currently being spent because of it.

### Q2: Status Quo

**Ask:** "What are people doing right now to solve this — even badly? What does that workaround cost them?"

**Push until you hear:** A specific workflow. Hours wasted. Tools duct-taped together. A real cost to maintaining the status quo.

### Q3: Target Clarity

**Ask:** "Who needs this most? What's their context, their constraints, their day-to-day? What gets them promoted or fired?"

**Push until you hear:** A specific human, not a category. A role with real consequences tied to the problem.

### Q4: Narrowest Wedge

**Ask:** "What's the smallest version of this that would deliver real value? What could ship this week?"

**Push until you hear:** One feature. One workflow. Something scoped in days, not months.

### Q5: Surprise

**Ask:** "What existing solutions have you watched people use? What surprised you about how they actually behave?"

**Push until you hear:** A specific contradiction between expectation and reality. Something the data didn't predict.

### Q6: Future-Fit

**Ask:** "If the world changes in 3 years — and it will — does this become more valuable or less?"

**Push until you hear:** A specific thesis about how the landscape shifts and why this idea rides that wave, not just "AI keeps getting better."

## Workflow

### 1. Explore Context

Before proposing anything, ground yourself:
- Check project files, docs, recent commits
- Understand existing patterns and conventions
- Identify related components, utilities, or prior art

### 2. Run Forcing Questions

Assess scope first: if the request spans multiple independent subsystems, flag this immediately. Don't refine details of a project that needs decomposition first.

For appropriately-scoped projects, ask forcing questions **one at a time**. Use the Q1-Q6 set above. Smart-skip any question whose answer is already clear from context.

### 3. Challenge Premises

Before proposing solutions, crystallize the assumptions:
- Is this the right problem to solve?
- What happens if we do nothing?
- What existing code partially solves this?
- For each premise, state it clearly and get user confirmation

### 4. Propose 2-3 Approaches

For each approach include:
- **Summary**: One sentence describing the approach
- **Effort**: Rough sizing (hours/days)
- **Risk**: Low / Med / High
- **Pros**: 2-3 specific advantages
- **Cons**: 2-3 specific trade-offs

One approach must be the **minimal viable** (fewest files, smallest diff). Another must be the **ideal architecture** (best long-term trajectory). The third can be a **creative/lateral** path.

Recommend one approach with clear rationale. Let the user choose.

### 5. Present Design

Once the approach is chosen, present the design in sections scaled to their complexity:
- Architecture, components, data flow
- Key interfaces and boundaries
- Error handling and edge cases
- Testing strategy

Ask after each section whether it matches expectations. Go back and revise if needed.

### 6. Write Design Document

Save the approved design to a durable location:
- Write to `.agnes/specs/YYYY-MM-DD-<topic>-design.md` or the project's established spec location
- The design doc is the handoff artifact — it feeds into planner for implementation planning

### 7. Spec Self-Review

Before declaring complete:
1. **Placeholder scan**: No "TBD", "TODO", incomplete sections, or vague requirements
2. **Internal consistency**: No contradictions between sections
3. **Scope check**: Focused enough for a single implementation plan
4. **Ambiguity check**: All decisions explicit — no "figure out later" clauses

### 8. User Reviews Spec

Present the spec to the user for approval. If changes requested, revise and re-run self-review. Only proceed once approved.

### 9. Handoff to Planner

Once the design is approved, route to planner for implementation planning. Do NOT skip straight to implementation.

## Key Principles

- **One question at a time.** Never overwhelm with multiple questions in one message.
- **Force specificity.** Vague answers get pushed — "users" is not an answer, "Sarah at Acme Corp" is.
- **Propose, don't prescribe.** Always present 2-3 approaches with trade-offs before settling.
- **Incremental validation.** Get approval on each design section before moving to the next.
- **Wedge first.** The smallest version that delivers real value is more important than the full vision.
- **YAGNI ruthlessly.** Cut unnecessary features from all designs. Everything not explicitly needed is scope creep.
- **Design for isolation.** Each unit should have one clear purpose, well-defined interfaces, and be independently testable.

## Tool Requirements

- **read / grep / glob** — explore project context, existing patterns, prior art
- **write** — save design documents to project specs directory
- **task** — route approved design to planner for implementation planning

## Output

- Written design document at `.agnes/specs/YYYY-MM-DD-<topic>-design.md`
- User-approved design with clear approach selection
- Handoff to planner skill for implementation planning

## Quality Criteria

- **Hard Gate**: No implementation until design is approved. The gate passes only when: design passes self-review checklist, user has explicitly approved the written spec, all premises are validated.
- **Scope check**: Each spec must fit a single implementation plan. If it doesn't, decompose into sub-projects first.
- **Forcing question depth**: Every Q1-Q6 answered with specificity — no vague or hypothetical responses accepted without flagging.
- **Approach diversity**: Minimum 2 approaches, ideally 3, covering minimal viable + ideal architecture + creative/lateral.

## When NOT to Use

- When the task is already precisely specified with no creative or design decisions needed (use direct implementation instead)
- When the task is purely operational ("run this command", "fix this typo")
- When the only ambiguity is terminology or scope — that's clarifier's job
- During BUILD or SHIP phase — this skill is for THINK phase only
- When the user has already decided on approach and just needs execution
