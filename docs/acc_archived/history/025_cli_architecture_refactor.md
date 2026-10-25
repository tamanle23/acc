# [025] Refactor CLI to Enforce Core Architecture Rules

**1. Context & Problem Statement**:
The `overlay-effects-cli.ts` script was taking user input blindly, which violated the strict `Core System Architecture (Mandatory Constraints)` documented in `overlay-effects-architecture.md`. Specifically, it allowed non-prime durations, arbitrary FPS, and forced the user to manually specify `-t` (transparent) even for effects that structurally mandate an alpha channel (like UI or organic particles).

**2. Implementation Plan**:
Added a `CORE ARCHITECTURE CONSTRAINTS` evaluation block to the CLI arguments parsing logic before constructing the `config`:
- **Constraint 1 (Polyrhythmic Looping)**: Validates if `duration` is in the `primes` array (3, 5, 7, 11...). Throws a warning if the user attempts to render a non-prime duration.
- **Constraint 2 (Fixed FPS)**: Validates that FPS is exactly `30` or `60`. Emits a warning otherwise.
- **Constraint 3 (Background & Codec Management)**:
  - Maintained two lists: `alphaRequiredEffects` (WebM) and `solidBlackEffects` (MP4).
  - Automatically overrides the `bgTransparent` flag and notifies the user via `[INFO]` if they select an effect that structurally requires a specific output format.
  - Hybrid effects (`rain_on_glass`, `grunge_texture`) are allowed to bypass this and respect the user's `-t` flag.

**3. Changes Made**:
- `overlay-effects-cli.ts`: [MODIFY] Injected the architecture rule validations.

**4. Verification**:
- User no longer needs to remember to pass `-t` for UI effects. The CLI intelligently handles the WebM/MP4 routing.
- The pipeline constraint (zero-disk streaming) was already satisfied by `EffectPipeline`, which uses Node streams (`PassThrough`) to pipe raw RGBA buffers directly into `ffmpeg` via `stdin`.
