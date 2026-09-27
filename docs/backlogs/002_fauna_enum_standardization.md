# [002] Story Config Enum Standardization for Fauna

- **Status:** ⏳ `[ ] Planned`
- **Component:** Configuration Schema / Sound Effects
- **Created Date:** 2026-09-26
- **Completed Date:** N/A
- **Linked History:** N/A

---

## 1. Context & Problem Statement
The current `story-config.schema.json` might not have strict Enum validation for all the new Vietnamese animal onomatopoeias introduced during the Fauna Acoustic Bridge implementation.

## 2. Proposed Design & Implementation Ideas
- Standardize the taxonomy of `fauna` variants and sub-variants.
- Inject the full list of supported combinations (e.g., `ho` -> `gam_vang`, `ga_trong` -> `o_o_o`) into `story-config.schema.json` so IDEs provide strict validation and autocomplete.
- Ensure the `auto-config.ts` wizard dynamically uses these enums.

## 3. Acceptance Criteria
- [ ] Schema `story-config.schema.json` strictly validates fauna enums.
- [ ] `auto-config.ts` reflects standardized options.
- [ ] CLI prompts support enum autocomplete.
