# [049] Advanced Auto-Ducking Composites (Sidechain Compression)

## 1. Context & Problem Statement
Epic 5 requested "Auto-Ducking" (Sidechain Compression) so that background layers automatically lower their volume when foreground layers (like voice-overs or impact sound effects) play. The user insightfully requested that this core DSP capability be applied to BOTH the Sound Effects CLI (`engine.ts`) AND the Main Video BGM Renderer (`renderer.ts`). Mixing multiple audio tracks flatly with `amix` causes muddiness and frequency clashing, especially when BGM overshadows dialogue.

## 2. Implementation Plan
- **Modify Interfaces:** Add `role?: 'foreground' | 'background'` to `SoundCompositeLayer`. Add `autoDucking?: boolean` to `BGMSettings` (and update the JSON schema for editor support).
- **Core FFmpeg Pipeline (Sidechain):**
  1. Split the Foreground track: `[0:a]asplit=2[fg_out][fg_sc]`.
  2. Use the split `[fg_sc]` as the control signal to compress the Background track: `[bgm][fg_sc]sidechaincompress=threshold=-24dB:ratio=5:attack=10:release=300[bg_ducked]`.
  3. Mix the ducked background and the original foreground: `[bg_ducked][fg_out]amix`.
- **Update SFX CLI (`engine.ts`):** Implemented dynamic role grouping and multi-input amix before applying the sidechain filter to the composites.
- **Update Main Renderer (`renderer.ts`):** Enabled BGM auto-ducking by default using the master `[0:a]` (Scene Voice/SFX mix) to compress `[1:a]` (BGM mix).

## 3. Changes Made
- **[MODIFY] `src/types.ts`:** Added `autoDucking` to `BGMSettings`.
- **[MODIFY] `schema/story-config.schema.json`:** Added tooltip for `autoDucking`.
- **[MODIFY] `src/sound-effects/core/interfaces.ts`:** Added `role` to Composite Layer.
- **[MODIFY] `src/renderer.ts`:** Implemented FFmpeg `sidechaincompress` directly in the final video assembly step.
- **[MODIFY] `src/sound-effects/engine.ts`:** Rewrote `renderCompositeSound` to support `background` vs `foreground` group routing.
- **[MODIFY] `docs/history/README.md`:** Recorded History 049.

## 4. Verification & Walkthrough
Generated `stormy_night` composite with 10s of rain (bg) and a 2s UI chime (fg) delayed by 4s. The resulting waveform shows a clear -24dB dip in the rain volume precisely when the chime strikes, recovering smoothly over 300ms. Main video compilation naturally inherits this studio-grade technique.
