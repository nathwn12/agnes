---
name: ag-brandkit
description: Visual design and brand identity — generates design systems, brand guidelines, logo concepts, UI mockups, and image assets
---

## Phase: DESIGN

Use when: starting a new project with no design system, redesigning existing UI, needing visual assets for marketing or docs, before ag-planner if design direction affects architecture.

## Modes

### 1. Brand System Design

Create a complete design system:

**Logo Concepting and Exploration:**
- Generate multiple logo concepts with different directions
- Symbolic meaning aligned with brand values
- Consider: monogram, icon, wordmark, combination mark

**Color Palette:**
- Primary, secondary, accent colors
- Light and dark modes
- Semantic colors (success, warning, error, info)
- Ensure WCAG 2.1 AA contrast ratios

**Typography:**
- Heading font (display/editorial)
- Body font (reading/UI)
- Monospace font (code/data)
- Type scale: 6-8 sizes with defined usage

**Spacing System:**
- 4px or 8px base unit
- Defined spacing scale (xs, sm, md, lg, xl, xxl)
- Component padding and margin guidelines

**Output:** `DESIGN.md` as source of truth at project root.

### 2. Design Exploration

Generate and iterate on visual variants:
- Use design-shotgun approach: generate multiple variants
- Create a comparison board for structured feedback
- Iterate based on user preferences
- Each iteration refines color, typography, layout, and imagery

### 3. UI/Image Generation

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

**Premium Mockups:**
- Editorial quality
- Minimalist, cinematic, or dark-tech aesthetic
- Art-directed imagery with intentional composition

## Design Principles

- **Minimalist**: Clean, intentional, no decoration without purpose
- **Consistent**: Single system, no ad-hoc decisions
- **Accessible**: WCAG AA minimum, AAA preferred
- **Scalable**: Works at every breakpoint
- **On-brand**: Every element reinforces the brand

## Output Files

- `DESIGN.md` — Design system source of truth (always)
- `docs/design/mockups/` — Generated mockup images
- `docs/design/brand/` — Logo assets, brand guidelines
- Color and font preview pages as HTML if needed
