## 2026-10-07 - CLI Interactive Prompts & Default Values
**Learning:** Interactive CLI select wrappers (`askChoice`) support option objects `{ label, value, hint }` which significantly improves UX by giving inline guidance without overloading option labels. Additionally, text input prompts must fall back to default values when trimmed input is empty string to prevent unintended blank defaults.
**Action:** Always provide option hints for CLI select modes and ensure `askQuestion` fallback handles empty string input gracefully.
