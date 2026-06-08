# AGNES — OpenCode Plugin (v0.36.0)

Orchestrator plugin: decomposes work, delegates to subagents, synthesizes results. Never implements in the orchestrator session.

## Commands

| Command | What |
|---------|------|
| `bun run bundle` | Build plugin → `.opencode/plugins/agnes.js` |
| `bun run bundle:watch` | Watch mode rebuild |
| `bun run lint` | ESLint on src/ (ESLint 10 + @typescript-eslint) |
| `bun run typecheck` | `tsc --noEmit` (strict, ES2022, NodeNext) |
| `bun test` | Run all tests (Bun test runner) |
| `bun run worktree:sync` | Sync `.worktree/agnes-live` to current HEAD + dirty changes and rebuild bundle |
| `bun run worktree:watch` | Keep `.worktree/agnes-live` synced as source `HEAD`/status changes |
| `bun run release` | Publish — tags, pushes, creates GH release. Dry-run without `--go` |
| `bun run release:dry` | Dry run — shows what release would do |

CI order: `lint → typecheck → test → bundle`

## Architecture

| Path | Role |
|------|------|
| `src/plugin.ts` | Entry. Registers `agnes_delegate`/`agnes_get_result` tools, hooks, commands, skills path |
| `src/bootstrap.ts` | Injects Constitution preamble (cache-stable ~750 chars) + SOUL.md. Tier-aware (small/medium/large) |
| `src/delegate.ts` | Subagent delegation: `delegateBlocking` (sync, 3× retry), `delegateAsync` (fire-and-forget), `getSubagentResult` (poll). Persistent task ref store at `.agnes/task-refs.json` |
| `src/runtime.ts` | Model-tier detection (DeepSeek → always large), concurrency (3/5/10), result truncation (2K/4K/8K chars), YOLO mode, Semaphore |
| `src/protocol.ts` | `<agnes:message>` protocol — compact `§AM{...}` format with key-shortening + legacy HTML comment parsing |
| `src/schema.ts` | Type definitions + validation for 5 message types (task/result/error/status/completion) |
| `src/verification.ts` | Promise Compliance Gate — non-blocking check for completion envelope in output |
| `src/discovery.ts` | 3-layer command scanning: bundled → `~/.config/opencode/commands/` → `.opencode/commands/`, deduped by name |
| `src/plugin-support.ts` | Project profile detection (lang, package manager from lockfiles) |
| `src/logger.ts` | Stderr logger — **silent by default**, enable with `AGNES_DEBUG=1` |

## Key Details

- **Zero runtime deps.** `@opencode-ai/plugin` ^1.15.x is dev-only. yaml + zod bundled inline.
- **Lockfile:** `bun.lock`. Never `package-lock.json`.
- **Build target:** Bun (`--target bun`). Single-file bundle.
- **Bootstrap injection:** Via `experimental.chat.messages.transform` (injects into first user message). Also re-injected on session compaction. Skips when bootstrap already present or when `agent` type part detected (subagent-directed).
- **Tools:** Use `agnes_delegate` / `agnes_get_result`. Built-in `delegate_task` / `get_task_result` are deprecated (description patched in `tool.definition` hook).
- **Delegation:** Creates child sessions via `client.session.create`. Blocking: awaits prompt result. Async: fire-and-forget, returns session ID for polling.
- **Retry:** 3 attempts, exponential backoff (1s, 3s, 9s). 120s subagent timeout. 10min orphan cleanup.
- **YOLO mode:** Activated by `--yolo`, `--auto`, `/yolo` in first user message. Skips question gates, max parallelism.
- **Model tier detection:** `AGNES_MODEL_TIER` env var takes priority. DeepSeek/OpenCode models → always large. Otherwise: param-based (≤13B small, ≤60B medium, else large).
- **Protocol format:** Compact `§AM{"t":"result","tid":"task-000","s":"DONE","c":"..."}` with single-char key aliases. Backward-compatible with legacy `<!-- <agnes:message>...</agnes:message> -->`.
- **14 commands** bundled in `.opencode/commands/`. **9 skills** in `.opencode/skills/`. Skills auto-discovered via config hook.
- **14 commands:** /plan /build-fix /code-review /tdd /verify /checkpoint /learn /security /e2e /update-docs /refactor-clean /test-coverage /update-codemaps /yolo

## Testing

- Bun test runner, `*.test.ts` beside source. Import pattern:
  `import { describe, expect, test, beforeEach } from 'bun:test';`
- Mock client pattern in `delegate.test.ts` wraps `client.session.{create,get,messages,prompt}` with in-memory store + simulated async responses via `setTimeout`.
- `clearTaskRefs()` called in each `beforeEach` to isolate task-ref state.
- No integration test prerequisites. No fixtures. No snapshot workflows.

## Isolated Worktree

- Use `bun run worktree:sync` before live OpenCode testing.
- Use `bun run worktree:watch` when iterating and repeatedly live-testing from `.worktree/agnes-live`.
- The sync script creates/reuses `.worktree/agnes-live` as a detached Git worktree at current `HEAD`.
- It hard-resets and cleans only the isolated target, then applies the source repo's combined tracked diff from `HEAD` plus untracked non-ignored files.
- It rebuilds `.opencode/plugins/agnes.js` inside the target unless called with `-NoBuild`.
- The watch script runs an initial sync, then polls `HEAD` and `git status --porcelain` every 2 seconds and re-syncs on changes.
- For strict live isolation, run OpenCode from `.worktree/agnes-live` with `HOME`, `USERPROFILE`, and `OPENCODE_CONFIG_DIR` pointed inside that worktree.

## Conventions

- **Chunking (mandatory):** Exploration split by folder/file-group (min 5 files). One edit per subagent. Sequence across import boundaries. Cross-cutting grep → one subagent.
- **Question gate (default):** Pause on 3+ files changed, architecture decisions, new deps. Skip on single-file fixes, typos, config tweaks. Present options with recommendation.
- **SOUL.md:** Keep in sync with bootstrap strings. Static Constitution preamble is the DeepSeek cache-stable prefix (~750 chars). Regulations section is editable operational detail.

## Release Checklist

```pwsh
bun run bundle
Remove-Item -Recurse -Force .agnes
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\opencode\packages\agnes@git+https_*"
# Restart OpenCode
```

## Generated Files (do not hand-edit)

- `.opencode/plugins/agnes.js` (build output)
- `.opencode/plans/`
- `.opencode/INSTALL.md`
- `.opencode/index.json`
- `.agnes/`
- `node_modules/`
- `.worktree/`
