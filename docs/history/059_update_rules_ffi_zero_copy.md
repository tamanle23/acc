# [059] Update Rules to Enforce Zero-Copy Bun FFI & Remove fluent-ffmpeg Constraints

## 1. Context & Problem Statement
With the complete migration of the video rendering engine to **Zero-Copy Bun FFI** using FFmpeg Shared Libraries (`avcodec`, `avformat`, `libswscale`, `avfilter`), the project has deprecated `fluent-ffmpeg` and `child_process.spawn('ffmpeg')` IPC pipes. 

The system rules (`AGENTS.md`, `.agents/rules/`, `docs/master_rules_reference.md`) still contained legacy constraints referencing `fluent-ffmpeg`, `setFfmpegPath()`, and `stdin` buffer piping. These constraints needed to be updated to enforce the new `bun:ffi` zero-copy memory pointer architecture.

## 2. Implementation Plan
- **Rule Management SOP Compliance**:
  1. **Master Reference (`docs/master_rules_reference.md`)**: Update Section 3 to replace `fluent-ffmpeg` and `child_process` execution rules with **FFmpeg Manager & Zero-Copy Bun FFI Protocol**.
  2. **Compact Workspace Rule (`.agents/rules/01-workspace-specific.md`)**: Update `FFMPEG-MANAGER` rule to mandate `bun:ffi` and `getBinDir()` while forbidding `fluent-ffmpeg` and `child_process.spawn`.
  3. **Overlay Effects Rule (`.agents/rules/02-overlay-effects.md`)**: Update `ZERO-DISK` rule to specify passing Canvas RGBA memory pointers directly to `sws_scale` via `bun:ffi`.

## 3. Changes Made
- Modified `docs/master_rules_reference.md`: Updated Section 3 for Bun FFI `dlopen()` shared library protocol & zero-copy frame ingest.
- Modified `.agents/rules/01-workspace-specific.md`: Replaced `fluent-ffmpeg` / CLI quoting requirement in `FFMPEG-MANAGER` with `bun:ffi` imperative directive.
- Modified `.agents/rules/02-overlay-effects.md`: Refactored `ZERO-DISK` constraint to reference `bun:ffi` pointer passing.

## 4. Verification & Walkthrough
- Inspected `.agents/rules/01-workspace-specific.md`, `02-overlay-effects.md`, and `docs/master_rules_reference.md` to confirm all legacy `fluent-ffmpeg` and `spawn` constraints were removed and replaced.
- Verified rule file brevity and adherence to token-optimization guidelines.
