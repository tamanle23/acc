# Studio Implementation Plan - Iteration 73
# Media Asset Quality & Specification Conformance in Studio (Refined v2.0)

## 1. Executive Summary
This companion plan defines the studio-level integration of the **Unified Media Asset Conformance Engine (UMACE)**. It ensures that Studio preview ([`IRPreviewEngine`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/renderer/IRPreviewEngine.ts)), texture caches ([`AssetTextureCache`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/textures/AssetTextureCache.ts)), metadata prober ([`BrowserAssetMetadataProber`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/ir/BrowserAssetMetadataProber.ts)), and timeline inspectors handle media assets whose dimensions, frame rate, color space, or audio layout differ from the project timeline.

---

## 2. Key Architecture & Touchpoints

### 2.1 Viewport Spatial Conformance (`useViewportRenderStrategy.ts` & `CanvasView.tsx`)
- Standardize sequence `fitMode`: `cover` (default), `fit` (letterbox/pillarbox), `stretch`, and `center`.
- Support normalized sequence cropping (`crop: { top, bottom, left, right }`).
- Support non-square pixel aspect ratio (PAR) for anamorphic video.
- Downsample high-res imagery ($> 2\times$ canvas dimensions) using progressive power-of-two mipmapping to prevent shimmering and moiré.

### 2.2 Probing & Asset Metadata (`BrowserAssetMetadataProber.ts`)
- Leverage `mediabunny.Input` for precise video container probing:
  - Video FPS from container track atom/header (`timescale` and `frameRate`).
  - Video PAR and native display bounds via `track.getDisplayWidth()`, `track.getDisplayHeight()`.
  - Audio track presence and sample rate / channel layout.
- Use `createImageBitmap` with `{ imageOrientation: 'from-image' }` to auto-normalize EXIF camera orientations on image assets.

### 2.3 Acoustic Conformance in Studio (`WebAudioEngine.ts` & `IRPreviewEngine.ts`)
- Real-time stereo downmixing of 5.1 and mono tracks using ITU-R BS.775 (-3 dB pan law).
- Integrated loudness gain trim in preview playback.
- Ultra-low latency resampling using native Web Audio `OfflineAudioContext`.

---

## 3. Phased Studio Roadmap

- **Phase 1: Mediabunny-Backed Studio Asset Probing**
  - Update `BrowserAssetMetadataProber` to probe FPS, PAR, and audio channel configurations using `mediabunny.Input`.
- **Phase 2: Visual Spatial Conformance & Mipmap LOD Caching**
  - Integrate `SpatialConformanceHelper` into `IRPreviewEngine` and `useViewportRenderStrategy`.
  - Cache downsampled intermediate LOD textures in `AssetTextureCache`.
- **Phase 3: Studio Inspector Controls**
  - Add visual Fit Mode selector (`cover` | `fit` | `stretch` | `center`) and crop sliders to the Sequence Inspector panel.
  - Display asset native specifications (e.g., "4K 60fps Rec.2020 HDR") alongside timeline target.
- **Phase 4: Verification & Studio Playback Testing**
  - Verify smooth 60fps playback with mixed media (4K, 720p, 9:16 vertical, 16:9, mono, 5.1 audio).
