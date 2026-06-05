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

### Testing
- TypeScript: `tsc --noEmit` passes clean
- All 434 unit tests passing (0 failures)
- ESLint: 0 errors, 41 pre-existing warnings (no-explicit-any, prefer-optional-chain)
