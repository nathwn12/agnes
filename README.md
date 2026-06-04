<h1 align="center">AGNES — Swarm orchestrator for OpenCode</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.20.0-blue" alt="version">
  <img src="https://img.shields.io/badge/skills-22-orange" alt="22 skills">
  <img src="https://img.shields.io/badge/OpenCode-plugin-purple" alt="OpenCode plugin">
</p>

**22 specialized skills. Parallel by default. One line to install.**

```json
{"plugin": ["agnes@git+https://github.com/nathwn12/agnes.git"]}
```

Restart OpenCode. Every task routes to the right specialist subagent automatically.

---

### Why AGNES?

Most AI coding sessions are a mess of context switching — you prompt, you fix, you re-prompt, you pray. AGNES replaces that with a disciplined pipeline:

| Phase | What happens |
|-------|-------------|
| **CLARIFY** | Vague request? clarify sharpens it into a spec. |
| **RESEARCH** | Don't understand the codebase? architect deep-dives. |
| **PLAN** | Spec approved? planner breaks it into steps. |
| **BUILD** | tdd drives implementation test-first. |
| **VERIFY** | verifier runs lint + typecheck + tests. reviewer checks spec compliance. |
| **SHIP** | shipper merges. documenter writes docs. retro captures learnings. |

Every phase has a **gate** — hard evidence must pass before the next phase starts. No skipping, no "trust me, it works."

---

### What makes it different

- **Parallel by default** — independent tasks run concurrently. Subagents work-steal.
- **Promise-driven** — tracks progress via tags, detects struggle, retries with backoff.
- **22 on-demand skills** — debugger, grill-me, brand-designer, triage, write-skill, and more fire when their trigger conditions are met.
- **Model routing** — heavy reasoning to architect models, lightweight to fast ones.

---

### Routing (yep, that's the whole thing)

**Read/search/lookup** → @explore  
**Modify/create/run/delete** → @general  
**Destructive/irreversible** → Ask user first

---

### Quick start

Ask AGNES to `init` a project, or run `bun run init-agnes`. After that, just start asking.

### Full docs

Architecture, pipeline, all 22 skills, state, development, troubleshooting → [`docs/WHITEPAPER.md`](docs/WHITEPAPER.md)
