# [034] Document Comprehensive Overlay & Blending Specification

**1. Context & Problem Statement**:
Following the systematization of overlay methods (`alpha`, `screen`, `multiply`, `overlay`), the user requested formal documentation of the entire mathematical, technical, and architectural specification in the `docs/` directory.

**2. Implementation Plan**:
- Created `docs/OVERLAY_METHODS_SPEC.md` covering:
  - Comprehensive Blending Methods Matrix (Alpha, Screen, Multiply, Overlay).
  - Mathematical equations and physical behavior of each mode.
  - Required container codecs, pixel formats, and FFmpeg decoder flags (`-c:v libvpx-vp9`).
  - Standardized companion JSON metadata structure.
  - Decision tree for selecting overlay methods during effect design.
- Linked `docs/OVERLAY_METHODS_SPEC.md` from `docs/OVERLAY_EFFECTS_CLI.md` and `README.md`.

**3. Changes Made**:
- `docs/OVERLAY_METHODS_SPEC.md`: [NEW] Detailed specification document for video blending methods.
- `docs/OVERLAY_EFFECTS_CLI.md`: [MODIFY] Added reference link.
- `README.md`: [MODIFY] Added reference link in the documentation index.

**4. Verification & Walkthrough**:
- Verified file paths, Markdown rendering, LaTeX equations, and links.
