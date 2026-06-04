---
id: brainstorming
name: brainstorming
description: 'Use before any creative work — exploring features, building components, adding functionality, or modifying behavior. Explores user intent, requirements, and design space before committing to an implementation path.'
phase: "THINK"
use_when: "Ambiguous creative direction, no clear implementation path, need to explore design space before committing, before any feature work that isn't purely mechanical"
version: 1.0.0
---

## Use When

Ambiguous creative direction, no clear path, need to explore design space before committing, before non-mechanical feature work.

## Core Concept

Collaborative exploration turning fuzzy ideas into concrete designs via forcing questions and iterative proposals. Brainstorming **generates** creative/design space — does not resolve existing ambiguity (clarifier's job).

**Brainstorming** = explore creative space when no clear path exists. Propose approaches, generate alternatives, reframe. Output: design ready for planning.

**Clarifier** = resolve existing ambiguity. Socratic questioning, terminology sharpening, glossary-first. Output: clarified task description.

Brainstorming asks "what should we build?" Clarifier asks "what exactly did you mean?"

**Hard gate**: no implementation until user approves written design.

## Precise Vocabulary

| Term | Definition |
|------|-----------|
| Forcing Question | Question reframing assumptions, revealing hidden constraints before solution generation |
| Design Space | Set of possible approaches, architectures, trade-offs for given problem |
| Premise | Assumption underpinning current approach that must be validated |
| Narrowest Wedge | Smallest version delivering real value — minimal viable expression |
| Wedge First | Ship narrowest useful version; expand from strength |

## Forcing Questions

Ask **one at a time**. Push until answer is specific, concrete, evidence-grounded. Comfort means not deep enough.

### Q1: Problem Reality

**Ask:** "What's the strongest evidence this is a real problem someone has?"

**Push until:** Specific behavior. Someone actively working around it. Time/money spent.

### Q2: Status Quo

**Ask:** "What are people doing now to solve this? What does that workaround cost?"

**Push until:** Specific workflow. Hours wasted. Tools duct-taped. Real cost.

### Q3: Target Clarity

**Ask:** "Who needs this most? Their context, constraints, day-to-day? What gets them promoted or fired?"

**Push until:** Specific human, not category. Role with real consequences.

### Q4: Narrowest Wedge

**Ask:** "Smallest version delivering real value? What could ship this week?"

**Push until:** One feature. One workflow. Scoped in days, not months.

### Q5: Surprise

**Ask:** "What existing solutions have you watched people use? What surprised you about their behavior?"

**Push until:** Contradiction between expectation and reality. Data didn't predict.

### Q6: Future-Fit

**Ask:** "If world changes in 3 years, does this become more or less valuable?"

**Push until:** Specific thesis about landscape shift, not "AI keeps getting better."

## Workflow

### 1. Explore Context

Before proposing, ground yourself:
- Check project files, docs, recent commits
- Understand existing patterns
- Identify related components or prior art

### 2. Run Forcing Questions

Assess scope first. Request spans multiple subsystems? Flag immediately. Don't refine what needs decomposition.

For scoped projects, ask Q1-Q6 one at a time. Smart-skip questions clear from context.

### 3. Challenge Premises

Crystallize assumptions before solutions:
- Is this the right problem?
- What if we do nothing?
- What existing code partially solves this?
- State each premise, get confirmation

### 4. Propose 2-3 Approaches

Each includes:
- **Summary**: One sentence
- **Effort**: Rough hours/days
- **Risk**: Low / Med / High
- **Pros**: 2-3 advantages
- **Cons**: 2-3 trade-offs

One approach must be **minimal viable** (fewest files, smallest diff). Another **ideal architecture** (best long-term). Third can be **creative/lateral**.

Recommend one with rationale. Let user choose.

### 5. Present Design

Once approach chosen, present sections scaled to complexity:
- Architecture, components, data flow
- Key interfaces and boundaries
- Error handling and edge cases
- Testing strategy

Ask after each section if it matches expectations. Revise if needed.

### 6. Write Design Document

Save to `.agnes/specs/YYYY-MM-DD-<topic>-design.md` or project's spec location. Feeds planner.

### 7. Spec Self-Review

Before declaring complete:
1. **Placeholder scan**: No "TBD", "TODO", incomplete sections
2. **Internal consistency**: No contradictions
3. **Scope check**: Focused for single implementation plan
4. **Ambiguity check**: All decisions explicit — no "figure out later"

### 8. User Reviews Spec

Present for approval. If changes requested, revise and re-run self-review.

### 9. Handoff to Planner

Once approved, route to planner. No skip to implementation.

## Key Principles

- **One question at a time.** Never overwhelm.
- **Force specificity.** "Users" not answer; "Sarah at Acme Corp" is.
- **Propose, don't prescribe.** 2-3 approaches with trade-offs.
- **Incremental validation.** Approve each section before next.
- **Wedge first.** Smallest valuable version over full vision.
- **YAGNI ruthlessly.** Everything not needed is scope creep.
- **Design for isolation.** One purpose, defined interfaces, testable.

## Tool Requirements

- **read / grep / glob** — explore context, patterns, prior art
- **write** — save design documents
- **task** — route approved design to planner

## Output

- Design doc at `.agnes/specs/YYYY-MM-DD-<topic>-design.md`
- User-approved design with clear approach
- Handoff to planner

## Quality Criteria

- **Hard Gate**: No implementation until design approved. Gate passes: self-review passes, user approved written spec, all premises validated.
- **Scope check**: Each spec fits single implementation plan. Decompose if not.
- **Forcing question depth**: Q1-Q6 answered with specificity.
- **Approach diversity**: Min 2 (ideally 3): minimal + ideal + creative.

## When NOT to Use

- Task already precisely specified with no creative decisions
- Purely operational ("run this", "fix typo")
- Only ambiguity is terminology — clarifier's job
- BUILD or SHIP phase — THINK only
- User already decided approach, needs execution
