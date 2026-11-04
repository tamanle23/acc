# `@acc/studio` — Dedicated Pro NLE & Motion Graphics Workstation

`@acc/studio` is an enterprise-grade non-linear video editing (NLE), procedural motion graphics, and depth-aware visual effects workspace built on React 19, Vite, HTML5 Canvas, and the VideoIR timeline execution model.

---

## 🎨 Aesthetic Core: Liquid Glass

Studio operates on the **Liquid Glass** design system ([`DESIGN.md`](./DESIGN.md)):
- **Obsidian Canvas**: Deep `#070a13` background eliminating cold-boot white flashes.
- **Frosted Glass Scrims**: Translucent glass backdrops over subtle chromatic liquid ambient mesh (`backdrop-filter: blur(24px)`).
- **Specular Highlights**: Crisp rim borders (`border-white/12`, inset highlights `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2)`).
- **SMPTE Telemetry Readouts**: Monospace timecodes, drop ratios, and audio clock synchronization.

---

## ⚡ Two-Tier Hybrid Boot Sequence

To provide instant feedback on cold boot without layout shifts or FOUC:
1. **Tier 1 (Instant Pre-Hydration Zero-JS Splash)**:
   - Inlined directly into [`index.html`](./index.html) (`#app-boot-splash`).
   - Renders in $< 10\text{ ms}$ before any Vite bundles are fetched.
   - **Compositor-Only 60 FPS**: Uses strictly GPU-accelerated CSS properties (`transform`, `opacity` with `will-change`) so the breathing aperture logo and shimmer rail stay fluid while V8 compiles the main JavaScript bundle.
   - **WCAG 2.2 AA Accessibility**: `role="status"`, `aria-live="polite"`, `aria-label="Loading ACC Studio Workstation"`, and `@media (prefers-reduced-motion: reduce)` fallbacks.
2. **Tier 2 (React Lifecycle, Engine Warmup & Smooth Outro Synchronization)**:
   - Orchestrated by [`StudioBootController.ts`](./src/lib/boot/StudioBootController.ts).
   - Awaits `PreviewWorkerCoordinator.waitForWarmup()` and Viewport Canvas worker initialization.
   - **Minimum 2.5s Dwell Time**: Enforces at least 2.5 seconds total display time (`minDurationMs = 2500`) to guarantee an unhurried, calm brand presentation even on ultra-fast cached loads.
   - **Status Settle Beat**: Gives `"Ready"` a brief 250ms visual pause so the user perceives the system status before dismissal.
   - **Smooth Outro Transition**: Features a 700ms cinematic ease curve (`cubic-bezier(0.22, 1, 0.36, 1)`) with subtle outward scale expansion (`scale(1.025)`), depth blur (`filter: blur(6px)`), and card settle (`scale(0.985)`) to eliminate abruptness and visual hustle.
   - Unlinks `#app-boot-splash` and its `<style>` tag from the DOM after 750ms, freeing GPU memory layers.

---

## 🎯 Spatial Coordinate System & Transform Architecture

Studio implements a dual-space geometric architecture ensuring 1:1 pixel-accurate alignment between the HTML5 2D canvas renderer and the interactive [`TransformGizmoOverlay`](./src/components/preview/TransformGizmoOverlay.tsx).

### 1. Canvas Space: `normX` and `normY`

**`normX`** and **`normY`** are normalized coordinates ($0.0 \dots 1.0$) defining the **geometric center position** of an object relative to the canvas/viewport dimensions:

$$\text{Canvas X} = \text{canvasWidth} \times \text{normX} + x$$
$$\text{Canvas Y} = \text{canvasHeight} \times \text{normY} + y$$

Where:
- $\text{normX} \in [0.0, 1.0]$: Horizontal ratio across the canvas width.
- $\text{normY} \in [0.0, 1.0]$: Vertical ratio across the canvas height.
- $x, y$: Pixel offsets added on top of the normalized origin (e.g. from mouse dragging in the viewport).

#### Coordinate Map Reference:

| `normX` | `normY` | Location on Canvas | Common Studio Use Case |
| :---: | :---: | :--- | :--- |
| **`0.5`** | **`0.5`** | **Exact Center** | Centered titles, main video footage, hero vector shapes |
| **`0.5`** | **`0.45`** | **Upper Center** | Cinematic film titles (optical vertical balance) |
| **`0.5`** | **`0.20`** | **Top Center** | Chapter headers, top banner titles |
| **`0.25`** | **`0.82`** | **Lower-Left** | News/broadcast Lower Thirds, speaker badges |
| **`0.5`** | **`0.88`** | **Bottom Center** | Subtitles, captions, timed text |
| **`0.0`** | **`0.0`** | **Top-Left Corner** | Corner watermarks, channel bug logos |
| **`1.0`** | **`1.0`** | **Bottom-Right Corner** | Lower-right call-to-actions, timestamps |

#### Why Normalized Coordinates Instead of Raw Pixels?
1. **Resolution Independence**: Elements stay positioned correctly whether rendered at **720p**, **1080p**, **4K**, or **9:16 vertical mobile (1080×1920)** without recalibrating pixel offsets.
2. **Aspect Ratio Agility**: When switching between 16:9 widescreen, 9:16 vertical, and 1:1 square, layouts maintain their proportional placement.
3. **Unified Coordinate Inheritance**: Both `TextModifierPlugin` and `ShapeModifierPlugin` inherit `normX` and `normY` from the sequence's `transform` modifier if omitted from the draw modifier parameters, preventing origin drift across typography presets.

---

### 2. Object Space: `anchorPoint` (Pivot) vs. Position (`normX`, `normY`)

| Property | Coordinate Space | Purpose | Example Values |
| :--- | :--- | :--- | :--- |
| **`normX`, `normY`** | **Canvas Space** $(0 \dots 1 \text{ Viewport})$ | **Where the object is placed** on the screen. | `[0.5, 0.5]` = screen center<br>`[0.25, 0.82]` = lower-third |
| **`anchorPoint`** (Pivot) | **Object Space** $(0 \dots 1 \text{ Object})$ | **Which point inside the object** acts as the pivot for rotation and scaling. | `[0.5, 0.5]` = object center<br>`[0.0, 0.0]` = top-left corner<br>`[0.0, 0.5]` = left edge (hinge) |

#### Mathematical Formulation:
Let an object have unscaled dimensions $W, H$ (or normalized $normWidth, normHeight$). For any normalized anchor $(a_x, a_y) \in [0, 1] \times [0, 1]$, the canvas pivot point before rotation is:

$$\text{pivotNormX} = \text{normX} + (a_x - 0.5) \times \text{normWidth}$$
$$\text{pivotNormY} = \text{normY} + (a_y - 0.5) \times \text{normHeight}$$

#### Affine Matrix Execution:
- **Canvas 2D ([`TransformModifierPlugin.ts`](./src/../../packages/ir/src/plugins/transform/TransformModifierPlugin.ts))**:
  ```ts
  canvasCtx.translate(pivotX + motion.x * scaleX, pivotY + motion.y * scaleY);
  canvasCtx.rotate((motion.rotation * Math.PI) / 180);
  canvasCtx.scale(scaleFactorX, scaleFactorY);
  canvasCtx.translate(-pivotX, -pivotY);
  ```
- **Viewport Gizmo ([`TransformGizmoOverlay.tsx`](./src/components/preview/TransformGizmoOverlay.tsx))**:
  ```tsx
  style={{
    left: `${pivotPercentX}%`,
    top: `${pivotPercentY}%`,
    width: `${widthPercent}%`,
    height: `${heightPercent}%`,
    transformOrigin: `${anchor[0] * 100}% ${anchor[1] * 100}%`,
    transform: `translate(${-anchor[0] * 100}%, ${-anchor[1] * 100}%) scale(${curScale}) rotate(${curRot}deg)`,
  }}
  ```
- **Gizmo Rotation Drag Math ([`Gizmo2DTransformation.ts`](./src/lib/gizmo/Gizmo2DTransformation.ts))**:
  When dragging rotation handles, `Math.atan2` calculates pointer angle relative to the rotated pivot pin rather than the geometric center, guaranteeing smooth swinging around arbitrary anchors (e.g. door hinge, pendulum).

---

### 3. Dynamic Typography Bounds & Plate Wrapping

[`CanvasHitTester.resolveSequenceBounds`](./src/lib/hit-test/CanvasHitTester.ts) ensures the gizmo wraps text and background plates tightly:
- **Offscreen Canvas Measurement**: Evaluates exact text metrics via `ctx.measureText` in browser environments, with a high-precision typographic heuristic fallback in headless environments.
- **Plate Padding Distinction**: Adds badge padding (`padX * 2`, `padY * 2`) to the bounding box **only when a background plate is active** (`backgroundColor !== 'transparent'`). For plain text, wraps glyphs directly with the standard 8px breathing padding.

---

## ⏱️ Temporal Engine & Frame Addressing (0-Indexed Standard)

Studio is strictly **0-indexed** across all timeline calculations, rendering loops, and timecode systems.

### Temporal Invariants:
1. **First Frame Index is `0`**:
   - Frame `0` represents timestamp $t = 0.000\text{ seconds}$ ($0\,\mu\text{s}$ decoder offset).
   - SMPTE timecode at Frame `0`: **`00:00:00:00`** (`HH:MM:SS:FF`).
2. **Half-Open Interval Convention $[ \text{startFrame}, \text{endFrame} )$**:
   - Sequences operate on $[ \text{startFrame}, \text{endFrame} )$.
   - Active condition: `clampedFrame >= seq.startFrame && clampedFrame < seq.endFrame`.
   - A 90-frame sequence starting at 0 spans frames `0` through `89`. At frame `90`, the playhead transitions to the next cut.
3. **Playhead Clamping**:
   - [`PlayheadController.ts`](./src/lib/playhead/PlayheadController.ts) enforces `clamped = Math.max(0, Math.min(totalFrames, frame))`.

### First Frame Boot Control Lifecycle:
When Studio first boots up, the rendered frame is determined by three interacting systems:
```
[ Application Boot: App.tsx ]
       │
       ├── 1. Playhead Initialization ────────► PlayheadController (defaults to frame 0)
       │
       ├── 2. Auto-Seek on Selected Sequence ─► useGizmoTransform seeks to seq.startFrame
       │
       ├── 3. Preflight & Render Pipeline ────► PreviewWorkerCoordinator.preflightTimeline({ prioritizedFrame })
       │                                        useViewportRenderStrategy.renderFrame(currentFrame)
       │
       └── 4. Splash Screen Dismissal ────────► StudioBootController (waits for double-rAF & first frame)
```

1. **Playhead Default**: `App.tsx` initializes `currentFrame = 0`, and `PlayheadController.getInstance()` defaults to `0`.
2. **Auto-Seek on Selected Sequence**: In [`useGizmoTransform.ts`](./src/components/preview/useGizmoTransform.ts), if `IRStateManager` initializes with a selected sequence (e.g. `'seq-city-intro'`), the playhead automatically seeks to `seq.startFrame` so the selected clip is visible in the viewport immediately.
3. **Preflight Warmup & Canvas Ready**: [`useViewportRenderStrategy.ts`](./src/components/preview/useViewportRenderStrategy.ts) preflights the target frame in the sidecar worker and notifies `StudioBootController.notifyCanvasReady()` only once the initial frame is completely painted.
4. **Flicker-Free Reveal**: The boot splash screen dismisses only after the initial frame is verified, eliminating black frames and canvas strobe on cold start.

---

## 🛠️ Developer Guide: How to Simulate Loading & Verify Splash UI

When designing or testing the splash screen, progressive status text, and fail-safe reload recovery, use any of the following methods:

### Method 1: URL Query Parameters (Instant & Recommended)

`StudioBootController` supports built-in simulation flags directly in the URL:

| Query Parameter | Description | Example URL |
| :--- | :--- | :--- |
| `?splash=hold` | **Freezes the splash permanently**. Keeps the glass card visible indefinitely so you can inspect CSS, typography, and animations in DevTools. | `http://localhost:5173/?splash=hold` |
| `?splash=preview` | Alias for `?splash=hold`. | `http://localhost:5173/?splash=preview` |
| `?splash=<ms>` | **Delays dismissal by specified milliseconds**. Useful for testing timed progressive messages. | `http://localhost:5173/?splash=5000` |

#### Testing Timed Progressive Telemetry:
- **At 5 seconds**: Status text updates to *"Loading video & audio subsystems..."*.
  ```text
  http://localhost:5173/?splash=6000
  ```
- **At 10 seconds**: Status text updates to *"Taking longer than usual..."* and reveals the accessible *"Reload Workstation"* recovery button.
  ```text
  http://localhost:5173/?splash=12000
  ```

---

### Method 2: Browser DevTools Network Throttling

To simulate a real-world cold boot on a slow or mobile connection:

1. Open Chrome / Edge DevTools (`F12` or `Ctrl+Shift+I`).
2. Navigate to the **Network** tab.
3. In the throttling dropdown (defaults to *No throttling*), select **Slow 3G** or **Fast 3G**.
4. Check **Disable cache**.
5. Hard reload with `Ctrl+F5` (or `Cmd+Shift+R`).
   - The browser takes several seconds to stream and parse the JavaScript bundle, during which the zero-JS splash animates smoothly on the compositor thread.

---

### Method 3: Browser Debugger Freeze

To pause execution at any exact point:

1. Open DevTools Console.
2. Run:
   ```javascript
   setTimeout(() => { debugger; }, 100); location.reload();
   ```
   Or set a breakpoint in `apps/studio/src/main.tsx` before React renders.

---

## 🧪 Testing & Verification

Run the automated boot splash lifecycle test suite:

```bash
# Run boot splash lifecycle and accessibility tests
bun test autogenerated-tests/studio_boot_splash_lifecycle.test.ts

# Run all studio test suites
bun test autogenerated-tests/studio_*.test.ts

# Build studio production bundle
pnpm --filter studio exec vite build
```
