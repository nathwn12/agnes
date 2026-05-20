---
# ─── Required Core ──────────────────────────────────────────────────
name: ""
# One-sentence description of what this skill accomplishes.
description: ""

# ─── Required Classification ────────────────────────────────────────
# Phase indicates where in the workflow this skill operates.
# Standard values: SETUP, THINK, RESEARCH, PLAN, DESIGN, BUILD, TEST,
#   VERIFY, REVIEW, DEBUG, SHIP, REFLECT, META.
# Compound values (e.g. "RESEARCH / DESIGN") are allowed.
phase: ""

# ─── NEW: Persona ──────────────────────────────────────────────────
# The expertise, role, and specialization the skill embodies.
# Format: "<seniority-level> <role> specializing in <domain>"
# Examples:
#   persona: "senior software architect specializing in modular design"
#   persona: "expert debugger with deep knowledge of async systems and
#     distributed tracing"
#   persona: "junior developer learning codebase conventions"
persona: ""

# ─── NEW: Tools ─────────────────────────────────────────────────────
# Tools this skill requires to function. List only what it actually uses.
# Standard values: read, write, edit, bash, glob, grep, task, webfetch,
#   skill, question, todowrite
tools: []
# ────────────────────────────────────────────────────────────────────
---

## Use When

<!--
  Task specification — the exact conditions that trigger this skill.
  Be specific and measurable. Answer: what request or situation should
  invoke this skill? Include both primary and secondary use cases.

  Bad: "When you need to understand code."
  Good: "When exploring an unfamiliar codebase before planning,
    researching dependency compatibility, or investigating a bug's
    first phase."

  Also include: "When NOT to use" at the end as a separate section.
-->

## Core Concept

<!--
  One-paragraph description of what this skill does and why it exists.
  This is the elevator pitch. If someone reads only this section, they
  should know whether to invoke the skill and what outcome to expect.
-->

## Precise Vocabulary

<!--
  Domain-specific terms this skill introduces or relies on.
  Use a table format: Term | Definition.
  Only include if the skill has specialized vocabulary. Omit or mark
  N/A if the skill uses only plain language.

  Example:
  | Term | Definition |
  |------|------------|
  | Seam | A place where you can change behavior without changing the module |
-->

## Context Requirements

<!--
  What context does this skill need to function? Be explicit:
  - Files it must read first (CONTEXT.md, ADRs, AGENTS.md, etc.)
  - Variables or inputs expected from the caller
  - Preconditions that must be satisfied before invocation
  - Dependencies on other skill outputs

  Think of this as the skill's "import signature" — what must be
  available before it can execute.
-->

## Workflow

<!--
  Step-by-step instructions. Numbered steps preferred. Each step should
  be a concrete action, not a philosophy.
  - Use subsections for branching paths or modes
  - Include decision points with explicit criteria
  - Reference Precise Vocabulary terms where applicable
  - Reference tools by name where a specific tool is needed

  These instructions are read by an AI agent — be specific enough that
  no interpretation is needed.
-->

## Tool Requirements

<!--
  Map each tool from the frontmatter `tools` field to how it's used
  in this skill's workflow. Explain the purpose, not just the name.

  Example:
  | Tool | Purpose |
  |------|---------|
  | read | Read CONTEXT.md and ADRs before starting |
  | grep | Search codebase for relevant patterns |
  | task | Delegate parallel exploration sub-agents |

  If tools is empty, state: "No special tooling required."
-->

## Output

<!--
  What does this skill produce? Be precise about format and structure.
  - If it writes a file: specify path pattern and format
  - If it returns structured data: provide a template
  - If it modifies existing files: describe the modification
  - If it routes to another skill: specify routing criteria

  Include a template or example if the output format is non-trivial.
  Think of this as the skill's return type — it must be predictable
  enough for downstream skills to consume.
-->

## Quality Criteria

<!--
  How to verify the skill's output is correct and complete.
  A checklist is preferred. Each criterion should be testable.

  Include:
  - Validation steps the skill should perform before completing
  - Error conditions and how to handle them
  - Common failure modes and recovery actions
  - Hard gates — conditions that MUST be met before proceeding
  - Context-budget discipline: did we use the cheapest sufficient path?

  Example:
  - [ ] All referenced files and functions exist
  - [ ] Output follows the specified format
  - [ ] User has approved the result before handoff
  - [ ] No placeholder text or TODOs remain
  - [ ] Used shallow-first approach before deep reads
  - [ ] Output is compact — no preamble, no postamble, no commentary

  Note: Scarcity applies here — default to compact outputs,
  prefer higher-leverage tools, and carry only active-wave context.
-->

## When NOT to Use

<!--
  Anti-patterns and false-positive scenarios where this skill seems
  relevant but isn't. This prevents the 1% Rule from triggering
  incorrect invocations.

  Examples:
  - Do not use when the codebase is already well-understood
  - Do not use when the task is purely implementation
  - Do not use when a simpler skill is sufficient

  Each entry should have: condition + reason + recommended alternative.
-->
