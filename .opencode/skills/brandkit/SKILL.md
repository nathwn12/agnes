---
id: brandkit
phase: "DESIGN"
use_when: "Starting a new project with no design system, redesigning existing UI, needing visual assets for marketing or docs, before planner if design direction affects architecture."
version: 1.0
---

## Use When

Starting a new project with no design system, redesigning existing UI, needing visual assets for marketing or docs, before planner if design direction affects architecture.

## Core Concept

Brand Kit is a complete visual identity system encompassing logo design, color palettes, typography, spacing, and UI mockups. Every element is intentional, consistent, accessible, scalable, and on-brand — a single system with no ad-hoc decisions.

## Precise Vocabulary

- **Design System**: Complete set of visual standards and components defining a brand's look and feel
- **Logo Concepting**: Generating multiple logo directions — monogram, icon, wordmark, combination mark — aligned to brand values
- **Color Palette**: Primary, secondary, accent colors; light/dark modes; semantic colors (success, warning, error, info); WCAG 2.1 AA compliant
- **Typography**: Heading font (display/editorial), body font (reading/UI), monospace font (code/data), with a 6-8 size type scale and defined usage
- **Spacing System**: 4px or 8px base unit with scale (xs, sm, md, lg, xl, xxl) and component padding/margin guidelines
- **Design-Shotgun**: Generating multiple visual variants simultaneously for comparison and structured feedback
- **Section-by-Section Mockups**: One image per UI section with consistent palette and composition variety
- **WCAG 2.1 AA**: Minimum contrast ratio standard for web accessibility

## Context Requirements

- Project name and domain
- Brand values and positioning (if available)
- Target audience
- Existing brand assets (if any)
- Design direction preferences or constraints

## Workflow

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

## Tool Requirements

- Image generation (DALL-E, Midjourney, or equivalent)
- Design tooling for mockups and prototypes
- Color palette analysis for WCAG contrast checking

## Output

- `DESIGN.md` — Design system source of truth (always)
- `.agnes/design/mockups/` — Generated mockup images
- `.agnes/design/brand/` — Logo assets, brand guidelines
- Color and font preview pages as HTML if needed

## Quality Criteria

- **Minimalist**: Clean, intentional, no decoration without purpose
- **Consistent**: Single system, no ad-hoc decisions
- **Accessible**: WCAG AA minimum, AAA preferred
- **Scalable**: Works at every breakpoint
- **On-brand**: Every element reinforces the brand

## When NOT to Use

- Project already has a comprehensive design system needing only minor tweaks
- No visual assets or mockups are required
- Design direction does not affect architecture decisions
