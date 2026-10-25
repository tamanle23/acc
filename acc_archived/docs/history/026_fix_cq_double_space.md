# [026] Fix ffmpeg Unrecognized Option 'cq  12' Bug

**1. Context & Problem Statement**: 
The user encountered an ffmpeg error: `error: ffmpeg exited with code 8: Unrecognized option 'cq  12'`. This happened because the string manipulation logic for intermediate render quality settings was improperly slicing the `"-cq "` option and concatenating it with `" 12"`, resulting in a double space (`"-cq  12"`).

**2. Implementation Plan**: 
- The error stems from `src/renderer.ts` where `substring(0, 4)` was used on `"-cq 21"`. This resulted in `"-cq "` which, when interpolated as `` `${...} 12` ``, produced `"-cq  12"`.
- We'll replace the `.substring(0, 4)` approach with direct string assignments for `-crf` and `-cq` flags (e.g. `outputOptions[i] = '-cq 12';`), avoiding double space issues.
- Update history.

**3. Changes Made**: 
- `src/renderer.ts`: Replaced the `substring(0, 4)` string replacement logic for `-crf` and `-cq` with direct assignments `outputOptions[i] = '-cq 12'` and `outputOptions[i] = '-crf 12'` (as well as for `15`).

**4. Verification & Walkthrough**: 
- Code updated successfully to avoid double spaces in the `fluent-ffmpeg` option array for CQ/CRF values, fixing the render error.
