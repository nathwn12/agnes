---
id: explorer
name: explorer
description: 'Understanding an unfamiliar codebase, researching dependencies before planning, debugging (first phase investigation), needing architecture overview.'
phase: "RESEARCH"
use_when: "Understanding an unfamiliar codebase, researching dependencies before planning, debugging (first phase investigation), needing architecture overview."
version: 1.0
---

## Use When

Understanding an unfamiliar codebase, researching dependencies before planning, debugging (first phase investigation), needing architecture overview.

**Always read-only.** Never modifies files.

## Core Concept

Read-only, systematic investigation of codebases, dependencies, and architectures. The skill produces structured findings reports that map modules, identify patterns, trace data flows, and document interfaces — without ever modifying files. It operates in four modes (Codebase Exploration, Dependency Research, Zoom Out, Parallel Exploration) depending on the investigation depth and breadth needed.

## Precise Vocabulary

| Term | Meaning |
|------|---------|
| Codebase Exploration | Reading file structure, finding patterns, understanding architecture |
| Dependency Research | Investigating unfamiliar libraries — vendor check, source inspection, cross-reference |
| Zoom Out | Going up a layer of abstraction to show the big picture and relationships |
| Parallel Exploration | Dispatching independent investigations across multiple subagents simultaneously |
| Module | A discrete unit of code (file, directory, package) with a defined responsibility |
| Interface | The public API surface of a module (exports, types, function signatures) |
| Data Flow | The path data takes through the system from source to transformation to sink |
| Entry Point | Top-level invocation points (main, handlers, routes, event listeners) |
| Caller | Code that depends on or invokes a given module or function |
| Findings Report | Structured markdown document synthesizing exploration results |

### @explorer Discipline

The explorer is a read-only research role. It follows a strict shallow-first protocol:

1. **Glob first** — find relevant files by pattern before reading anything
2. **Grep second** — search for specific patterns rather than reading entire files
3. **Read last** — read only the specific files and sections needed to answer the question
4. **Stop when answered** — do not explore beyond what's needed to confirm the answer

Rules:
- NEVER edit files. Explorer is read-only by definition.
- NEVER run bash commands that produce side effects (builds, installs, modifications).
- Batch independent searches and reads when possible.
- Ignore noisy directories (node_modules, dist, build, .git, cache) unless explicitly asked.
- Summarize findings with exact file:line references.
- Return only what was asked. No preamble, no postamble, no suggestions.

## Context Requirements

- Project file structure and directory layout
- Domain glossary vocabulary (check `CONTEXT.md`, `AGENTS.md`)
- Configuration files (package.json, tsconfig, etc.)
- Existing test patterns and conventions
- When doing dependency research: access to vendored or cached dependency source

## Workflow

### 0. Scarcity: Shallow-first Exploration

Before any deep read, start with the cheapest sufficient path:
- **glob** the directory structure to understand layout
- **grep** for specific patterns, terms, or interfaces
- **read** only files that matched — start with signatures, definitions, and imports
- **deepen** only when unresolved questions remain

This is the default. Full-file reads are the exception, not the rule.

### 1. Codebase Exploration

Read file structure, find patterns, understand architecture:
- Use project's domain glossary vocabulary (check CONTEXT.md, AGENTS.md)
- Map relevant modules and their relationships
- Identify key interfaces, data flows, and entry points
- Read configuration files (package.json, tsconfig, etc.)
- Examine test patterns and conventions
- Apply shallow-first: glob → grep → selective read → deepen only if needed

### 2. Dependency Research

When a library or dependency is unfamiliar:
- Check if the dependency is already vendored or cached locally
- Inspect the dependency's source for usage patterns
- Cross-reference API usage against local code
- Identify version constraints and compatibility issues

### 3. Zoom Out

Go up a layer of abstraction to provide the big picture:
- "This module is part of the X system, which connects to Y and Z"
- "There are 3 callers of this function: A, B, and C"
- "The data flows from source → transform → sink with these transformations"

Produce a map of all relevant modules and their callers.

### 4. Parallel Exploration

When 3+ independent areas need investigation:
- Identify discrete, non-overlapping domains
- Dispatch one subagent per domain via `ag_delegate`
- Each subagent receives: domain name, relevant file paths, specific questions
- Each returns structured findings
- Synthesize results into a unified report

## Tool Requirements

| Tool | Usage |
|------|-------|
| `read` | Exploring file structure and content |
| `grep` | Finding patterns, usages, and cross-references |
| `glob` | Locating files by pattern |
| `task` | Running parallel exploration of independent domains |
| `ag_delegate` | Dispatching subagents per domain during parallel exploration |

## Output

```markdown
## Exploration Report

### Overview
[One-paragraph summary of findings]

### Key Findings
1. **[Module name]** — [what it does, key interfaces]
2. **[Pattern found]** — [where and how it's used]
3. **[Architecture note]** — [relationships, data flow]

### Files Examined
- `path/to/file.ts` — [relevance]
- `path/to/file2.ts` — [relevance]

### Recommendations
[If this was pre-planning, what should the plan consider?]
```

## Quality Criteria

- All findings are backed by file evidence (no speculation)
- Every module mapped includes its key interfaces and relationships
- Clear distinction between observed facts and interpreted recommendations
- Report uses the canonical Findings Report format
- Files examined section lists every file consulted
- No files were modified during exploration
- Parallel explorations are synthesized into a single coherent report
- Shallow-first path was used: glob → grep → selective read → deepen only on unresolved questions
- No unnecessary full-file reads — every read was justified by a search hit or explicit need

## When NOT to Use

- Do not use when the codebase is already well-understood (proceed to planner)
- Do not use when the task is purely implementation (use builder)
- Do not modify any files
