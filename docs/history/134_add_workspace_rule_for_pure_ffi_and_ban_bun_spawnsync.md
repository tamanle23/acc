# History Log: 134 - Workspace Rule Mandate for Pure bun:ffi and Ban on Bun.spawnSync

**Date:** 2026-10-02 (2026-10-03 local)  
**Task:** Add Workspace Rule to Permanently Prohibit Bun.spawnSync and Enforce Pure bun:ffi for FFmpeg  
**Affected Files:** `docs/master_rules_reference.md`, `.agents/rules/01-workspace-specific.md`, `docs/history/README.md`

---

## 1. Context & Problem
- To prevent any future re-introduction or accidental regression of `Bun.spawnSync`, `Bun.spawn`, or child processes when performing FFmpeg operations, the user requested an explicit workspace rule.
- Adhering to the `RULE MANAGEMENT SOP`:
  1. Detailed explanation and guidelines must be added to `docs/master_rules_reference.md`.
  2. A compacted, imperative constraint must be added to `.agents/rules/01-workspace-specific.md`.

---

## 2. Changes Made
1. **`docs/master_rules_reference.md`**:
   - Expanded Section 3 (*FFmpeg Manager & Zero-Copy Bun FFI Protocol*) to explicitly ban `Bun.spawnSync`, `Bun.spawn`, `child_process.spawn`, `child_process.exec`, `execSync`, and `fluent-ffmpeg`.
   - Mandated direct invocation of shared libraries (`libavcodec`, `libavformat`, `libavutil`, `libswscale`, `libswresample`, `libavfilter`) via `bun:ffi`.
   - Mandated defensive `BigInt(ptr)` casting for all pointer offset additions.
2. **`.agents/rules/01-workspace-specific.md`**:
   - Updated `FFMPEG-MANAGER` rule with compact constraint:
     `ABSOLUTELY NEVER use Bun.spawnSync, Bun.spawn, child_process, or fluent-ffmpeg to invoke FFmpeg/ffprobe. ALL decoding, encoding, audio DSP, and stream concat MUST execute via pure bun:ffi (getBinDir()). MUST wrap pointer offsets in BigInt() before addition.`

---

## 3. Verification
- Verified SOP compliance: `docs/master_rules_reference.md` updated first -> `.agents/rules/01-workspace-specific.md` distilled and updated.
- Verified rule file integrity and formatting.
