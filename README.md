<h1 align="center">🤖 AGNES — Swarm Orchestrator for OpenCode</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.27.0-blue" alt="version">
  <img src="https://img.shields.io/badge/skills-22-orange" alt="22 skills">
  <img src="https://img.shields.io/badge/build-passing-brightgreen" alt="build">
  <img src="https://img.shields.io/badge/tests-423-brightgreen" alt="tests">
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
  <a href="#-routing">Routing</a> ·
  <a href="#-skills">Skills</a> ·
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
# Ask AGNES to init a project
"initialize this project"

# Or run the setup command
bun run init-agnes

# Then just start asking — AGNES routes to the right specialist automatically
"explore the auth module for security issues"
"add user registration with email verification"
"review the last PR"
```

---

## ⚙️ How It Works

AGNES is a **plugin** that installs directly into OpenCode's tool system. It injects a bootstrap prompt into every conversation, then routes your request through a gated pipeline:

| Phase | What Happens |
|-------|-------------|
| **CLARIFY** | Vague request? Sharpens it into a spec. |
| **RESEARCH** | Unknown codebase? Deep-dive analysis. |
| **PLAN** | Spec approved? Breaks it into parallel work items. |
| **BUILD** | Delegates implementation to subagents — one file, one agent. |
| **VERIFY** | Runs gates: lint, typecheck, tests, spec compliance. |
| **SHIP** | If clean: merge, document, retro. |

Every phase has a **blocking gate** — hard evidence must pass before the next phase starts. No skipping, no "trust me, it works."

```
User: "add user registration"
  └─ CLARIFY → spec captured
      └─ RESEARCH → existing auth patterns found
          └─ PLAN → 3 files identified, parallelized
              └─ BUILD → subagent-1: auth.ts, subagent-2: routes.ts, subagent-3: tests/
                  └─ VERIFY → all gates pass ✓
                      └─ SHIP → merged
```

---

## ✨ Features

| Feature | Benefit |
|---------|---------|
| **Parallel by default** | Independent tasks run concurrently. One file, one subagent. Zero shared state. |
| **Promise-driven protocol** | Subagents communicate via typed `<agnes:message>` envelopes. No fragile parsing. |
| **Gate pipeline** | Every phase validates before proceeding. Blocking gates stop bad states fast. |
| **Struggle detection** | Tracks no-progress iterations, short iterations, repeated errors. Escalates after 3. |
| **Retry budgets** | Per-class retry budgets (`retryable`, `needs_context`, `blocked`, `terminal`). Smart backoff. |
| **Plan state machine** | `draft → approved → in_progress → done`. Locked transitions prevent illegal states. |
| **Compaction policy** | Monitors token usage, nudges at soft limit, alerts at hard limit. Code-density-aware estimation. |
| **SessionStore** | All task state is instance-isolated. Testable, no global leaks. |

---

## 🧭 Routing

```
Read/search/lookup     → @explore (read-only, no bash)
Modify/create/run/delete → @general (write + bash)
Plan/architect        → @plan (read-only)
Verify/test          → @general (bash, no write)
Destructive/irreversible → Ask user first (Ask Once Gate)
```

AGNES delegates via OpenCode's native `task` tool with `subagent_type` — no custom delegation tools needed.

---

## 📦 Bundled Skills (22)

| Skill | Trigger |
|-------|---------|
| `architect` | Architecture decisions, tech stack |
| `brainstorming` | Early ideation, open-ended exploration |
| `brand-designer` | Visual identity, logo concepts |
| `clarify` | Vague requirements, ambiguity |
| `debugger` | Runtime errors, crashes |
| `documenter` | API docs, README updates |
| `grill-me` | Stress-test plans, find blind spots |
| `init` | Project initialization |
| `instinct` | Gut-check, quick judgment |
| `multi-reviewer` | Cross-perspective code review |
| `planner` | Breaking down into work items |
| `prd` | Product requirement documents |
| `process-feedback` | Retrospectives, improvement |
| `prototype` | Quick throwaway experiments |
| `retro` | Post-ship learnings capture |
| `reviewer` | Code review, spec compliance |
| `shipper` | Merge, deploy coordination |
| `tdd` | Test-first implementation |
| `tester` | Test writing, coverage |
| `triage` | Issue classification, prioritization |
| `verifier` | Gate execution, validation |
| `write-skill` | New skill scaffolding |

---

## 🏗️ Architecture

```
opencode session
  │
  └─ AGNES plugin (plugin.ts)
       │
       ├─ Bootstrap prompt (bootstrap.ts)
       │    └─ SOUL.md + plan state + agent routing
       │
       ├─ State layer (state.ts)
       │    └─ Plan index (JSON) + plan files (YAML)
       │         └─ Write-locked, atomic, validated
       │
       ├─ Runtime (runtime.ts)
       │    ├─ Intent classification (clarify/plan/implement/debug/review/test)
       │    ├─ Complexity classification (trivial/complex)
       │    ├─ Planner routing (builtin/full/auto)
       │    └─ Plan gate checking
       │
        ├─ Delegation via native `task` tool with `subagent_type`
        │
       ├─ Gates (verification.ts)
       │    ├─ Promise Compliance Gate
       │    ├─ Plan Exists Gate
       │    └─ Custom gates per pipeline phase
       │
       ├─ Protocol (protocol.ts)
       │    └─ Typed <agnes:message> envelopes (Zod-validated)
       │
       └─ Compaction (compaction.ts)
            └─ Token estimation with code-density heuristics
```

---

## 🧪 Testing

```bash
bun test        # 423 tests, 0 failures
bun run build   # Bundle to .opencode/plugins/agnes.js
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
