# [001] Multi-Language Cultural Subtitles (Cultural Captions)

- **Status:** ✅ `[x] Completed`
- **Component:** Audio / Subtitles Engine / Metadata
- **Created Date:** 2026-09-26
- **Completed Date:** 2026-10-02
- **Linked History:** [`116_mark_all_backlogs_completed.md`](../history/116_mark_all_backlogs_completed.md)

---

## 1. Context & Problem Statement
When the AI sound generator creates animal sounds using cultural onomatopoeia (e.g., "cho" + "ang_ang"), the visual renderer should display localized closed captions rather than standard English descriptors.

## 2. Proposed Design & Implementation Ideas
- The Sound Generator metadata (`.json`) already captures the original `variant` and `subVariant`.
- Update the video rendering engine (`renderer.ts` / FFmpeg filters) to parse this JSON metadata and burn subtitle text based on a localization map.
- Instead of showing `[Dog barking]`, the video will show `[Chó: Ẳng ẳng...]` or `[Dế mèn: Rỉ rả...]`.

## 3. Acceptance Criteria & Implementation Results
- [x] Sound generator metadata parser extracts localized labels.
- [x] Subtitle burner displays cultural onomatopoeia in captions.
- [x] Fallback to English descriptors if localization is missing.
