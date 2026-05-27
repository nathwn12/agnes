---
id: brandkit
name: brandkit
description: 'Starting a new project with no design system, redesigning existing UI, needing visual assets for marketing or docs, before planner if design direction affects architecture.'
phase: "DESIGN"
use_when: "Starting a new project with no design system, redesigning existing UI, needing visual assets for marketing or docs, before planner if design direction affects architecture."
version: 1.2
---

# Brand Kit

**Tradeoff:** Rich brand identity costs design time upfront but prevents costly course corrections and inconsistent UI later.

## Core Concept

Complete visual identity system — logo, color, typography, spacing, motion, UI mockups. Every element intentional, consistent, accessible, scalable, on-brand. Single source of truth: every screen, component, interaction derives from it.

**Posture:** Design consultant, not form wizard. Propose coherent system, explain rationale, invite adjustment. One question at a time. Present full design for approval before implementation work.

## Precise Vocabulary

- **Design System**: Complete set of visual standards and components defining brand look/feel
- **Logo Concepting**: Generating logo directions — monogram, icon, wordmark, combination mark — aligned to brand values
- **Color Palette**: Primary/secondary/accent colors; light/dark modes; semantic colors (success, warning, error, info); WCAG 2.1 AA compliant
- **Typography**: Heading font (display/editorial), body font (reading/UI), monospace font (code/data), 6-8 size type scale with usage rules
- **Spacing System**: 4px or 8px base unit, scale (xs-sm-md-lg-xl-xxl), padding/margin guidelines
- **Design-Shotgun**: Generate multiple visual variants simultaneously for comparison and structured feedback
- **Taste Profile**: Persistent record of approved/rejected design decisions across sessions
- **Memorable Thing**: The one thing user should remember — every design decision serves this

## Context Requirements

- Project name and domain
- Brand values and positioning
- Target audience
- Existing brand assets (if any)
- Design constraints or preferences
- Access to DESIGN.md if exists (update, not overwrite)

## Workflow

### Phase 0: Product Context

One question covering everything. Pre-fill from codebase. Confirm: product, audience, project type (web app/dashboard/marketing/editorial/internal tool). Ask the memorable thing: "What's the one thing you want someone to remember after first seeing this?"

→ verify: product, audience, type, and memorable thing captured

**Output:** Product context and memorable thing statement.

### Phase 1: Brand System Design

**Logo Concepting:**
- Generate multiple concepts — monogram, icon, wordmark, combination mark
- Symbolic meaning tied to brand values
→ verify: each logo direction traces to a specific brand value

**Color Palette:**
- Primary, secondary, accent colors
- Light + dark modes
- Semantic colors (success, warning, error, info)
- WCAG 2.1 AA contrast minimum
- Usage rules, not just hex values
→ verify: every proposed text/background pair passes WCAG AA

**Typography:**
- Heading font (display/editorial) with rationale
- Body font (reading/UI) with rationale
- Monospace font (code/data) with rationale
- Type scale: 6-8 sizes with usage context
- Line height + letter-spacing per size
→ verify: font pair works across headings, body text, and UI elements

**Spacing System:**
- 4px or 8px base unit
- Spacing scale (xs-sm-md-lg-xl-xxl)
- Component padding/margin guidelines
- Grid gap standards
→ verify: spacing scale applied consistently to 3+ component types

**Motion & Interaction:**
- Transition durations + easing curves
- Hover, focus, active, loading states
- Micro-interaction patterns
→ verify: interaction states mapped to easing curves

**Output:** DESIGN.md with complete brand system specification.

### Phase 2: Design Exploration (Design-Shotgun)

Generate and iterate visual variants:
- Propose 2-3 distinct creative directions with trade-offs and recommendation
- Each variant: different font family, color palette, layout approach
- Anti-convergence: if two variants feel like siblings, one failed
- Create comparison board for structured feedback
- Iterate on user preferences
- Design for scanning (billboards at 60mph), not reading
→ verify: variants are visually distinct with no sibling feels

**Output:** Selected design direction with comparison artifact.

### Phase 3: UI/Image Generation

**Section-by-Section Mockups:**
- One image per section (hero, features, testimonials, etc.)
- Consistent palette, composition variety
- Varied hero scales: giant, mid, mini minimalist
→ verify: images use approved color palette and typography

**App Screen Concepts:**
- Native mobile/desktop screen designs
- Multi-screen flows showing user journeys
- Device framing
- 44px minimum touch targets
→ verify: touch targets meet 44px minimum

**Premium Mockups:**
- Editorial quality
- Minimalist, cinematic, or dark-tech aesthetic
- Art-directed composition with intentional focal point
→ verify: each mockup has one clear focal point

**Output:** Mockup images in `.agnes/design/mockups/`.

### Phase 4: Taste Memory

Track approved/rejected decisions across sessions. Before generating, check prior taste profile. Bias toward approved, avoid rejected. Confidence decays 5%/week of inactivity.

When request contradicts strong signal: "Your profile strongly prefers minimal. You're asking for playful — proceed as one-off or update profile?"

→ verify: taste profile consulted before generation

**Output:** Updated taste profile.

### Phase 5: Research (Optional)

Web search for competitive landscape. Analyze: fonts, palettes, layout, spacing, aesthetic. Three layers:
- **Layer 1 (tried and true):** Patterns every competitor shares
- **Layer 2 (new and popular):** What's trending
- **Layer 3 (first principles):** Where to deliberately break from norms

If first-principles reveals a genuine insight, name and log it explicitly.
→ verify: each layer has 2+ concrete examples

**Output:** Competitive research synthesis.

## Flow Diagram

```
[P0: Context] → [P1: Brand System] → [P2: Exploration] → [P3: UI Gen] → [Output]
                     ↑ reject             ↑ reject            │
                     └────────────────────┴────────────────────┘
```

P4 (Taste Memory) is cross-cutting — consulted every phase.
P5 (Research) is optional — feeds into P1/P2.

## Tools

| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| Image generation (DALL-E, Midjourney) | 3, 2 | Design specs, approved direction | Mockup images, comparison boards |
| Color palette analysis | 1 | Color proposals | WCAG compliance report |
| Web search | 5 | Domain, competitors | Competitive analysis |
| File read/write | All | Current DESIGN.md + assets | Updated DESIGN.md + new assets |

## Examples

| Request | Approach | Output |
|---------|----------|--------|
| "Design a fintech brand" | P0-1: trust cues → blue palette, serif headings | DESIGN.md, color system |
| "Redesign dashboard UI" | P2: 3 layout variants → user picks → P3 mockups | Mockup images, taste profile |
| "Marketing site visuals" | P3: section-by-section hero images | `.agnes/design/mockups/` |
| "Logo for my startup" | P1: monogram + wordmark → P3: placed on mockups | Logo assets, brand guidelines |

## Output

- `DESIGN.md` — Design system source of truth
- `.agnes/design/mockups/` — Mockup images, one per section
- `.agnes/design/brand/` — Logo assets, brand guidelines
- Color/font preview pages (HTML) if needed
- Taste profile for cross-session design memory

## Quality Criteria

→ verify: every element traces back to the memorable thing
→ verify: clean, intentional, no decoration without purpose
→ verify: single design system, no ad-hoc decisions
→ verify: WCAG AA minimum, AAA preferred
→ verify: works at every breakpoint
→ verify: every element reinforces brand
→ verify: visual hierarchy guides attention; clickable things look clickable
→ verify: no shouting, disorganization, or clutter

## When NOT to Use

- Project has comprehensive design system needing only minor tweaks
- No visual assets or mockups required
- Design direction doesn't affect architecture decisions
- User wants code implementation, not design exploration

## Protocol Shells

```
/protocol {
  intent="Create a visual identity system",
  input={ project="<desc>", vibe="<direction>" },
  process=[ /decompose{assets}, /compare{palettes}, /synthesize{guidelines} ],
  output={ result="<design-system>", assets="<deliverables>" }
}
```

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break brand identity into independent design elements |
| /compare | Evaluate palette and typography alternatives |
| /synthesize | Combine design elements into consistent guidelines |
