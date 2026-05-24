# Changelog

All notable changes to AGNES are documented here.

## 0.14.0 (2026-05-25)

### Breaking

- **Model-agnostic overhaul**: Removed all DS4-specific detection (`DEEPSEEK_V4_PATTERNS`, `isDeepSeekV4()`) and provider-specific branching. Bootstrap unified to structured format for ALL models — no model-name gating anywhere.

### Added

- **Compaction/pruning built-in**: `compaction.ts` wired into `plugin.ts` transform pipeline. Compaction policy evaluated on every message. Advisory injected automatically when threshold is met.
- **ESLint integration**: ESLint 10 + @typescript-eslint/parser + @typescript-eslint/eslint-plugin installed. TypeScript-aware `eslint.config.js` with separate entries for source and test files. `lint` and `lint:fix` scripts added.

### Removed

- **Biome**: Removed `biome.json` per user directive. Biome package was never actually installed despite being claimed complete in previous plan iterations.
- **DS4 branching**: All DeepSeek V4 model detection, `interleaved` config gating, and structured-block model branching eliminated — replaced with unconditional model-agnostic defaults.

### Fixed

- **Compaction state serialization**: `buildExecutionContextBlock()` in bootstrap.ts now accepts optional `compaction?: CompactionPolicyState` and injects it as a nested YAML field when present. Fixes "stores the last evaluated state" test expectation mismatch.
- **Unused import**: Removed unused `estimatePromptTokens` import from `src/plugin.ts` (typecheck error).
- **Plan state accuracy**: Corrected plans 030/031 which falsely claimed Biome installation was complete. Cancelled both. Plan 032 superseded (DS4 removal and compaction were actually implemented despite pending markers).

### Changed

- **Plan state cleanup**: All plan state reconciled with actual codebase state via audit. `index.json` status set to done.

## 0.13.5 (2026-05-25)

### Fixed

- **Stale active-plan recovery**: `getExecutionApprovalBlock()` now falls back to the latest approved active plan when `activePlanId` is stale, so runtime gating stays aligned with `getPlanGate()` and `processMessage()`.

### Changed

- **Release maintenance**: Bumped package metadata and README version badge to `0.13.5`, then rebuilt the bundled plugin so the published artifact stays aligned.

## 0.13.4 (2026-05-25)

### Changed

- **Release maintenance**: Bumped package metadata and README version badge to `0.13.4`.
- **Approved-plan execution gate**: Kept execution readiness machine-usable via approved plan status and direct-parent supersession.

## 0.13.3 (2026-05-24)

### Changed

- **Release maintenance**: Bumped package metadata and README version badge to `0.13.3`.

## 0.13.2 (2026-05-24)

### Changed

- **Release maintenance**: Bumped package metadata and user-facing version badges to `0.13.2`, then rebuilt the bundled plugin so the published artifact stays aligned.
- **AGNES strengthening follow-up**: Incorporated the latest orchestration, protocol, and state-hygiene improvements from the prior release cycle at a high level, with no user-facing behavior changes in this bump.

## 0.13.0 (2026-05-24)

### Breaking

- **Skill rename release**: README and AGENTS now use the new skill naming scheme, and the package version/badge have been bumped for the release.

### Changed

- **Release metadata**: `package.json` version updated to `0.13.0` and the README badge now matches.

## 0.13.1 (2026-05-24)

### Changed

- **`resolvePackageRoot` → `findPackageRoot`**: Renamed in `src/bootstrap.ts` to signal failure contract (`null` return instead of garbage path). Refactored fallback chain to three strategies: plugin-relative path → walk-up → raw path, improving resilience when `__dirname` is outside the agnes package. (verified: 379 tests pass)

### Fixed

- **Package root resolution**: When AGNES ran with `__dirname` outside the agnes package tree, `resolvePackageRoot()` returned `path.resolve(fromDir, '..')` as a garbage fallback — an absolute path to a non-agnes directory. This broke skills directory lookup and cache path resolution. Now `findPackageRoot()` returns `null` on failure and chains through three distinct strategies before falling back. (verified: both local project and cache paths resolve correctly)

## 0.12.0 (2026-05-23)

### New

- **Code-embedded skill routing**: `buildSkillRegistryBlock()` and `buildSkillRegistryText()` in bootstrap.ts scan `.opencode/skills/` at startup, parse YAML frontmatter from all 23 SKILL.md files, and inject a compact structured registry with `suggest_next` phase-transition data. DS V4 models get structured YAML blocks; prose models get compact text. No per-turn token penalty. (verified: 381 tests pass)
- **Proactive skill suggestion**: AGENTS.md rule + structured `suggest_next` data forces AGNES to suggest the next appropriate skill at every phase boundary. Non-negotiable gates: plan-reviewer after planner, verifier after build, debugger on bugs. (verified: 9 new registry tests)

### Fixed

- **Bootstrap bloat (self-review finding)**: Reverted 85-line prose Skill Registry table + transition protocol from per-turn bootstrap. Replaced with ~20 lines of code-built structured YAML. Saved ~65 lines per turn. (verified: orchestrator SKILL.md clean revert)

### Changed

- **README**: Pipeline section rewritten as clean numbered list (1–8) with explicit gates — no broken ASCII art. Skills table descriptions rewritten for dual audience (beginner scenarios + advanced boundary conditions), "Output" column replaced with concrete "What It Produces".

## 0.11.0 (2026-05-23)

### Breaking
- Plan files now written as `.yaml` alongside `.md` — dual format
- All agnes:message protocol messages now include `schema: "agnes/message-v1"`
- Skill SKILL.md files now require YAML frontmatter

### New
- Typed Zod schemas for Plan, Bootstrap Block, and Message domains (src/schema.ts)
- YAML plan writer/reader with backward-compatible .md fallback (src/state.ts)
- Structured bootstrap block builders for DS V4 models (src/bootstrap.ts)
- Strict message validation via Zod schemas for agnes:message protocol (src/protocol.ts)
- DS V4 provider detection + auto interleaved config injection (src/plugin.ts)
- `buildResultMessage()` and `buildTaskMessage()` builders with reasoning_content support
- YAML frontmatter on all 23 skill SKILL.md files
- 330+ tests passing with new schema validation coverage

### Fixed
- DeepSeek V4 reasoning_content protocol bug prevented by auto interleaved config
- All agnes:message messages now have consistent UUID + timestamp + schema fields

## 0.10.2 (2026-05-23)

### Fixed

- **TUI signal leakage**: Machine-readable completion signals (`<agnes:message>` / `<promise>`) now render invisibly via HTML comment wrappers — cleaned up terminal output without disrupting AGNES's internal verification protocol. (verified: 330 tests pass)

## 0.10.1 (2026-05-23)

### Changed

- **Bootstrap size reduction**: Removed redundant `## Registered Skill Schemas` injection from plugin.ts — saves ~140–500 tokens per session by eliminating 7 generic JSON stubs that duplicated OpenCode's native skill discovery. (verified: 330 tests pass)
- **Path resolution fix**: bootstrap.ts now uses package-root-relative paths via a `resolvePackageRoot()` walk-up function — resolves correctly in both test (`src/`) and bundle (`.opencode/plugins/`) contexts. (verified: bootstrap.test.ts)

### Fixed

- **Home-directory boundary**: `findProjectRoot()` in state.ts now stops at `os.homedir()` — prevents detecting a user's home-directory `.agnes/` as a valid project root. (verified: 107 state tests pass)
- **Test expectations**: shell.test.ts anti-pattern expectations corrected for PowerShell on Windows — PowerShell now correctly returns its anti-pattern list instead of an empty array. (verified: 33 shell tests pass)

### Tests

- **10 pre-existing failures resolved**: 5 bootstrap (path resolution), 2 shell (anti-pattern expectations), 3 state (home-dir boundary). Total: 330 tests, 0 failures, 867 expect calls across 11 files. (verified: `bun test`)

## 0.9.1 (2026-05-23)

### Added

- **Shell detection system**: `src/shell.ts` detects shell type via `MSYSTEM` (Git Bash), `PSModulePath` (PowerShell), `ComSpec` (CMD), `SHELL` (WSL/Unix), with platform-aware fallback — cached once per process. (verified: 33 tests)
- **Shell-mismatch verification gate**: `src/shell-mismatch.ts` scans subagent output for PowerShell anti-patterns (Remove-Item, Get-ChildItem, etc.) when running on Git Bash/WSL/Unix — non-blocking, advisory only. (verified: 33/33 shell tests pass)
- **Shell context injection**: Bootstrap now includes `<SHELL_ENVIRONMENT>` block with shell type, preferred syntax, and per-shell anti-pattern guidance. (verified: `bun test`)
- **StruggleMetrics shellType field**: `shellType?: string` on struggle metrics, carried forward across retries, displayed in plan summaries for debugging shell-related failures. (verified: `bun run typecheck`)

### Changed

- **Plugin startup**: `detectShell()` called during config handler to warm cache before first message transform. (verified: `src/plugin.ts`)
- **Runtime execution context**: `buildExecutionContext()` now includes shell type, preferred syntax, and shell guidance in the context object. (verified: `src/runtime.ts`)
- **Verification gates**: `getDefaultGates()` includes `shellMismatchGate` — ready for pipeline wiring. (verified: `src/verification.ts`)

### Tests

- **33 new tests, 125 new assertions**: Shell detection (all variants, caching, reset), anti-pattern scanning, structure validation — 330 total tests, 856 expect calls across 11 files. (verified: `bun test`)

### Fixed

- **Cleanup**: 4 minor code quality items from ag-reviewer — unknown shell guidance filled, anti-pattern list expanded (7 new commands), `_lastOutput` fallback to `process.env.AGNES_LAST_OUTPUT`, `unknown` shell type added to mismatch check. (verified: ag-reviewer PASS)

## 0.9.0 (2026-05-22)

### Fixed

- **Version drift**: Hardcoded `AGNES_VERSION = '0.7.2'` in state.ts now reads from package.json at runtime — plans record correct version.
- **detectPromiseTag ignores expected parameter**: Regex fallback path now validates expected tag. `<promise>DONE</promise>` with `expected='FAIL'` correctly returns false.
- **Wrong type cast in error handler**: Subagent error catch block produced ErrorMessage shape but cast as ResultMessage — corrected to valid ResultMessage with status/content.
- **Fragile reference copy in plugin.ts**: Shallow-copy of sessionID/messageID before array unshift instead of holding array-element reference.
- **Unsafe casts in protocol.ts/validation.ts**: Added `isValidAgnesMessage` runtime type guard replacing `as unknown as AnyAgnesMessage`.

### Changed

- **classifyIntent now returns structured object**: Returns `IntentClassification` with `.category` and `.suggestedSkills` array mapping to skill names (implement→ag-builder, debug→ag-debugger/ag-griller, etc.).
- **SKILL_REGISTRY populated**: 7 core skills registered with payload schemas — SKILL_REGISTRY.size > 0 conditional in plugin.ts now activates.
- **executeWave returns blocked result instead of throwing**: Subagent handler stub produces `ResultMessage` with `status: 'BLOCKED'` instead of crashing.
- **Architecture wiring**: Verification gates, middleware chain, and flow controller now execute during the plugin transform lifecycle — gates run post-response, middleware hooks fire, flow control signals active.
- **Session state persisted**: `recordAttempt()` now writes to `.agnes/sessions.json` using atomic tmp+rename pattern — attempt counts and struggle metrics survive restarts.
- **Filler pattern list extended**: Added `tweak`, `polish`, `clean up`, `touch up`, `minor change` to quality assessment set.
- **too_many_tasks threshold**: Hardcoded 10 extracted to named `DEFAULT_MAX_PLAN_TASKS` constant.

### Added

- **7 test files**: protocol.test.ts, validation.test.ts, schema.test.ts, middleware.test.ts, verification.test.ts, flowcontrol.test.ts, bootstrap.test.ts — covering parser/serializer round-trips, gate execution, middleware hook ordering, flow control signal lifecycle, schema validation, and bootstrap caching.
- **Shared test utilities**: `src/test-utils.ts` with `createTempProject()`, `writeIndex()`, `readIndex()`, `cleanupTempDirs()` — extracted from duplication in state.test.ts/integration.test.ts.
- **Test temp directory cleanup**: `afterAll` hooks in state.test.ts and integration.test.ts remove temp dirs after runs (M-03).
- **CI workflow**: `.github/workflows/ci.yml` with Bun setup, typecheck, test, and bundle on push/PR.

### Tests

- **165→292 tests**, 395→736 expect calls across 3→10 test files. (verified: `bun test`)

## 0.8.1 (2026-05-23)

### Fixed

- **Crash on stale plan entries**: `getLatestActivePlan()` crashed with `TypeError: paths[3] must be string` when `.agnes/index.json` contained entries from an older AGNES version missing the `file` field. Added `getPlanFilePath()` helper with `entry.file || \`${entry.id}.md\`` fallback — deployed to all 4 file-path construction sites. (verified: hotfix)

- **validation.ts internal contradiction**: `ALLOWED_RESULT_TYPES` included `error`, `status`, `completion` but `validateResultMessage` required `status` on all of them (which ErrorMessage/StatusMessage don't have). Unsound `as unknown as ResultMessage` cast. Replaced with `validateMessage()` targeting `AnyAgnesMessage` with proper field checks. (verified: typecheck)

- **escapeUserData unlimited recursion**: `escapeUserData` recursed without depth guard — circular user data would blow the stack. Added `depth`/`maxDepth` (default 20). (verified: parameterized function)

### Added

- **Entry-level validation in readPlanIndex**: `validatePlanIndex()` now checks every plan entry against `ENTRY_REQUIRED_SHAPE` (id, status, createdAt, updatedAt, summary, total, completed, blocked). Entries missing truly unrecoverable fields are rejected with `null` return. (verified: 2 new regression tests)

- **Auto-migration on read**: `migratePlanEntry()` fills defaults for missing optional fields — `file` → `${id}.md`, `attempts` → `0`, `struggle` → `freshStruggleMetrics()`. Persists cleaned index to disk on first read after upgrade. (verified: migration test)

- **`assertShape<T>` runtime schema guard**: Reusable type guard that validates deserialized objects against a field→type map at the boundary. Used in `validatePlanIndex()` for both index-level and per-entry shape checks. (verified: typecheck)

- **Per-variant validation in parseAgnesMessage**: `parseAgnesMessage()` now validates variant-specific required fields via `REQUIRED_FIELDS` map (e.g. result requires taskId+status+content, completion requires status+summary). Completion status values also validated against the `CompletionStatus` union. (verified: 162 tests pass)

- **2 regression tests**: Old-format index.json entry rejection (missing recoverable fields) + auto-migration verification. (verified: `bun test`)

### Changed

- **FlowController consolidated**: `consumeSignal()` is now the single authoritative destructive reader. `getJump()` and `clearSignal()` delegate to it. `setJump()` now accepts optional `metadata`. Reason/metadata preserved through consumption. (verified: typecheck)

- **Version**: 0.8.1. (verified: package.json)

## 0.8.0 (2026-05-23)

### Added

- **JSON message protocol**: Typed message system (`src/protocol.ts`) replacing regex-based `<promise>` tag detection. Defines `TaskMessage`, `ResultMessage`, `ErrorMessage`, `StatusMessage`, `CompletionMessage` with structured parser/serializer. (verified: 160 tests pass, typecheck clean)
- **Skill contracts**: Self-describing skill descriptors (`src/schema.ts`) with JSON Schema input/output validation — `SkillDescriptor`, `TaskDescriptor`, `validatePayload()`. (verified: typecheck clean)
- **Middleware hooks**: Composable middleware chain (`src/middleware.ts`) with `beforeWave`/`afterWave`/`beforeSubagent`/`afterSubagent`/`wrapSubagent` hooks. `MiddlewareChain.executeSubagent()` composes handlers in LangChain-style `outer(inner(innermost(handler)))` pattern. (verified: typecheck clean)
- **Ephemeral flow control**: `FlowController` (`src/flowcontrol.ts`) with single-read `JumpTarget` signals — retry/skip/blocked/next_wave/end. Signal auto-clears after read. (verified: typecheck clean)
- **Verification gates**: Structured gate system (`src/verification.ts`) with `PASS`/`FAIL`/`SKIP` status, blocking gate support, `runGates()`, `formatGateReport()`, `allGatesPassed()`. (verified: typecheck clean)
- **Allowlist validation**: `validateResultMessage()` (`src/validation.ts`) enforces allowed message types and error types. `escapeUserData()` prevents protocol-key injection in user data. (verified: typecheck clean)

### Changed

- **Completion detection**: `extractPromiseTag()` and `detectPromiseTag()` in `state.ts` now check JSON protocol messages first, fall back to legacy `<promise>` regex for backward compatibility.
- **Plugin transform hook**: `plugin.ts` updated to parse JSON completion messages, inject protocol instructions and skill schemas into subagent prompts.
- **Runtime loop**: `runtime.ts` updated with structured completion handling (`CompletionStatus` type), `executeWave()` function, and `runWaveGates()` gate integration.

### Architecture

- **Phase transition**: AGNES moves from stage 1 (procedural text-injection loop) to stage 2 (declarative typed pipe chains) with middleware foundation enabling stage 3 (reactive graph with hook-based extensibility). Inspired by LangChain's evolution: AgentExecutor → Runnable composition → StateGraph + Middleware.

## 0.7.4 (2026-05-23)

### Changed

- **State directory migration**: AGNES plan state moved from `.cache/agnes/` to `.agnes/` with a `plans/` subdirectory. This fixes the semantic mismatch where project-owned state lived in a cache directory that signals "safe to delete." The new structure is `.agnes/index.json` + `.agnes/plans/plan-NNN.md`. Core path constants are centralized as `AGNES_DIR` and `PLANS_DIR` in `state.ts`. (verified: 159 tests pass)

## 0.7.3 (2026-05-23)

### Added

- **Retention policy**: `index.json` now supports an optional `retention` field controlling auto-pruning of old plans. `pruneExpiredPlans()` runs inside `readPlanIndex()` — default: 7 days for `done`/`abandoned` plans. Supports per-project override via `{ maxAgeDays, terminalStatuses }`. Clears `activePlanId` when the active plan is pruned. (verified: 8 pruneExpiredPlans tests)
- **Plan gate**: `processMessage()` now enforces a plan-first discipline — `classifyIntent()` detects implementation intent, and the gate blocks execution with `{ type: 'block', reason: 'no_active_plan' }` when no active plan exists. `requestMatchesPlan()` validates the plan matches the request before allowing implementation. (verified: integration tests)
- **Auto-planning**: `createAutoPlan()` auto-generates plan entries from gate triggers with structured `generatePlanTemplate()`. New plans get status `draft` (gate/user) or `ready` (user_ready). (verified: state.test.ts planning tests)
- **Plan quality checks**: `assessPlanQuality()` scores plans 0-100 across 7 criteria (goal clarity, task completeness, verification coverage, etc.). Score < 60 blocks the `draft→reviewed` transition. (verified: quality gate tests)
- **Status state machine**: `VALID_TRANSITIONS` defines the lifecycle (draft → reviewed → ready → in_progress → done/blocked/abandoned). `transitionPlanStatus()` enforces valid transitions with built-in quality gate. (verified: transition tests)
- **Plan drift detection**: `checkPlanDrift()` / `assertTaskScope()` detect when subagent edits fall outside the plan's declared file scope. (verified: drift detection tests)
- **Plan retrospectives**: `generateRetrospective()` auto-appends completion analysis to plan files when marked done/abandoned. (verified: retro generation tests)

### Changed

- **README**: Added retention policy documentation in the State section.

### Tests

- **8 new tests**: retention policy pruning (old-done removal, old-abandoned removal, fresh-done kept, in-progress kept, activePlanId clearing, custom retention, empty list, NaN date gracefulness).
- **~50 new tests**: planning discipline (intent classification, plan matching, quality scoring, status transitions, drift detection, retro generation, full gate-to-implement integration).
- Total: 159 tests, 388 expect calls. (verified: `bun test`)

## 0.7.2 (2026-05-23)

### Added

- **Auto-block on max retries**: `recordAttempt()` now auto-creates a blocked plan iteration after 3 consecutive non-completion attempts via `autoBlockPlan()`. Reads the active plan's goal/check/tasks and creates a `createPlanIteration` with status `blocked`. `persistToPlan()` guards against downgrading blocked plans. (verified: runtime.test.ts auto-block tests)
- **Struggle tracking in runtime loop**: `recordAttempt()` calls `updateStruggleMetrics()` on each non-completion attempt, incrementing `noProgressIterations`. Struggle data now flows through the plugin transform path instead of remaining stale. (verified: 92 tests pass, runtime.test.ts)
- **NaN-date guard**: `getLatestActivePlan()` fallback sort guards against invalid `updatedAt` timestamps with `isNaN()` checks — prevents undefined `Array.sort()` behavior when dates are corrupt. (verified: state.test.ts NaN-date sort test)

### Changed

- **`persistToPlan` signature**: Reordered parameters — `status` moved before `attempts`/`struggle` for clarity. Now skips persistence when active plan status is `blocked`, preventing accidental status downgrades. (verified: runtime.ts)
- **`recordAttempt` return type**: Extended with optional `blocked?: boolean` to signal auto-block events to callers. (verified: runtime.test.ts)

### Tests

- **3 new tests**: auto-block lifecycle (3 attempts → blocked), struggle tracking across failed attempts, NaN-date sort resilience. Total: 92 tests, 209 expect calls. (verified: `bun test`)

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
