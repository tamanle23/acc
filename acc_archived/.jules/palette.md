## 2026-10-14 - HTML5 Interactive Video Player Media Controls & Set Position ARIA Context
**Learning:** For interactive video branching exports (`WidgetExporter`), relying on browser autoplay without the `controls` attribute leaves users stranded when browser autoplay policies block video playback. Additionally, dynamically injected choice buttons require position-in-set context (`Choice X of Y`) in their `aria-label` so screen reader users know how many options exist without manual DOM exploration, alongside `aria-controls` on the overlay container.
**Action:** Always include native `controls` on exported HTML5 `<video>` tags, specify `aria-controls` pointing to the target media player ID on overlay containers, and format dynamic button `aria-label` strings with `(Choice X of Y)` position context.

## 2026-10-11 - Interactive HTML Widget Branching Choice Focus Management & ARIA Live
**Learning:** For dynamic HTML5 video choice overlays generated on video end, screen readers and keyboard-only users miss options unless the choices container is designated as an `aria-live="polite"` region with `role="region"` and keyboard focus is explicitly transferred to the first choice button (`firstBtn.focus()`). Additionally, enforcing `min-height: 44px` on dynamic choice buttons guarantees WCAG 2.1 AA touch target compliance.
**Action:** When creating dynamic DOM overlay choices after media events, always set `role="region" aria-live="polite"`, manage focus to the first interactive button upon rendering, and apply explicit `min-height: 44px` and `:focus-visible` styles.

## 2026-10-07 - CLI Interactive Prompts & Default Values
**Learning:** Interactive CLI select wrappers (`askChoice`) support option objects `{ label, value, hint }` which significantly improves UX by giving inline guidance without overloading option labels. Additionally, text input prompts must fall back to default values when trimmed input is empty string to prevent unintended blank defaults.
**Action:** Always provide option hints for CLI select modes and ensure `askQuestion` fallback handles empty string input gracefully.
