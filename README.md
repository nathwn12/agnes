<h1 align="center">🤖 AGNES — Swarm Orchestrator for OpenCode</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.33.0-blue" alt="version">
  <img src="https://img.shields.io/badge/skills-9-orange" alt="9 skills">
  <img src="https://img.shields.io/badge/build-passing-brightgreen" alt="build">
  <img src="https://img.shields.io/badge/tests-94-brightgreen" alt="tests">
  <img src="https://img.shields.io/badge/OpenCode-plugin-purple" alt="OpenCode plugin">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
</p>

<p align="center">
  <b>Delegate everything. Execute nothing. Watch your subagents ship.</b>
</p>

<p align="center">
  <a href="#-why-agnes">Why</a> ·
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-how-it-works">How It Works</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-delegation">Delegation</a> ·
  <a href="#-commands--skills">Commands & Skills</a> ·
  <a href="#-architecture">Architecture</a> ·
  <a href="#-contributing">Contributing</a>
</p>

---

## 💡 Why AGNES?

Every OpenCode session starts sharp and degrades into a mess of context switching. You prompt, you fix, you re-prompt, you chase side effects. **AGNES replaces that with disciplined swarm orchestration.**

> *"AGNES never works alone. Every task goes to a subagent. You coordinate, route, synthesize results. Subagents execute in parallel, each on an isolated file chunk."* — SOUL.md

```json
// One line to install
{"plugin": ["agnes@git+https://github.com/nathwn12/agnes.git"]}
```

Restart OpenCode. That's it.

---

## 🚀 Quick Start

```bash
# Ask AGNES to explore a module
"explore the auth module for security issues"

# Run a build fix cycle
"/build-fix fix the type errors in src/api.ts"

# Run TDD on a feature
"/tdd implement user registration"
```

---

## ⚙️ How It Works

AGNES is a **plugin** that installs directly into OpenCode's tool system. It injects a bootstrap prompt into every conversation, then routes your request through disciplined subagent delegation:

```
User: "explore the codebase for outdated API patterns"
  └─ AGNES decomposes into chunks
      ├─ explore subagent: src/api/routes.ts
      ├─ explore subagent: src/api/middleware.ts    (parallel)
      └─ explore subagent: src/api/validators.ts   (parallel)
  └─ Synthesizes results into a single report
```

### Chunking (MANDATORY)

- Exploration is always chunked by folder or file group (minimum 5 files per chunk)
- All chunks fire in parallel (respects model-tier max concurrency)
- Cross-cutting searches (grep across the whole tree) use one subagent
- File edits are one-per-subagent, sequenced across import boundaries

### Retry & Timeout

- Transient failures retry with exponential backoff (1s, 3s, 9s)
- Subagents that stall past 120s return TIMEOUT — retry once with narrower scope, then flag
- Orphaned subagent sessions auto-clean after 10 minutes

---

## ✨ Features

| Feature | Benefit |
|---------|---------|
| **Zero runtime deps** | No npm install tax. Plugin pulls nothing at consumer end. |
| **Parallel by default** | Independent tasks run concurrently. One file, one subagent. |
| **Auto-chunking** | Exploration splits by folder/file-count. Edits respect import deps. |
| **Model-tier adaptive** | Auto-detects model (small/medium/large) — adjusts concurrency and result size. |
| **Feather mode** | Ultra-lightweight mode for small models (9B-35B). No SOUL.md overhead. |
| **Model-aware bootstrap** | Full SOUL.md for large models, trimmed for medium, minimal for small. |
| **YOLO mode** | Skip question gates. Max parallelization. Safety-only interrupts. |
| **14 slash commands** | `/plan`, `/tdd`, `/verify`, `/code-review`, `/yolo`, and more. |
| **Typed protocol** | `<agnes:message>` envelopes with Zod-level validation. |
| **Persistent task refs** | Tracks async subagents across restarts via `.agnes/task-refs.json`. |
| **Gate pipeline** | Promise-compliance gates on subagent output. Non-blocking logging. |

---

## 🧭 Delegation

```
Tool                    Agent        Use
agnes_delegate(bg=false) general     Blocking: write code, research, run bash
agnes_delegate(bg=true)  general     Async: returns task ref, poll with get_result
agnes_delegate(bg=false) explore     Read-only: search, grep, read files (chunked)
agnes_get_result(ref)    —           Poll an async subagent for its result
```

AGNES exposes two custom tools (`agnes_delegate` / `agnes_get_result`) — the built-in `delegate_task` / `get_task_result` are deprecated.

---

## 📦 Commands & Skills

**14 slash commands:** `/plan`, `/build-fix`, `/code-review`, `/tdd`, `/verify`, `/checkpoint`, `/learn`, `/security`, `/e2e`, `/update-docs`, `/refactor-clean`, `/test-coverage`, `/update-codemaps`, `/yolo`

**9 bundled skills:** auto-delegate, auto-verify, brainstorming, code-review, question-gate, quick-investigate, subagent-driven-development, writing-plans, yolo-mode

---

## 🏗️ Architecture

```
opencode session
  │
  └─ AGNES plugin (plugin.ts)
       │
       ├─ Bootstrap prompt (bootstrap.ts)
       │    └─ SOUL.md + model-tier instructions (cached by content hash)
       │
       ├─ Delegation (delegate.ts)
       │    ├─ delegateBlocking — sync subagent call with retry (×3, backoff)
       │    ├─ delegateAsync — fire-and-forget, returns session ref
       │    ├─ getSubagentResult — poll with 120s timeout check
       │    ├─ recordTaskRef/lookupTaskRef — persistent ref store
       │    └─ cleanupOrphanedSessions — 10min TTL sweep
       │
       ├─ Runtime (runtime.ts)
       │    ├─ Model-tier detection (small/medium/large from model ID)
       │    ├─ Concurrency limits (3/5/10 per tier)
       │    ├─ Result truncation (2K/4K/8K chars per tier)
       │    └─ YOLO mode toggle
       │
       ├─ Gates (verification.ts)
       │    └─ Promise Compliance Gate (non-blocking, logs only)
       │
       ├─ Protocol (protocol.ts + schema.ts)
       │    └─ Typed <agnes:message> envelopes (task/result/error/status/completion)
       │
       ├─ Discovery (discovery.ts + discovery-policy.ts)
       │    └─ Scans 3 layers for commands (.md with YAML frontmatter)
       │
       └─ Plugin support (plugin-support.ts)
            └─ Project profile detection (lang, package manager)
```

---

## 🧪 Testing

```bash
bun test        # 94 tests, 0 failures
bun run bundle  # Build to .opencode/plugins/agnes.js
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/name`)
3. Commit changes (`git commit -m 'feat: ...'`)
4. Push (`git push origin feature/name`)
5. Open a Pull Request

---

## 📄 License

MIT. AGNES is free and open source.
