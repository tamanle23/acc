---
name: ui-ux-design-system
description: Design, audit, and build accessible, responsive user interfaces and design systems using CSS custom properties, semantic HTML, and multi-state component patterns. Use when the user asks for wireframing, design tokens, responsive layouts, Tailwind styling, WCAG accessibility audits, or component states.
---
# UI/UX Design System

Design and implement accessible, robust user interfaces and design systems that prioritize semantic markup, scalable design tokens, and comprehensive state handling.

## When to Use

- Designing or refactoring component libraries, design systems, or Tailwind CSS theme architectures
- Implementing component states (Default, Loading, Empty, Error, Disabled/Read-only) for robust UX
- Conducting accessibility (a11y) audits for WCAG 2.1 AA compliance (contrast, ARIA roles, keyboard focus)
- Structuring responsive layouts across mobile, tablet, and desktop breakpoints

## Steps

### 1. Establish Token & Design Constraints

Before writing styles, define or inspect design tokens (`tailwind.config.*`, CSS custom properties in `:root`):

- **Color Hierarchy:** Use semantic tokens (`bg-background`, `text-foreground`, `primary`, `muted`, `destructive`) rather than arbitrary hardcoded hex values.
- **Typography & Spacing Scales:** Maintain a consistent modular scale and spacing grid (multiples of 4px/8px).

### 2. Mandate the 5-State Component Matrix

Every interactive component or view must gracefully render five distinct states:

1. **Default State:** Standard resting UI with valid props and data.
2. **Loading State:** Skeletons or spinners that reserve layout space to prevent Cumulative Layout Shift (CLS).
3. **Empty State:** Clear illustration or message with a primary call-to-action (CTA) when zero records exist.
4. **Error State:** Inline recovery guidance with clear validation messages or retry actions.
5. **Disabled / Read-Only State:** Visually distinct, non-interactive presentation with appropriate `aria-disabled` attributes.

### 3. Enforce Accessibility (a11y) Standards

- **Semantic HTML:** Use native elements (`<button>`, `<dialog>`, `<nav>`, `<main>`, `<article>`) instead of clickable `<div>` elements.
- **Keyboard Navigation:** Ensure all interactive elements are focusable (`tabindex="0"` or native) with visible focus rings (`focus-visible:ring-2`).
- **Screen Readers:** Provide explicit `aria-label`, `aria-describedby`, or `aria-expanded` attributes on icon-only controls and dynamic panels.
- **Color Contrast:** Verify text meets WCAG AA contrast ratios (at least 4.5:1 for normal text, 3:1 for large text).

### 4. Responsive & Motion Polish

- Design mobile-first, validating layouts at `375px` (mobile), `768px` (tablet), and `1280px+` (desktop).
- Respect `prefers-reduced-motion` for all transitions and animations.
