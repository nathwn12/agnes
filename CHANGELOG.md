# Changelog

All notable changes to AGNES are documented here.

## 0.7.1 (2026-05-22)

### Changed

- **State authority model**: `index.json` is now the sole runtime source of truth for all plan state (status, counts, attempts, struggle). Plan markdown files (`plan-NNN.md`) are narrative-only — their frontmatter contains only identity metadata (`id`, `createdAt`, `updatedAt`, `parent`). This eliminates the state drift between indexed truth and markdown truth that was present in 0.7.0. (verified: state.test.ts invariants)

- **Plugin shrunk to adapter role**: `src/plugin.ts` reduced from 196→109 lines. Session tracking, attempt counting, and loop state management moved to `src/runtime.ts`. Plugin now handles bootstrap injection, hook wiring, and message-format parsing only — all orchestration logic lives in runtime. (verified: bun run typecheck)

- **Runtime loop uses structured signals first**: `recordAttempt()` in runtime.ts is the sole entry point for attempt tracking. Only `<promise>DONE</promise>` closes the loop; other tags are ignored for completion. Transcript heuristics (progress detection via text patterns, error extraction from prose) are removed — they produced false positives and were not orchestrator concerns. (verified: runtime.test.ts invariants)

- **Struggle detection simplified**: Without transcript-derived `hadProgress` and `extractErrorsFromOutput`, struggle metrics are only updated when AGNES has real structured execution signals to persist. Warnings are advisory and do not gate retry decisions. (verified: state.test.ts)

### Added

- **Invariant test suite**: 7 new tests covering state synchronization (plan file vs index.json), `recordAttempt` lifecycle (completion resets, attempt increments, loop-around behavior), and narrative content preservation. (verified: 84 tests pass)

- **Boundary document**: `docs/design-001-boundary.md` explicitly defines AGNES core responsibilities (routing, gating, state tracking, subagent delegation, promise-driven completion) vs advisory support systems. This document is the architectural reference for future development.

### Removed

- **Transcript progress detection**: `hadProgress` heuristic in plugin.ts that parsed assistant output for ````diff`, `file modified`, `created:`, and negative signals (`can't`, `couldn't`, `error`). Completion is now determined by promise tag only.

- **Error extraction from output**: `extractErrorsFromOutput()` removed from state.ts (88 lines). Error extraction from transcript text was heuristic-based and advisory-only.

- **Frontmatter runtime fields**: `status`, `total`, `completed`, `blocked` removed from plan-NNN.md YAML frontmatter in both `createPlan()` and `createPlanIteration()`. These fields are now written exclusively to `index.json`.

## 0.7.0 (2026-05-22)

### Added

- **Promise-tag detection**: `detectPromiseTag()` and `extractPromiseTag()` parse `<promise>...</promise>` tags from agent output — enables closed-loop completion verification for delegated execution. (verified: state.test.ts)
- **Struggle detection system**: `freshStruggleMetrics()`, `updateStruggleMetrics()`, `detectStruggle()` track no-progress iterations, short runs (<30s), and repeated errors — warns after configured thresholds to prevent infinite retry loops. (verified: state.test.ts)
- **Session-based attempt tracking**: Plugin now scans conversation history across turns, tracking `attempts` and `struggle` metrics per session via `sessionState` Map, and persists them to plan state through `updatePlanStatus`. (verified: src/plugin.ts)
- **Execution context injection**: Bootstrap now includes active plan's execution context (attempt count, struggle signals, recurring errors) — gives AGNES awareness of prior-turn progress. (verified: src/runtime.ts)
- **Iteration report runtime**: `buildIterationReport()` and `mergeIterationIntoState()` provide a structured interface for delegation subagents to report results back into plan state. (verified: src/runtime.ts)

### Changed

- **PlanIndexEntry schema**: Extended with optional `attempts: number` and `struggle: StruggleMetrics` — `createPlan()`, `createPlanIteration()`, and `updatePlanStatus()` all support these fields with carry-forward semantics. (verified: state.test.ts)
- **BuildPlanSummary enrichment**: Now includes attempt count and struggle indicators (no-progress, short-runs, repeated-errors, last-promise) when present. (verified: src/state.ts)

### Tests

- **319 new test lines**: Promise tag detection (6 tests), struggle metrics lifecycle (9 tests), error extraction from output (4 tests), plan state persistence with attempts/struggle (5 tests). (verified: `bun test`)

## 0.6.0 (2026-05-22)

### Added

- **State system v2**: Migrated from `docs/agnes/` to `.cache/agnes/` — immutable plan-NNN.md files with append-only iteration model, searchable index.json metadata hub. (verified: 37 tests pass)
- **Delegation Contract**: Five hard rules enforced — main context restricted to state/communication; dynamic subagent count; fresh subagents per wave; closed-loop execution; self-audit gate before every response. (verified: automation gate tests)
- **Blocked plan gate**: `getPlanGate()` returns `BLOCKED PLAN` when active plan has blocked > 0 — prevents infinite retry loops. (verified: `src/state.test.ts:653`)
- **Self-audit boundary enforcement**: Boundary violations create blocked plan iteration and stop — no self-correction in same message. (verified: state machine tests)

### Changed

- **Plugin rewrite**: Replaced legacy `docs/agnes/` state reads with `.cache/agnes/index.json` + `plan-NNN.md` — now injects active plan summary, plan gate, and AGENTS.md content. (verified: `src/plugin.ts`)
- **Bootstrap injection**: Dynamic AGNES_PLAN_STATE injection with active plan summary (ID, status, tasks, goal) instead of old state file blocks. (verified: `src/bootstrap.ts`)
- **State API surface**: Replaced 10 legacy functions (`detectStateDirectory`, `listStateFiles`, `readFrontmatter`, etc.) with 4 PlanIndex CRUD functions + `getPlanGate`/`getPlanState`. (verified: `src/state.ts`)
- **ag-init output**: Now generates `.cache/agnes/index.json` and `plan-001.md` instead of `docs/agnes/` files. (verified: `ag-init/SKILL.md`)
- **SKILL.md Tool Requirements**: Clear separation of AGNES main-context tools vs subagent-only tools (`edit`, `glob`, `grep`). (verified: orchestrator/SKILL.md)

### Removed

- **Legacy state APIs**: All old `docs/agnes/` directory detection, file reading, and state snapshot functions — replaced by PlanIndex CRUD. (verified: `bun run typecheck`)
- **`review-package/`**: Temporary audit artifacts removed from tracking. (verified: `git rm`)

### Fixed

- **Plugin duplicate plan-state append**: BuildPlanSummary was read and appended twice — now only planGate is appended after goal injection. (verified: `src/plugin.ts`)

## 0.5.0 (2026-05-22)

### Added

- **Delegation Contract**: Five hard rules bootstrapped every session — main context restricted to communication and state management only; dynamic subagent count per wave; fresh subagents per wave; closed-loop execution (PLAN→REVIEW→IMPLEMENT→TEST / FIX→REVIEW→VERIFY); self-audit gate before every response. (verified: `bun run typecheck`, `bun test`)
- **Self-audit gate**: Before every user-facing response, AGNES silently checks for boundary violations. If found — creates a blocked plan iteration and stops. No self-correction in the same message. (verified: `bun test`)
- **Immutable plan iteration model**: Plan files are append-only. Every state transition creates `plan-NNN+1.md` with parent reference. No edits to existing plan files. (verified: `bun test`)

### Changed

- **State system migrated**: Replaced `docs/agnes/goal.md + plan.md + handoff.md` with `.cache/agnes/index.json + plan-NNN.md`. Index serves as searchable metadata hub — read once, filter by status/project without re-reading old files. (verified: `bun test`)
- **Bootstrap injection**: Now injects active plan summary (plan ID, status, task counts, goal) instead of old goal/handoff blocks. Missing plan produces explicit instruction. (verified: `bun run typecheck`)
- **ag-init output**: Now generates `.cache/agnes/index.json` and `plan-001.md` instead of `docs/agnes/` state files. (verified: code review)
- **Design output paths**: Moved from `docs/agnes/<type>/` to `docs/<type>/` (specs, plans, PRDs, learnings, architecture docs) — no longer conflated with state directory. (verified: `grep` confirms zero stale `docs/agnes` references in active code)

### Removed

- **Legacy state APIs**: `detectStateDirectory()`, `listStateFiles()`, `loadFileData()`, `readFrontmatter()`, `getFileStatus()`, `readStateFile()`, `getStateSnapshot()`, `buildStateInjectionStrings()` — all replaced by PlanIndex CRUD functions. (verified: `bun run typecheck`)

### Fixed

- **Plugin build staleness**: Rebuilt `.opencode/plugins/agnes.js` from updated source — OpenCode was loading old docs/agnes plugin code. (verified: `grep` confirms zero stale references in built output)
- **Stale reference cleanup**: All 6 skill files, README, and orchestrator SKILL.md reference section updated to reflect new state system. (verified: `grep`)

## 0.4.4 (2026-05-21)

### Fixed

- **Frontmatter truncation regression (0.4.3)**: Replaced broken 4 KB header read in `readFrontmatter()` with a single-read-per-file helper that always parses the full frontmatter — no more silent status drops when closing `---` lands past byte 4096. (verified: `bun test`, `bun run typecheck`)
- **File descriptor leak**: Removed manual `openSync`/`readSync`/`closeSync` from `readFrontmatter()` — eliminated the descriptor leak on read errors that was introduced in 0.4.3. (verified: `bun test`)
- **Duplicate file reads on hot path**: `buildStateInjectionStrings()` and `getCurrentState()` now share one `getStateSnapshot()` call per message transform, so each state file is read exactly once instead of 4–6 times. (verified: `src/state.ts` diff, `src/plugin.ts` diff)

## 0.4.3 (2026-05-21)

### Fixed

- **Part structural compliance**: Bootstrap injection now constructs a fully valid `TextPart` with `id`, `sessionID`, and `messageID` — prevents downstream rejection or silent drops when OpenCode validates message part shapes. (verified: `bun run typecheck`, emitted JS inspection)

### Fixed (retroactively corrected in 0.4.4)

- **Frontmatter read performance (regression)**: Reverted full-file read in `readFrontmatter()` — restored 4KB header-only read to eliminate latency on the chat-transform hot path, but inadvertently truncated frontmatter when closing `---` landed past byte 4096. Fixed in 0.4.4. (verified: `bun test`)

## 0.4.2 (2026-05-21)

### Fixed

- **Cache invalidation**: Bootstrap cache now invalidates when `ag-orchestrator/SKILL.md` mtime or package version changes — no more stale bootstraps after updates. (verified: `bun run bundle && bun run typecheck`)
- **Silent error swallowing**: Replaced empty catch blocks in `plugin.ts` with `console.debug` — state read failures are now observable during debugging. (verified: code review)
- **Spelling**: Normalized British `Initialise` → American `Initialize` in `AGENTS.md` — consistent with codebase convention. (verified: visual diff)

### Changed

- **State file schema**: Reduced from 4 to 3 files (`session.md` removed). Runtime now only watches `goal.md`, `plan.md`, `handoff.md`. All skills and docs aligned. (verified: `grep` confirms zero references to `session.md` in runtime)
- **README skill table**: Added missing `ag-orchestrator` entry — table now matches the 23-skill badge. (verified: count matches)
- **Pipeline diagram**: Added missing `→ Debug →` phase between Verify/Review and Ship. (verified: visual diff)

### Improved

- **Plugin performance**: Single workspace-root traversal per message transform — `detectStateDirectory()` called once, result shared across state injection and plan gate. (verified: `src/plugin.ts` diff)
- **Frontmatter parsing**: Replaced fragile 4KB buffer read with full file read for frontmatter extraction — no more truncation on large files. (verified: `src/state.ts` diff)
- **Code hygiene**: Removed dead `findProjectRoot()` function, unnecessary spread `{...ref}` in message injection. (verified: `git diff --stat`)

### Dev

- **Pinned dependency**: `@opencode-ai/plugin` pinned to `^1.15.5` — no more floating `latest` surprises. (verified: `package.json`)
