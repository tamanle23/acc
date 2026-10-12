## 2026-10-11 - Interactive HTML Widget Branching Choice Focus Management & ARIA Live
**Learning:** For dynamic HTML5 video choice overlays generated on video end, screen readers and keyboard-only users miss options unless the choices container is designated as an `aria-live="polite"` region with `role="region"` and keyboard focus is explicitly transferred to the first choice button (`firstBtn.focus()`). Additionally, enforcing `min-height: 44px` on dynamic choice buttons guarantees WCAG 2.1 AA touch target compliance.
**Action:** When creating dynamic DOM overlay choices after media events, always set `role="region" aria-live="polite"`, manage focus to the first interactive button upon rendering, and apply explicit `min-height: 44px` and `:focus-visible` styles.

## 2026-10-07 - CLI Interactive Prompts & Default Values
**Learning:** Interactive CLI select wrappers (`askChoice`) support option objects `{ label, value, hint }` which significantly improves UX by giving inline guidance without overloading option labels. Additionally, text input prompts must fall back to default values when trimmed input is empty string to prevent unintended blank defaults.
**Action:** Always provide option hints for CLI select modes and ensure `askQuestion` fallback handles empty string input gracefully.
