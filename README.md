<h1 align="center">AGNES — Swarm Orchestrator for OpenCode</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.39.1-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
</p>

<p align="center">
  <b>Delegate everything. Execute nothing. Watch your subagents ship.</b>
</p>

<p align="center">
  <a href="#why-agnes">Why</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#features">Features</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#testing">Testing</a>
</p>

---

## Why AGNES

Every OpenCode session starts sharp and degrades into context-switching hell. Prompt. Fix. Re-prompt. Chase side effects. AGNES replaces that with disciplined swarm orchestration: it decomposes work, delegates to parallel subagents, and synthesizes the results. You coordinate. Subagents execute.

```json
{"plugin": ["agnes@git+https://github.com/nathwn12/agnes.git"]}
```

Add that to your `opencode.jsonc`, restart OpenCode, and you're done.

---

## Quick Start

```
"explore the auth module for security issues"
/tdd implement user registration
/build-fix fix the type errors in src/api.ts"
/plan add payment support
```

Four entry points. AGNES handles the rest — chunking, delegating, retrying, synthesizing.

---

## How It Works

AGNES is a plugin that installs into OpenCode's tool system. It injects a bootstrap prompt (Constitution preamble + SOUL.md) into every conversation, then routes requests through subagent delegation:

**Chunking.** Exploration splits by folder or file group (minimum 5 files per chunk). All chunks fire in parallel, respecting model-tier concurrency. Cross-cutting searches (grep across the whole tree) use one subagent. File edits are one per subagent, sequenced across import boundaries.

**Retry & timeout.** Transient failures retry with exponential backoff — 1s, 3s, 9s. Subagents that stall past 120s return TIMEOUT. Per SOUL.md convention, retry once with narrower scope, then flag as UNAVAILABLE. Orphaned sessions auto-clean after 10 minutes.

**Model-tier adaptive.** Auto-detects model size (small/medium/large) and adjusts concurrency (3/5/10) and result truncation (2K/4K/8K chars). DeepSeek and OpenCode models always run as large. Override with `AGNES_MODEL_TIER`.

**YOLO mode.** Skip all question gates. Maximum parallelization. Safety-only interrupts. Activate with `--yolo`, `--auto`, or `/yolo` in the first message.

---

## Features

| Feature | Why it matters |
|---------|---------------|
| **Bundled** | Single `.opencode/plugins/agnes.js` — no consumer install needed. |
| **Parallel by default** | Independent tasks run concurrently. One file, one subagent. |
| **Auto-chunking** | Exploration splits by folder. Edits respect import dependencies. |
| **Bootstrap caching** | Constitution preamble is DeepSeek cache-stable (~800 chars, stat-cached by size + mtime). |
| **14 slash commands** | `/plan`, `/tdd`, `/verify`, `/code-review`, `/security`, `/yolo`, and more. |
| **9 bundled skills** | Auto-delegate, auto-verify, brainstorming, code-review, yolo-mode, and more. |
| **Typed protocol** | Compact `§AM{...}` message format with strict type validation. Short key aliases for token efficiency. |
| **Persistent task refs** | Async subagents survive restarts via `.agnes/task-refs.json`. |
| **Gate pipeline** | Promise-compliance gates on subagent output. Non-blocking, logs-only. |
| **2 delegation tools** | `agnes_delegate` (sync/async) + `agnes_get_result` (poll). Built-in `delegate_task` deprecated. |

---

## Architecture

AGNES has the following modules, each with a single responsibility:

- **Bootstrap** — Injects Constitution preamble + SOUL.md at session start. Tier-aware: full for large models, trimmed for medium, minimal for small. Re-injected on compaction.
- **Delegation** — Sync subagent calls with 3× retry and exponential backoff. Async fire-and-forget with persistent task ref store. 10-minute orphan cleanup sweep.
- **Runtime** — Model-tier detection, concurrency limits, result truncation, YOLO mode toggle.
- **Verification** — Promise Compliance Gate. Non-blocking check for completion envelope in subagent output.
- **Protocol** — Compact message format. Key-shortened JSON (`t`→`type`, `tid`→`taskId`) for token efficiency. Legacy HTML comment parsing for backward compatibility.
- **Discovery** — 3-layer command scanning: bundled `.opencode/commands/` → `~/.config/opencode/commands/` → project `.opencode/commands/`. Skills auto-discovered from `.opencode/skills/`.
- **Plugin Support** — Project profile detection: language, package manager from lockfiles.
- **Orchestrator** — Plan decomposition (auto or from JSON), wave scheduling, parallel subagent dispatch, review gates, retry with exponential backoff.
- **Planner** — Plan CRUD (create/save/load/update), plan GC, task ID generation.
- **Scheduler** — Topological wave sorting, file-conflict detection, parallel-cap execution scheduling.
- **Reviewer** — Review gates: task completion, file conflicts, envelope presence, acceptance criteria.
- **Memory** — Persistent key-value store with TTL-based expiry, categories (user/project/pattern/pref).
- **Todo** — Task checklist manager with status tracking (pending/in_progress/completed/blocked), auto-prune.
- **Status** — Aggregated diagnostics: version, tier, concurrency, commands, sessions, memory, gate stats, async errors.
- **Compressor** — Session summary getter/setter for compaction context injection.
- **Persist** — Debounced file writer, directory assurance, JSON file loader.

---

## Testing

```bash
bun test        # 95 tests, 0 failures
bun run bundle  # Build to .opencode/plugins/agnes.js
```

---

## License

MIT. AGNES is free and open source.
