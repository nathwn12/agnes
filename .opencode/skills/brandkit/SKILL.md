---
id: brandkit
name: brandkit
description: 'Starting a new project with no design system, redesigning existing UI, needing visual assets for marketing or docs, before planner if design direction affects architecture.'
phase: "DESIGN"
use_when: "Starting a new project with no design system, redesigning existing UI, needing visual assets for marketing or docs, before planner if design direction affects architecture."
version: 1.1
---

## Use When

Starting a new project with no design system, redesigning existing UI, needing visual assets for marketing or docs, before planner if design direction affects architecture.

## Core Concept

Brand Kit is a complete visual identity system encompassing logo design, color palettes, typography, spacing, and UI mockups. Every element is intentional, consistent, accessible, scalable, and on-brand — a single system with no ad-hoc decisions. Treat the design system as source of truth: every screen, every component, every interaction derives from it.

**Posture:** Design consultant, not form wizard. Propose a complete coherent system, explain why it works, and invite the user to adjust. Ask clarifying questions one at a time. Before any implementation work, present the full design and get user approval.

## Precise Vocabulary

- **Design System**: Complete set of visual standards and components defining a brand's look and feel
- **Logo Concepting**: Generating multiple logo directions — monogram, icon, wordmark, combination mark — aligned to brand values
- **Color Palette**: Primary, secondary, accent colors; light/dark modes; semantic colors (success, warning, error, info); WCAG 2.1 AA compliant
- **Typography**: Heading font (display/editorial), body font (reading/UI), monospace font (code/data), with a 6-8 size type scale and defined usage
- **Spacing System**: 4px or 8px base unit with scale (xs, sm, md, lg, xl, xxl) and component padding/margin guidelines
- **Design-Shotgun**: Generating multiple visual variants simultaneously for comparison and structured feedback
- **Taste Profile**: Persistent record of approved and rejected design decisions across sessions
- **Memorable Thing**: The one thing a user should remember after first seeing the product — every design decision serves this

## Context Requirements

- Project name and domain
- Brand values and positioning (if available)
- Target audience
- Existing brand assets (if any)
- Design direction preferences or constraints
- Access to DESIGN.md if it exists (update rather than overwrite)

## Workflow

### Phase 0: Product Context

Ask one question that covers everything. Pre-fill what you can infer from the codebase. Confirm what the product is, who it's for, project type (web app, dashboard, marketing site, editorial, internal tool). Ask the **memorable thing** question: "What's the one thing you want someone to remember after they see this product for the first time?" Write it down — every subsequent design decision serves this.

### Phase 1: Brand System Design

Create the complete design system:

**Logo Concepting and Exploration:**
- Generate multiple logo concepts with different directions
- Symbolic meaning aligned with brand values
- Consider: monogram, icon, wordmark, combination mark

**Color Palette:**
- Primary, secondary, accent colors
- Light and dark modes
- Semantic colors (success, warning, error, info)
- Ensure WCAG 2.1 AA contrast ratios minimum
- Define color usage rules, not just hex values

**Typography:**
- Heading font (display/editorial) with rationale
- Body font (reading/UI) with rationale
- Monospace font (code/data) with rationale
- Type scale: 6-8 sizes with defined usage context
- Line height and letter-spacing per size

**Spacing System:**
- 4px or 8px base unit
- Defined spacing scale (xs, sm, md, lg, xl, xxl)
- Component padding and margin guidelines
- Grid column/row gap standards

**Motion & Interaction:**
- Transition durations and easing curves
- Hover, focus, active, loading states
- Micro-interaction patterns

### Phase 2: Design Exploration (Design-Shotgun)

Generate and iterate on visual variants:
- Propose 2-3 distinct creative directions with trade-offs and your recommendation
- Each variant must use a different font family, color palette, and layout approach
- Use anti-convergence rule: if two variants feel like siblings, one failed
- Create a comparison board for structured feedback
- Iterate based on user preferences
- Apply UX principles: don't make me think, clicks don't matter thinking does, omit then omit again
- Design for scanning (billboards at 60mph), not reading

### Phase 3: UI/Image Generation

Create visual assets:

**Section-by-Section Mockups:**
- One image per section (hero, features, testimonials, etc.)
- Consistent palette across all sections
- Composition variety: not always left-text/right-image
- Varied hero scales: giant, mid, mini minimalist

**App Screen Concepts:**
- Native mobile/desktop screen designs
- Multi-screen flows showing user journeys
- Device framing for presentation
- 44px minimum touch targets for mobile

**Premium Mockups:**
- Editorial quality
- Minimalist, cinematic, or dark-tech aesthetic
- Art-directed imagery with intentional composition

### Phase 4: Taste Memory

Track approved and rejected design decisions across sessions. Before generating new variants, check for prior taste profile. Factor demonstrated preferences into generation — bias toward what the user has approved, avoid what they've rejected. Confidence decays 5% per week of inactivity.

When the current request contradicts a strong persistent signal, flag it: "Your taste profile strongly prefers minimal. You're asking for playful this time — proceed as one-off or update the profile?"

### Phase 5: Research (Optional)

If the user wants competitive research: use web search to find top products in their space. Analyze: fonts actually used, color palettes, layout approach, spacing density, aesthetic direction. Synthesize findings into three layers:
- **Layer 1 (tried and true):** What patterns every product in this category shares
- **Layer 2 (new and popular):** What's trending and emerging
- **Layer 3 (first principles):** Where to deliberately break from category norms

**Eureka check:** If first-principles reasoning reveals a genuine design insight, name it explicitly and log it.

## Tool Requirements

- Image generation (DALL-E, Midjourney, or equivalent)
- Design tooling for mockups, prototypes, and comparison boards
- Color palette analysis for WCAG contrast checking
- Web search for competitive research
- File read/write for DESIGN.md artifacts

## Output

- `DESIGN.md` — Design system source of truth (always)
- `.agnes/design/mockups/` — Generated mockup images, one per section
- `.agnes/design/brand/` — Logo assets, brand guidelines
- Color and font preview pages as HTML if needed
- Taste profile for cross-session design memory

## Quality Criteria

- **Memorable thing serving:** Every element reinforces the one thing the user wants remembered
- **Minimalist**: Clean, intentional, no decoration without purpose
- **Consistent**: Single system, no ad-hoc decisions
- **Accessible**: WCAG AA minimum, AAA preferred
- **Scalable**: Works at every breakpoint
- **On-brand**: Every element reinforces the brand
- **Scan-friendly**: Visual hierarchy guides attention; clickable things look clickable
- **No noise**: Eliminate shouting, disorganization, and clutter

## When NOT to Use

- Project already has a comprehensive design system needing only minor tweaks
- No visual assets or mockups are required
- Design direction does not affect architecture decisions
- User wants code implementation, not design exploration

## Protocol Shells

All brand design follows the protocol shell format:

/protocol {
  intent="Create a visual identity system for a new project",
  input={ project="<description>", vibe="<aesthetic-direction>" },
  process=[ /decompose{assets}, /compare{palettes}, /synthesize{guidelines} ],
  output={ result="<design-system>", assets="<deliverables>" }
}

## Cognitive Tools

| Tool | When |
|------|------|
| /decompose | Break brand identity into independent design elements |
| /compare | Evaluate palette and typography alternatives |
| /synthesize | Combine design elements into consistent guidelines |
