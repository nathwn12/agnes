# Code Deletion Log

## [2026-06-06] Dead Code Cleanup — First Pass

### Unused Files Deleted
- `src/model-routing-policy.ts` — 37 lines, completely unreferenced (no imports in any source or test file). Contained `ModelRoutingConfig`, `DEFAULT_MODEL`, `generateDefaultConfig`, `populateAgentList`, `applyModelRouting`.

### Unused Exports Removed (Functions)
These functions were exported but had zero references outside their own module:

| File | Functions Removed | Reason |
|------|-------------------|--------|
| `src/orchestration/concurrency.ts` | `setConcurrencyLimit`, `getConcurrencyLimit`, `getActiveCount` | No callers anywhere in codebase |
| `src/orchestration/loop.ts` | `startLoop`, `isLoopComplete`, `setPendingEvaluation` | No callers anywhere in codebase |
| `src/orchestration/returns.ts` | `setReturnChain`, `getReturnChain`, `deleteReturnChain`, `clearReturnStacks`, `setDeferredPromptReturn`, `hasPendingPromptReturn`, `getLastReturnType`, `clearLastReturnType` | Zero external references |
| `src/orchestration/session.ts` | `createSessionStore` | No callers (singleton pattern via `getGlobalSessionStore` used instead) |
| `src/orchestration/` (entire dir) | All 5 files — manager.ts, tools.ts, types.ts, session.ts, concurrency.ts | **v0.25.0:** Entire orchestration layer deleted. delegate_task/get_task_result/cancel_task removed. AGNES delegates via native `task` tool with `subagent_type`. |
| `src/logger.ts` | `debug`, `error` | Never used — only `logger.warn()` and `logger.info()` are called |

### Unused Type Removed
| File | Type Removed | Reason |
|------|-------------|--------|
| `src/agent-hub.ts` | `HubEntry` (union type) | Exported but never referenced externally or internally |
| `src/schema.ts` | `PlanStatus` (type export) | Duplicate of `state.ts`'s `PlanStatus`; the `state.ts` version was the one actually used. `PlanStatusSchema` (Zod schema) kept for validation. |

### Duplicate Code Consolidated
- `src/schema.ts` — Removed `PlanStatus` type (`z.infer<typeof PlanStatusSchema>`) which was never imported by any module. `state.ts` already defines its own `PlanStatus` union type that was used throughout the codebase.

### Fixed `no-unused-vars` ESLint Warnings
- `src/agent-hub.test.ts:128` — Removed `const hub = discoverAgentHub(tmpDir)` (unused variable)
- `src/discovery.test.ts:33` — Removed dead `runDiscovery()` function (never called)
- `src/integration.test.ts:361` — Removed `const tmp = createTempProject()` (unused variable; test didn't need a temp project)
- `src/orchestration/message-transform.ts:133` — Changed `[_sid, loopState]` to `[, loopState]` (unused destructured variable)
- `eslint.config.js` — Added `varsIgnorePattern: "^_"` to `no-unused-vars` rule to properly ignore underscore-prefixed destructured variables

### Impact
- Files deleted: 1
- Lines of code removed: ~80
- Exports removed/converted: 16 functions + 2 types
- ESLint warnings eliminated: 6

## [2026-06-09] Refactor-Clean + Auto-Delegation Bugfixes

### Unused Exports Made Private (23 exports → internal)
All identified by knip + ts-prune. Verified zero external consumers.

| Module | Items un-exported |
|--------|------------------|
| `delegate.ts` | `DELEGATE_BLOCKED_TOOLS`, `MinimalClient`, `DelegateParams`, `SubagentResult`, `cleanupOrphanedSessions` |
| `runtime.ts` | `AGNES_VERSION`, `AsyncError`, `Semaphore` — also **deleted** `clearAsyncErrors()` (zero callers) |
| `planner.ts` | `PlanPhase`, `TaskStatus`, `WaveDef`, `generatePlanID` |
| `reviewer.ts` | `createCompletionGate`, `createFileConflictGate` |
| `scheduler.ts` | `FileConflict`, `topologicalWaveSort`, `detectFileConflicts`, `resolveConflicts` |
| `orchestrator.ts` | `OrchestrationParams`, `TaskItemInput`, `OrchestrationResult` |
| `memory.ts` | `DEFAULT_TTL` |

### Consolidation
- Extracted `src/persist.ts` with shared `createDebouncedFileWriter`, `ensureDir`, `loadJsonFile` utilities
- `MemoryStore` + `TodoStore` now use the shared writer instead of duplicating debounced-save infrastructure

### Critical Auto-Delegation Bugfixes

**BUG 1+2 — `buildDelegationPrompt` lacked completion protocol (root cause)**
- Auto-delegation subagents received no instruction to emit the `§AM{...}` envelope → promise-compliance gate always failed with "Missing canonical completion/result message envelope" → ALL implementation tool calls blocked
- Fix: Added `## Completion Protocol` section to `buildDelegationPrompt` with the exact `§AM{"t":"result",...}` marker, mirroring `orchestrator.ts:buildTaskPrompt()` (the working pattern)

**BUG 3 — Truncation severed the envelope before gate evaluation**
- `runAutoDelegatedTask` truncated output BEFORE calling the gate → if envelope was at the end of a long output, it was replaced with `[...truncated]` → false negative
- Fix: Gate runs on FULL output first, then truncates for return

**BUG 4 — State stored AFTER gate, no after-hook on failure**
- `interceptedCalls.set()` was after `runAutoDelegatedTask()` → if gate threw, state was never stored → after-hook (`handleAutoDelegateAfter`) couldn't map the call → orphaned
- Fix: Store error state in `interceptedCalls` in the catch block, so after-hook always has context

**BUG 6 — `getSubagentResult` claimed non-blocking gate but actually threw**
- Comment said "Non-blocking gate check — log failures, return output regardless" but `createPromiseComplianceGate` with default `large` tier creates a blocking gate → `runGates` throws → output lost
- Fix: Wrapped gate call in try-catch so it truly never blocks result retrieval

### Testing
- TypeScript: `tsc --noEmit` passes clean
- All 69 unit tests passing (0 failures)
- ESLint: 0 errors, 21 pre-existing warnings (no-explicit-any, no-console)
- Bundle: builds clean (0.54 MB, 91 modules)
