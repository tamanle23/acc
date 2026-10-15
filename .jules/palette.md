# Palette's Journal - Critical Learnings

## 2025-05-18 - PasswordInput Accessibility & ARIA Attributes
**Learning:** Icon-only toggle buttons inside password input fields must dynamic `aria-label` or `aria-pressed` attributes so screen readers clearly announce state changes (e.g., "Show password" vs "Hide password").
**Action:** Always check toggle buttons embedded within form inputs for proper dynamic `aria-label` and `aria-pressed` accessibility attributes.

## 2025-05-19 - ConfirmDialog Loading State & ARIA Busy Attribute
**Learning:** Modal confirmation actions in `ConfirmDialog` that handle asynchronous tasks should expose `aria-busy={isLoading}` on the confirm button and render an animated spinner (`Loader2`) so assistive technologies and users visually understand that an async action is in progress.
**Action:** Always include `aria-busy={isLoading}` and a spinner icon inside loading action buttons in shared dialog components.

## 2025-05-20 - Global Search Trigger Accessibility & Shortcut Badges
**Learning:** Global search trigger buttons with visual shortcut badges (like `<kbd>⌘K</kbd>`) need an explicit `aria-label` describing both the action and the keyboard shortcut (e.g., "Search (Press Ctrl+K or Cmd+K)"), while hiding the decorative `<kbd>` tag with `aria-hidden="true"` to avoid screen readers announcing confusing fragments.
**Action:** Always provide an explicit `aria-label` on trigger buttons that display keyboard shortcut badges, and mark the badge element as `aria-hidden="true"`.

## 2025-05-21 - Dynamic Active State Announcements on Switcher Triggers
**Learning:** Icon-only trigger buttons for preference switchers (such as theme or language switchers) should include dynamic current state information in their `aria-label` (e.g., `Select theme (current: Light)`) so screen reader users immediately know the current setting without having to open the menu.
**Action:** Always include the currently active option/state in the `aria-label` of dropdown menu triggers that change application settings.
