# [051] Fix Upscaler Import Error

**1. Context & Problem Statement**: 
The user encountered a `ReferenceError: checkAndDownloadUpscaler is not defined` error when trying to run the CLI with AI upscaling enabled. This was caused by the missing import of `checkAndDownloadUpscaler` and `upscaleImage` from `upscaler.ts` in the `renderer.ts` file, likely lost during recent refactoring of the codebase.

**2. Implementation Plan**: 
- Re-add the missing `import { upscaleImage, checkAndDownloadUpscaler } from './upscaler';` to the top of `src/renderer.ts`.
- Update history.

**3. Changes Made**: 
- `src/renderer.ts`: Added import statement for `checkAndDownloadUpscaler` and `upscaleImage`.

**4. Verification & Walkthrough**: 
- Import successfully resolved. The renderer can now successfully reference the upscaling functions when the `upscale.enabled` flag is set in the configuration.
