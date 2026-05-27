---
id: brainstorming
name: brainstorming
description: 'Use before any creative work — exploring features, building components, adding functionality, or modifying behavior. Explores user intent, requirements, and design space before committing to an implementation path.'
phase: "THINK"
use_when: "Ambiguous creative direction, no clear implementation path, need to explore design space before committing, before any feature work that isn't purely mechanical"
version: 1.0.0
---

# brainstorming

**Tradeoff:** Thorough exploration costs time upfront but prevents expensive wrong-direction rework.

## Core Concept

Collaborative exploration that turns fuzzy ideas into concrete designs through forcing questions and iterative proposal cycles. Brainstorming **generates** a creative/design space — it does not resolve ambiguity in existing descriptions (that is the clarifier's job).

**Brainstorming** = explore creative/design space when no clear path exists. Propose approaches, generate alternatives, reframe problems. Output: a design ready for planning.

**Clarifier** = resolve ambiguity in given descriptions. Output: a clarified task description.

Brainstorming asks "what should we build?" Clarifier asks "what exactly did you mean?"

Hard gate: no implementation begins until user has approved the written design.

## Precise Vocabulary

| Term | Definition |
|------|------------|
| Forcing Question | A question to reframe assumptions and reveal hidden constraints before solution generation |
| Design Space | The set of possible approaches, architectures, and trade-offs for a given problem |
| Premise | An assumption underpinning the current approach that must be validated |
| Narrowest Wedge | The smallest version of the idea that delivers real value |
| Wedge First | Ship the narrowest useful version; expand from strength |

## Context Requirements

- Read/grep/glob access to project files for context gathering → verify: patterns and constraints identified
- Write access to `.agnes/specs/` for design documents → verify: file written non-empty
- Task routing to planner skill for implementation handoff

## Workflow

### 1. Explore Context

Ground yourself before proposing anything:
- Check project files, docs, recent commits → verify: existing patterns and prior art documented
- Identify related components, utilities, or prior art → verify: constraints from current architecture noted

**Output:** Context inventory — what exists, what patterns apply, what constraints bind the design.

### 2. Run Forcing Questions

Assess scope first. If request spans multiple independent subsystems, flag for decomposition — don't refine a project that needs breaking up first.

Ask forcing questions **one at a time** from the set below. Smart-skip any question whose answer is already clear from context. → verify: each answered question has specific, concrete evidence, no hypotheticals accepted.

**Q1 — Problem Reality:** "What's the strongest evidence this is a real problem someone has — not hypothetical?" Push until: specific behavior, active workaround, time/money currently spent.

**Q2 — Status Quo:** "What are people doing right now to solve this? What does that workaround cost them?" Push until: specific workflow, hours wasted, tools duct-taped together, real cost of status quo.

**Q3 — Target Clarity:** "Who needs this most? What's their context, constraints, day-to-day?" Push until: a specific human with real consequences, not a category.

**Q4 — Narrowest Wedge:** "What's the smallest version that would deliver real value? What could ship this week?" Push until: one feature, one workflow, scoped in days not months.

**Q5 — Surprise:** "What existing solutions have you watched people use? What surprised you about their actual behavior?" Push until: specific contradiction between expectation and reality.

**Q6 — Future-Fit:** "If the world changes in 3 years, does this become more valuable or less?" Push until: specific thesis about landscape shift, not "AI keeps getting better."

**Output:** Answered forcing questions with specific evidence — all vague/hypothetical responses flagged.

### 3. Challenge Premises

Before proposing solutions, crystallize assumptions. For each premise, state it clearly and get user confirmation:
- Is this the right problem to solve? → verify: premise stated and user confirmed
- What happens if we do nothing?
- What existing code partially solves this?

**Output:** Validated premise list — confirmed assumptions the design rests on.

### 4. Propose 2-3 Approaches

Each approach includes Summary, Effort (hours/days), Risk (Low/Med/High), Pros (2-3), Cons (2-3).

One approach must be **minimal viable** (fewest files, smallest diff). Another must be **ideal architecture** (best long-term trajectory). Third can be **creative/lateral** path. → verify: approaches span viable/ideal/creative — no coverage gaps.

Recommend one approach with rationale. Let user choose. → verify: user has selected an approach.

**Output:** 2-3 structured proposals with recommendation.

### 5. Present Design

Once approach chosen, present design in sections scaled to complexity:
- Architecture, components, data flow → verify: each section gets user approval before next
- Key interfaces and boundaries
- Error handling and edge cases
- Testing strategy

**Output:** Section-by-section approved design.

### 6. Write Design Document

Save approved design: `.agnes/specs/YYYY-MM-DD-<topic>-design.md` or project's established spec location. → verify: file exists, non-empty, follows project conventions

Design doc is the handoff artifact — feeds into planner for implementation planning.

**Output:** Written design document.

### 7. Spec Self-Review

1. **Placeholder scan:** No "TBD", "TODO", incomplete sections, vague requirements → verify: zero placeholders
2. **Internal consistency:** No contradictions between sections → verify: cross-reference all claims
3. **Scope check:** Fits a single implementation plan → verify: fits one planner cycle
4. **Ambiguity check:** All decisions explicit — no "figure out later" clauses → verify: every open question resolved

**Output:** Self-reviewed spec passing all four checks.

### 8. User Reviews Spec

Present spec for approval. Changes requested → revise and re-run self-review. → verify: user has explicitly approved the written spec

**Output:** User-approved design.

### 9. Handoff to Planner

Route approved design to planner for implementation planning. Do NOT skip to implementation.

**Output:** Design routed to planner subagent.

## Flow Diagram

```
[ambiguous request] → [explore context] → [run forcing questions] → [challenge premises]
                                                                          │
                                                                          ▼
[handoff to planner] ← [user approves] ← [self-review] ← [write design] ← [propose approaches]
                           ▲                                      │
                           └────── [changes requested] ←──────────┘
```

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| read / grep / glob | Explore Context | Project files, docs, commits | Context inventory |
| write | Write Design Document | Approved design decisions | `.agnes/specs/<date>-<topic>-design.md` |
| task (subagent) | Handoff to Planner | Approved design doc | Planner task routed |

## Examples

| Scenario | Approach | Key Forcing Question |
|----------|----------|---------------------|
| New feature | Minimal wedge → ideal architecture | Q4: Narrowest Wedge |
| Redesign component | Challenge premises → compare approaches | Q2: Status Quo, Q5: Surprise |
| Architecture decision | Propose 3 with trade-off matrix | Q1: Problem Reality, Q3: Target Clarity |
| Exploratory project | Full Q1-Q6 cycle → design doc | Q6: Future-Fit |

## Output

- Written design document at `.agnes/specs/YYYY-MM-DD-<topic>-design.md`
- User-approved design with clear approach selection
- Handoff to planner for implementation planning

## Quality Criteria

- **[Hard Gate]** → verify: No implementation until design is approved. Passes only when: design passes self-review, user explicitly approved written spec, all premises validated.
- **[Scope Check]** → verify: Each spec fits a single implementation plan. If not, decompose into sub-projects first.
- **[Forcing Question Depth]** → verify: Every Q1-Q6 answered with specificity — no vague or hypothetical responses accepted without flagging.
- **[Approach Diversity]** → verify: Minimum 2 approaches, ideally 3, covering minimal viable + ideal architecture + creative/lateral.

## Protocol Shells

All brainstorming follows the protocol shell format:

```
/protocol {
  intent="Explore design space and generate ideas before committing",
  input={ prompt="<creative-brief>", domain="<subject-area>" },
  process=[ /decompose{dimensions}, /abstract{patterns}, /compare{variations} ],
  output={ result="<explored-options>", recommendation="<direction>" }
}
```

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break creative brief into independent exploration axes |
| /abstract | Extract patterns from reference examples |
| /compare | Evaluate creative directions against criteria |

## When NOT to Use

- Task already precisely specified with no creative or design decisions (use direct implementation)
- Task is purely operational ("run this command", "fix this typo")
- Only ambiguity is terminology or scope — that's clarifier's job
- During BUILD or SHIP phase — this skill is for THINK phase only
- User has already decided on approach and just needs execution
