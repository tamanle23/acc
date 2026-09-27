# [001] Multi-Language Cultural Subtitles (Cultural Captions)

- **Status:** ⏳ `[ ] Planned`
- **Component:** Audio / Subtitles Engine / Metadata
- **Created Date:** 2026-09-26
- **Completed Date:** N/A
- **Linked History:** N/A

---

## 1. Context & Problem Statement
When the AI sound generator creates animal sounds using cultural onomatopoeia (e.g., "cho" + "ang_ang"), the visual renderer should display localized closed captions rather than standard English descriptors.

## 2. Proposed Design & Implementation Ideas
- The Sound Generator metadata (`.json`) already captures the original `variant` and `subVariant`.
- Update the video rendering engine (`renderer.ts` / FFmpeg filters) to parse this JSON metadata and burn subtitle text based on a localization map.
- Instead of showing `[Dog barking]`, the video will show `[Chó: Ẳng ẳng...]` or `[Dế mèn: Rỉ rả...]`.

## 3. Acceptance Criteria
- [ ] Sound generator metadata parser extracts localized labels.
- [ ] Subtitle burner displays cultural onomatopoeia in captions.
- [ ] Fallback to English descriptors if localization is missing.
