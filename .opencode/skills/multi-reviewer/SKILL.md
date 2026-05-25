---
name: multi-reviewer
description: Use when a plan, design, diff, architecture, workflow, PRD, or product change needs a hard multi-axis review gate across CEO, Engineering, Design, and DX before implementation or shipping.
id: multi-reviewer
phase: PLAN REVIEW
use_when: Multi-axis senior review of plans/specs before implementation; replaces legacy plan-reviewer for new workflows.
version: 0.14.0
---

# Multi-Reviewer

A senior quality gate, not a cheerleader. Review the artifact through four lenses: CEO, Engineering, Design, and DX. Score with evidence, convert risks into required changes, synthesize cross-axis patterns, and end with one machine-parseable verdict.

Fail closed when evidence is missing. Do not praise-pad. Do not give vague advice.

## Use When

Use this skill when:

- User asks for plan review, design review, code review, architecture review, multi-review, full review, or quality gate.
- User says: "grill me", "challenge me", "question me", "walk me through", or "present me".
- A plan, PRD, diff, design, implementation proposal, workflow, or product/technical change needs approval before work continues.
- An orchestrator needs a judgment gate before builder, tester, shipper, or user approval.

Do not use for:

- Simple Q&A.
- Tiny changes where a direct answer is enough.
- Pure implementation requests where the user explicitly says no review is needed.
- Discovery-only conversations where no artifact exists yet.

## Modes

### AUTO Mode

Default mode.

- Review all applicable axes autonomously.
- Do not ask clarifying questions unless the artifact is impossible to review.
- If evidence is missing, treat the absence as risk and downgrade.
- Produce the full structured review and final verdict.

### INTERACTIVE Mode

Use when the user asks to be grilled, challenged, questioned, walked through, or reviewed interactively.

- Run one axis at a time.
- Present the axis assessment.
- Ask exactly one unresolved question.
- Wait for the answer.
- Incorporate the answer, then continue.
- Never ask multiple questions in one turn.

## Inputs

Expected inputs:

- Artifact: plan, PRD, design, diff, architecture, implementation notes, workflow, or proposal.
- Context: objective, audience, constraints, non-goals, release target, risk tolerance, domain docs, existing patterns.
- If the artifact is absent, return `REJECT` with a P0 finding.
- If an axis is not applicable, mark it `N/A` and explain why in one sentence.
- If referenced evidence is unavailable, cite the absence and downgrade.

## Operating Workflow

1. Identify artifact type, objective, audience, phase, and decision requested.
2. Extract stated requirements, constraints, assumptions, non-goals, and success metrics.
3. Decide which axes apply.
4. Review each applicable axis independently.
5. Convert concerns into findings with severity, evidence, impact, and required change.
6. Score each axis from evidence only. Do not score intent, effort, or confidence.
7. Identify cross-axis gaps, tensions, and risk concentration.
8. Apply verdict mechanics exactly.
9. End with exactly one final verdict line.

## Universal Rules

- Evidence first. Every score and finding cites a section, quote, file:line, observed behavior, test output, screenshot description, explicit requirement, or explicit absence.
- Missing material evidence counts as risk.
- Do not invent unstated details.
- Do not let a strong axis hide a weak axis.
- Every finding must state concrete impact.
- Every finding must include the smallest required change needed to pass.
- Name failure modes. Do not write "handle errors"; name the timeout, race, permission gap, stale state, malformed input, or user-visible failure.
- Shadow paths count as scope: nil, empty, malformed, stale, slow, duplicate, concurrent, unauthorized, offline, rollback.
- Observability is scope for operational work: metrics, alerts, dashboards, runbooks, owners.
- Deferred work must have owner, trigger, and tracking.
- Prefer scrapping a flawed approach over polishing it.
- Output must be parseable.

## Evidence Standards

Strong evidence:

- Direct citation.
- Runnable test output.
- Explicit requirement.
- Architecture diagram.
- API contract.
- Migration plan.
- Concrete screenshot or UI state description.
- Existing production behavior.

Weak evidence:

- Implied intent.
- "We will" without owner or mechanism.
- Unsourced metric.
- Generic TODO.
- Unowned follow-up.
- Assumption presented as fact.

Rules:

- Absence evidence is valid: "No rollback plan is specified."
- If evidence conflicts, cite both and score against the safer interpretation.
- If evidence is stale, incompatible, or out of scope, treat it as missing.

## Severity Calibration

Use the highest severity supported by impact.

- `P0 Blocking`: likely production breakage, data corruption, exploitable security issue, invalid artifact, impossible review, unrecoverable rollout, or fundamentally wrong approach.
- `P1 High`: serious user, business, operational, security, accessibility, or developer harm. Should fix before proceeding.
- `P2 Medium`: meaningful contained risk. Fix this iteration or next.
- `P3 Low`: valid improvement. Can defer if tracked.

Do not report:

- Style-only preferences.
- Duplicated root causes.
- Speculation without a plausible failure path.
- Generic advice.

## Axes

### CEO: Business Value, Scope, Strategy

Review for customer value, target user, scope discipline, timing, risk, opportunity cost, and learning loop.

Ask:

- Can the value be explained in one customer-facing sentence?
- Is the user segment and pain specific?
- Is this the narrowest wedge that creates real value?
- Are non-goals explicit and useful?
- What is the expected value and opportunity cost?
- What signal proves this worked or failed?
- What is the fastest learning loop after launch?
- What is the worst plausible outcome?
- Is this wartime speed or peacetime quality?
- Does the investment match current priorities?

Failure modes:

- Solution in search of a problem.
- Scope inflated beyond the learning needed.
- No metric, baseline, or decision threshold.
- Non-goals missing or decorative.
- User segment too vague to reject alternate solutions.

Score:

- `9-10`: clear value, narrow wedge, explicit non-goals, proportionate scope, concrete learning loop, board-ready risk handling.
- `7-8`: solid value and scope; minor metric, risk, or non-goal gaps.
- `5-6`: plausible but fuzzy value; loose scope; weak measurement or risk handling.
- `3-4`: unclear value; no learning loop; poor scope/investment fit.
- `1-2`: no credible user need or strategic fit.
- `0`: not applicable.

### Engineering: Architecture, Data Flow, Quality

Review for correctness, state, data flow, security, failure handling, operability, reversibility, and testing.

Ask:

- What state exists, where is it stored, and what transitions are legal?
- What data crosses trust boundaries, tenants, processes, queues, caches, or retries?
- What is the blast radius when each component fails?
- Is the design boring, incremental, reversible, and proportionate?
- Are errors named and typed?
- Are nil, empty, malformed, stale, slow, duplicate, concurrent, unauthorized, and offline paths handled?
- Are auth, permissions, injection, data leakage, abuse, and tenant isolation designed early?
- Are retries bounded with backoff, jitter, and idempotency?
- Are metrics, alerts, dashboards, runbooks, owners, and rollback included?
- Do tests cover risk, not just happy paths?

Failure modes:

- Silent failure or swallowed error.
- Shared mutable state without legal transitions.
- Non-idempotent retry or duplicate event.
- Race on shared state.
- Migration without backup, checkpointing, validation, dry run, or rollback.
- Security boundary assumed instead of enforced.

Score:

- `9-10`: critical errors named, shadow paths covered, blast radius contained, observable, reversible, secure, tested by risk.
- `7-8`: solid design with minor edge-case or observability gaps; no P0.
- `5-6`: notable gaps; unhandled paths; incomplete observability; P0/P1 likely.
- `3-4`: major architecture flaws, missing critical paths, multiple P0 risks.
- `1-2`: fundamental data loss, security, state, or correctness failure.
- `0`: not applicable.

### Design: UI/UX, Interaction, Visual System

Skip only when there is no user-facing surface. Review the full journey, not isolated screens.

Ask:

- Can the hierarchy be understood in 3 seconds?
- Is the primary task obvious?
- Are loading, empty, error, success, disabled, and partial states designed?
- Does every action provide feedback?
- Is recovery available?
- Are destructive actions confirmed or reversible?
- Are tap targets at least 44px?
- Are keyboard, screen reader, focus, zoom, high contrast, and reduced motion addressed?
- Is contrast acceptable: 4.5:1 body text, 3:1 large text or non-text UI?
- Does it match the design system, or justify a new pattern?
- What can be removed without hurting the primary task?

Failure modes:

- Only happy screen exists.
- Empty or error state dead-ends the user.
- Visual hierarchy competes with the primary action.
- Accessibility treated as polish.
- New pattern duplicates existing system behavior.
- Destructive action lacks confirmation or undo.

Score:

- `9-10`: all states designed, feedback clear, accessible, hierarchy crisp, system-consistent, choices defensible.
- `7-8`: solid with minor missing states, accessibility, or consistency gaps.
- `5-6`: multiple missing states, inconsistent feedback, unclear hierarchy, accessibility gaps.
- `3-4`: states, feedback, accessibility, or consistency mostly absent.
- `1-2`: broken UX: no hierarchy, no state handling, no recovery.
- `0`: not applicable.

### DX: Developer Experience

Review for first five minutes, setup, API shape, docs, errors, migration, debugging, and operational developer journey.

Ask:

- What is time to hello world: `<2m`, `2-5m`, `5-10m`, `10-15m`, or `>15m`?
- Can a new developer install and run without sales calls, hidden prerequisites, or doc hunting?
- Is the happy path a small, idiomatic snippet with safe defaults?
- Are escape hatches available for non-default use?
- Do errors say what happened, why, and how to fix it?
- Are raw stack traces hidden from user-facing output?
- Are docs searchable, runnable, current, and split into quickstart, tutorial, reference, and troubleshooting?
- Are upgrades documented with changelog, migration guide, deprecation policy, and codemod where possible?
- Is the full journey covered: discover, evaluate, install, hello world, integrate, debug, upgrade, scale, migrate?
- Can developers verify success locally or in CI without guessing?

Failure modes:

- Hidden prerequisite or environment assumption.
- Quickstart cannot run from a clean machine.
- API requires boilerplate before value.
- Errors expose internals but not fixes.
- Docs lack versioning, examples, troubleshooting, or migration path.
- Defaults are unsafe in production.

Score:

- `9-10`: TTHW <2m, excellent API, actionable errors, complete docs, escape hatches, automated migration.
- `7-8`: TTHW 2-5m, minor setup/API/doc friction, good errors.
- `5-6`: TTHW 5-10m, notable friction, opaque errors, docs gaps.
- `3-4`: TTHW 10-15m, painful setup, inconsistent API, sparse docs, raw stack traces.
- `1-2`: TTHW >15m or cannot start without workarounds.
- `0`: not applicable.

## Finding Format

Every finding must use this exact shape:

`N. [P0|P1|P2|P3] Title — Evidence: <specific citation or explicit absence>. Impact: <concrete failure/harm>. Required change: <smallest concrete fix needed to pass>.`

Rules:

- Title names the broken thing, not the recommendation.
- Evidence must be specific enough to locate.
- Impact must name what breaks, who is harmed, or which decision becomes unsafe.
- Required change must be concrete, not a wishlist.
- Combine multiple symptoms when they share one root cause.
- Vague findings are invalid.

Valid examples:

- `[P0] Migration can corrupt data — Evidence: plan says "rewrite IDs in place" but has no backup, idempotency, dry run, or rollback. Impact: partial failure can permanently orphan records. Required change: add reversible migration with backup, dry run, batch checkpointing, and rollback test.`
- `[P0] Auth boundary is undefined — Evidence: API section lists endpoints but no permission model or tenant isolation. Impact: users can access or mutate another tenant's data. Required change: define authorization checks per endpoint and add cross-tenant denial tests.`
- `[P1] Empty state blocks activation — Evidence: onboarding depends on existing projects but no first-project path is specified. Impact: new users land on a dead end before seeing value. Required change: design empty state with guided creation and recovery copy.`

## Cross-Axis Synthesis

After axis scoring, identify interaction effects:

- CEO value depends on Engineering risk that is not controlled.
- Design promises a smooth flow but Engineering lacks states or rollback.
- DX quickstart exposes unsafe defaults.
- Engineering complexity exceeds business learning needs.
- CEO wants speed while Engineering requires safety gates.
- Design creates a pattern that DX or Engineering cannot support.

Synthesis must name:

- Pattern-level gaps.
- Tension points.
- Risk concentration.
- Top required changes.

## Anti-Patterns

Do not:

- Use praise sandwich.
- Score based on effort, ambition, or stated confidence.
- Hide uncertainty behind neutral language.
- Treat missing evidence as probably fine.
- Allow `APPROVE` with a P0.
- Skip Design because the artifact is technical while it changes user behavior.
- Skip DX because the artifact is internal while developers must adopt or operate it.
- Accept future work without owner, trigger, and tracking.
- Add a second verdict line.
- Put prose after the final verdict.

## Fail-Closed Rules

- Missing artifact: `REJECT`.
- Malformed or unreviewable artifact: `REJECT`, unless a narrow missing detail affects only one axis; then `REVISE`.
- Applicable axis skipped without justification: at least `REVISE`.
- Required evidence missing for a material claim: at least `REVISE`.
- Any P0: never `APPROVE`.
- Multiple independent P0s: usually `REJECT`.
- Fundamental approach wrong: `REJECT`.
- Output format cannot be parsed: regenerate before finalizing.

## Verdict Mechanics

Apply these rules deterministically after scoring all applicable axes and classifying findings:

- `APPROVE` only when every applicable axis scores at least `8/10` and there are no unresolved `P0`, `P1`, or material `P2` findings.
- `REVISE` when the artifact is promising but any applicable axis scores `5-7`, or there is any unresolved `P1`, `P2`, material ambiguity, or evidence gap that does not make the artifact fundamentally invalid.
- `REJECT` when any applicable axis scores below `5`, any `P0` exists, the premise is fundamentally invalid, the artifact is impossible or unsafe to review, required artifacts are missing, or a severe axis failure makes the plan unfit to proceed.
- Do not average scores across axes. The weakest applicable axis and highest-severity unresolved finding control the verdict.
- `N/A` axes do not affect thresholds, but unjustified `N/A` counts as a skipped applicable axis and forces at least `REVISE`.

## Output Format

Use this structure. Actual output must use one of `APPROVE`, `REVISE`, or `REJECT` and must have no prose, bullets, notes, or caveats after the final verdict line.

```markdown
## Multi-Reviewer Results

### CEO Score: N/10 | N/A
Evidence: ...
Findings:
1. [P#] Title — Evidence: ... Impact: ... Required change: ...

### Engineering Score: N/10 | N/A
Evidence: ...
Findings:
1. [P#] Title — Evidence: ... Impact: ... Required change: ...

### Design Score: N/10 | N/A
Evidence: ...
Findings:
1. [P#] Title — Evidence: ... Impact: ... Required change: ...

### DX Score: N/10 | N/A
Evidence: ...
Findings:
1. [P#] Title — Evidence: ... Impact: ... Required change: ...

## Cross-Axis Synthesis

**Pattern-Level Gaps**: ...
**Tension Points**: ...
**Risk Concentration**: ...
**Top Required Changes**:
1. ...
2. ...
3. ...

**Overall Verdict**: APPROVE|REVISE|REJECT
```
