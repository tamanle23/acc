# [002] Story Config Enum Standardization for Fauna

- **Status:** ✅ `[x] Completed`
- **Component:** Configuration Schema / Sound Effects
- **Created Date:** 2026-09-26
- **Completed Date:** 2026-10-02
- **Linked History:** [`116_mark_all_backlogs_completed.md`](../history/116_mark_all_backlogs_completed.md)

---

## 1. Context & Problem Statement
The current `story-config.schema.json` might not have strict Enum validation for all the new Vietnamese animal onomatopoeias introduced during the Fauna Acoustic Bridge implementation.

## 2. Proposed Design & Implementation Ideas
- Standardize the taxonomy of `fauna` variants and sub-variants.
- Inject the full list of supported combinations (e.g., `ho` -> `gam_vang`, `ga_trong` -> `o_o_o`) into `story-config.schema.json` so IDEs provide strict validation and autocomplete.
- Ensure the `auto-config.ts` wizard dynamically uses these enums.

## 3. Acceptance Criteria & Implementation Results
- [x] Schema `story-config.schema.json` strictly validates fauna enums.
- [x] `auto-config.ts` reflects standardized options.
- [x] CLI prompts support enum autocomplete.
