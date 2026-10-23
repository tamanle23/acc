---
name: ui-ux-design-principles
description: Design, audit, and build intuitive, accessible user experiences, interfaces, and design systems. Use when designing user flows, wireframes, information architecture, design tokens, component state matrices, WCAG accessibility compliance, or applying core UX heuristics and visual design principles.
---
# UI/UX Design System & Experience Design

A comprehensive guide for designing intuitive, human-centered user experiences (UX) and engineering resilient, accessible user interfaces (UI) and design systems.

## When to Use This Skill

- Planning and auditing user journeys, task flows, wireframes, and information architecture (IA).
- Applying core UX laws and usability heuristics (Nielsen Norman, Fitts's Law, Hick's Law, Gestalt).
- Architecting design systems, design tokens (semantic colors, spacing, typography scales), and component libraries.
- Designing and implementing resilient component states (Default, Hover, Active, Focus, Loading, Empty, Error, Disabled).
- Conducting accessibility (a11y) audits for WCAG 2.1/2.2 AA standards (contrast, focus management, semantic markup).
- Refining microcopy, feedback loops, visual hierarchy, and interaction transitions.

---

## 1. Core UX Laws & Usability Heuristics

Ground every interface decision in proven cognitive principles:

- **Jakob's Law:** Users spend most of their time on other sites. Match established mental models, platform conventions, and standard UI patterns rather than reinventing navigation or basic interactions.
- **Fitts's Law:** The time to acquire a target depends on distance and size. Make primary interactive elements prominent with adequate touch targets (minimum 44x44 CSS px on touch displays) and place frequent actions close to the user's natural resting area.
- **Hick's Law:** Time to make a decision increases with the number and complexity of choices. Minimize choices per screen, break complex processes into progressive steps (progressive disclosure), and spotlight default/recommended options.
- **Miller's Law & Chunking:** Organize complex information into digestible, logical chunks (e.g., grouped form fields, distinct card sections) to avoid overwhelming working memory.
- **Gestalt Principles (Proximity & Common Region):** Group related items using spacing and common boundaries (cards, subtle dividers) to signal relationships without needing heavy visual ornamentation.
- **Visibility of System Status & Error Prevention:** Always provide immediate, unambiguous feedback for user actions. Favor defensive design that prevents errors (disabling conflicting options, inline input validation) over generic error dialogs.

---

## 2. Information Architecture (IA) & Interaction Design

- **Visual Hierarchy & Scanning:** Design for rapid scanning using clear typographic scale (H1 > H2 > H3 > Body > Caption) and layout anchors (F-pattern for text-heavy pages, Z-pattern for landing pages).
- **Progressive Disclosure:** Surface only essential high-level information initially; reveal advanced configurations, secondary filters, or granular details on demand or in contextual drawers/modals.
- **Navigation & Wayfinding:** Maintain predictable wayfinding with breadcrumbs, persistent navigation headers, and active state indicators so users always know: Where am I? Where can I go? How do I return?
- **Frictionless Form UX:**
  - Single-column forms wherever possible to preserve vertical flow.
  - Clear, persistent labels (avoid disappearing placeholders as the only label).
  - Inline validation on blur with specific, recovery-oriented error copy.

---

## 3. Design System Tokens & Foundations

Maintain strict mathematical and semantic consistency across all UI layers:

- **Spacing Grid:** Enforce a consistent 4px/8px modular grid for margins, paddings, and component dimensions (4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px).
- **Typography Scale:** Establish a modular type scale with proportional line-heights (1.2–1.3 for headings, 1.5–1.6 for body copy) to ensure readability across all viewports.
- **Semantic Color Architecture:** Abstain from hardcoding arbitrary hex values in components. Map tokens through semantic layers:
  - *Primitive Tokens:* `blue-500`, `gray-100`, `red-600`
  - *Semantic Tokens:* `bg-surface`, `bg-canvas`, `text-primary`, `text-muted`, `border-subtle`, `action-primary`, `status-destructive`, `status-warning`, `status-success`
  - *Theme Adaptability:* Ensure semantic tokens map cleanly to light and dark modes with compliant contrast across both themes.

---

## 4. The 5+ State Component Matrix

Every interactive component, card, or full-page view must define explicit visual treatments for all operational states:

1. **Default / Resting:** Standard clean state with valid props and baseline data.
2. **Interactive States:** Distinct visual feedback for `:hover`, `:focus-visible`, and `:active`.
3. **Loading State:** Skeleton placeholders or content-preserving shimmer containers that reserve layout space and eliminate Cumulative Layout Shift (CLS).
4. **Empty State:** Helpful empty screens that explain why no items appear, accompanied by a single clear call-to-action (CTA) to create, import, or get started.
5. **Error State:** Human-readable explanations highlighting what went wrong and how to fix or retry, avoiding technical stack traces.
6. **Disabled / Read-Only:** Visually desaturated or subdued presentation with cursor styling (`cursor-not-allowed`) and appropriate assistive technology attributes (`aria-disabled="true"`).

---

## 5. Universal Accessibility (a11y) & WCAG Compliance

- **Semantic HTML First:** Use native elements (`<button>`, `<dialog>`, `<nav>`, `<main>`, `<article>`, `<label>`) rather than building custom widgets out of clickable `<div>` elements.
- **Keyboard Operability:** Ensure all interactive elements are reachable via `Tab`, triggerable via `Enter` / `Space`, dismissible via `Escape`, and retain high-visibility focus indicators (`outline` or `focus-visible:ring-2`).
- **Contrast Ratios:** Adhere to WCAG 2.1/2.2 AA standards:
  - Text & Images of Text: Minimum 4.5:1 contrast against background (3:1 for large text >= 18pt or 14pt bold).
  - UI Components & Graphical Objects: Minimum 3:1 contrast against adjacent colors.
- **Assistive Technology (Screen Readers):**
  - Provide descriptive `aria-label` or `aria-labelledby` attributes for icon-only buttons.
  - Implement `aria-expanded` and `aria-controls` on accordions, menus, and disclosure triggers.
  - Announce dynamic updates or status alerts using `aria-live="polite"`.
- **Motion Polish & Preferences:** Keep transitions snappy (150ms–300ms) with purposeful easing curves; wrap animations in `@media (prefers-reduced-motion: reduce)` to support users with vestibular sensitivities.
