# [027] Populate Effect Registry & Enable Strict Validation

**1. Context & Problem Statement**:
Following the Phase 2 migration to a Data-Driven Architecture, the `effects-registry.json` was generated programmatically but lacked the detailed structural metadata (Categories, Variants). We needed to properly map the 24+ overlay effects back to the `overlay-effects-architecture.md` documentation to ensure the CLI remains strictly validated and self-documenting.

**2. Implementation Plan**:
- Fully populated `effects-registry.json` mapping all 12 Categories and every documented Variant.
- Re-enabled `registry.validate(effectName, variantName)` in `overlay-effects-cli.ts`.
- The CLI now actively rejects attempts to render invalid variants (e.g., calling `--effect rain --variant sunny`) directly from the registry data, before any heavy modules or FFmpeg instances are spun up.

**3. Changes Made**:
- `effects-registry.json`: [MODIFY] Filled completely with precise metadata mappings.
- `overlay-effects-cli.ts`: [MODIFY] Uncommented the strict validation step.

**4. Verification**:
- The JSON configuration serves as a robust Single Source of Truth for both runtime execution and future UI/front-end form generation.
