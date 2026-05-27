---
name: multi-reviewer
description: Use when a plan, design, diff, architecture, workflow, PRD, or product change needs a hard multi-axis review gate across Goal Alignment, CEO, Engineering, Design, and DX before implementation or shipping.
id: multi-reviewer
phase: PLAN REVIEW
use_when: Multi-axis senior review of plans/specs before implementation; replaces legacy plan-reviewer for new workflows.
version: 0.15.0
---

# Multi-Reviewer

**Tradeoff:** Rigorous gating slows early velocity. Prevents costly misalignment.

Five lenses — Goal Alignment, CEO, Engineering, Design, DX. Score with evidence. Fail closed when evidence missing. No praise-pad.

## Use When

Artifact needs approval before build. Orchestrator needs judgment gate. User asks for grill/review/quality gate.

## Core Concept

Goal Alignment is primary — if artifact doesn't serve objective, nothing else matters. Cross-axis synthesis catches interaction effects single-axis reviews miss.

**AUTO Mode:** full review + verdict. Missing evidence = risk + downgrade.
**INTERACTIVE Mode:** one axis at a time, one question, incorporate, continue.

## Precise Vocabulary

- **Finding**: severity + evidence + impact + required change.
- **Axis**: evaluation dimension.
- **Verdict**: parseable — APPROVE | REVISE | REJECT.
- **Evidence**: citation, test output, requirement, diagram, explicit absence.
- **Severity**: P0 (blocking) → P3 (low).

## Context Requirements

- **Artifact**: plan/PRD/design/diff/architecture/workflow/proposal.
- **Objective**: verbatim stated goal. Missing → P0.
- **Context**: audience, constraints, non-goals, release target, risk tolerance, domain docs.
- Missing artifact → REJECT. Unavailable evidence → cite absence + downgrade.

## Workflow

### Phase 1: Setup

1. Identify artifact type, objective, audience, phase, decision requested.
2. Extract verbatim objective. → verify: objective quoted.
3. Extract requirements, constraints, assumptions, non-goals, success metrics.
4. Decide applicable axes (Goal Alignment always applies).

### Phase 2: Goal Alignment (PRIMARY AXIS)

Gates all others.

1. Quote objective. Verify every element serves it.
2. Score 1-10. → verify: ≤5 = REJECT immediately.
3. Score 6-7: at best REVISE. Score ≥8: proceed.
4. Check goal drift, scope reinterpretation, irrelevant work.

### Phase 3: Axis Review

Evaluate each independently.

#### CEO: Business Value, Scope, Strategy

Value in one customer-facing sentence? Narrowest wedge? Non-goals explicit? Metric + decision threshold? Fastest learning loop? Worst plausible outcome?

- **9-10**: clear value, narrow wedge, explicit non-goals, concrete learning loop, board-ready risk.
- **5-6**: plausible but fuzzy; loose scope; weak measurement.
- **1-2**: no credible user need or strategic fit.
→ verify: metric and decision threshold specified.

#### Engineering: Architecture, Data Flow, Quality

State model + legal transitions? Blast radius per component? Shadow paths (nil/empty/malformed/stale/slow/duplicate/concurrent/unauthorized/offline)? Auth/permissions/injection/tenant isolation? Retries bounded + idempotent? Metrics, alerts, dashboards, runbooks, rollback? Tests cover risk?

- **9-10**: errors named, shadow paths covered, observable, reversible, secure, tested by risk.
- **5-6**: notable gaps; unhandled paths; incomplete observability; P0/P1 likely.
- **1-2**: fundamental data loss, security, state, or correctness failure.
→ verify: shadow paths covered.

#### Design: UI/UX, Interaction, Visual System

Skip only if no user-facing surface. Full journey, not isolated screens. All states (loading/empty/error/success/disabled)? Feedback per action? Recovery? Destructive actions confirmed? Tap targets ≥44px? Keyboard/screen reader/focus/zoom/contrast? Matches design system?

- **9-10**: all states designed, feedback clear, accessible, hierarchy crisp.
- **5-6**: multiple missing states, inconsistent feedback, unclear hierarchy.
- **1-2**: broken UX — no hierarchy, no state handling, no recovery.
→ verify: all interaction states designed.

#### DX: Developer Experience

TTHW? Install+run from clean? Happy path = small idiomatic snippet? Errors say what/why/fix? Docs searchable, runnable — quickstart/tutorial/reference/troubleshooting? Migration guide? Full journey: discover→evaluate→install→integrate→debug→upgrade→scale?

- **9-10**: TTHW <2m, actionable errors, complete docs, automated migration.
- **5-6**: TTHW 5-10m, notable friction, opaque errors, docs gaps.
- **1-2**: TTHW >15m or cannot start without workarounds.
→ verify: TTHW measured.

### Phase 4: Synthesis

1. Name pattern-level gaps. → verify: each tension has concrete impact.
2. Identify risk concentration. → verify: top required changes prioritized.
3. Tensions: CEO value vs uncontrolled Eng risk. Design promise Eng can't deliver. DX defaults unsafe. Eng complexity exceeds business learning.

### Phase 5: Verdict

1. GA ≤5 → REJECT. GA 6-7 → at best REVISE.
2. APPROVE: every axis ≥8 AND no P0/P1/material P2.
3. REVISE: any axis 5-7 or P1/P2 findings.
4. REJECT: any axis <5 or any P0. Also: wrong premise, impossible to review, missing artifacts.
5. N/A axes don't affect thresholds. Unjustified N/A → at least REVISE.
6. Weakest axis + highest-severity finding control verdict.

## Examples

| Sev | Axis | Finding |
|-----|------|---------|
| P0 | Eng | Migration can corrupt data — no backup, idempotency, dry run, or rollback |
| P0 | Eng | Auth boundary undefined — no permission model or tenant isolation |
| P1 | Design | Empty state blocks activation — no first-project path for new users |
| P1 | CEO | No success metric or decision threshold specified |
| P2 | DX | No migration guide or deprecation policy for existing users |

## Quality Criteria

### Evidence

**Strong**: direct citation, test output, explicit requirement, diagram, API contract, migration plan, screenshot.
**Weak**: implied intent, "we will" without owner, unsourced metric, TODO, assumption as fact.
**Absence is valid**: "No rollback plan specified." Conflicting evidence → score against safer interpretation.

### Severity

- **P0**: production breakage, data corruption, security exploit, impossible review, wrong approach.
- **P1**: serious user/business/operational/security/accessibility/DX harm. Fix before proceeding.
- **P2**: meaningful contained risk. Fix this iteration or next.
- **P3**: valid improvement. Defer if tracked.

### Finding Format

`N. [P#] Title — Evidence: <citation or absence>. Impact: <concrete failure>. Required change: <smallest fix>.`

### Universal Rules

- Evidence first. → verify: no score without evidence.
- No inventing unstated details.
- GA gates all. → verify: ≤5 = REJECT.
- Weakest axis + highest-severity finding control verdict.
- Shadow paths = nil/empty/malformed/stale/slow/duplicate/concurrent/unauthorized/offline/rollback.
- Observability = metrics, alerts, dashboards, runbooks, owners.
- Deferred work: owner + trigger + tracking required.
- Prefer scrapping flawed approach over polishing.

### Anti-Patterns

- No praise sandwich. No score on effort or ambition.
- No APPROVE with P0. No skipping Design or DX.
- No future work without owner/trigger/tracking.
- No second verdict line. No prose after final verdict.

### Fail-Closed

- Missing artifact → REJECT.
- Missing/ambiguous objective → at least REVISE (REJECT if absent).
- Malformed/unreviewable → REJECT. Narrow missing detail → REVISE.
- Skipped applicable axis → at least REVISE.
- Missing evidence for material claim → at least REVISE.
- Any P0 → never APPROVE. Multiple P0s → usually REJECT.

## Output Format

One structured block. Ends with exactly one verdict line. No prose after.

```markdown
## Multi-Reviewer Results
### Goal Alignment Score: N/10 | N/A
Stated objective: <verbatim quote>
Evidence: ...
Findings: 1. [P#] Title — Evidence: ... Impact: ... Required change: ...
### CEO Score: N/10 | N/A
### Engineering Score: N/10 | N/A
### Design Score: N/10 | N/A
### DX Score: N/10 | N/A
## Cross-Axis Synthesis
**Pattern-Level Gaps**: ...
**Tension Points**: ...
**Risk Concentration**: ...
**Top Required Changes**: 1. ... 2. ... 3. ...
**Overall Verdict**: APPROVE|REVISE|REJECT
```

## Protocol Shell

/protocol{ intent="Review across multiple axes", input={ document, axes }, process=[ /decompose, /verify, /synthesize ], output={ result, blockers, recommendations } }

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break review into independent axes |
| /verify | Check each axis with evidence |
| /synthesize | Combine scores into go/no-go |

## Skip When

Simple Q&A or tiny changes. User says no review needed. Discovery-only with no artifact.
