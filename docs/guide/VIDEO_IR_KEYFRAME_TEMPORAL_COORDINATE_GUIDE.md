# VideoIR Keyframe Temporal Coordinate Architecture Guide

## Continuous Time (`timeSec`) vs. Discrete Frames (`frame`) in NLE and Rendering Pipelines

---

### 1. Executive Summary & Purpose

In automated video rendering pipelines and non-linear editing (NLE) workstations like `@acc/studio`, keyframing is the core mechanism that animates property values over time. A fundamental architectural design decision is the **coordinate system used to index keyframes**:
- Continuous floating-point time in seconds: `timeSec: number`
- Discrete integer frame counts: `frame: number`
- Hybrid/dual representation: `frame?: number; timeSec?: number`

This guide serves as the definitive reference analyzing the mechanics, mathematical implications, pros, cons, and architectural trade-offs of each approach across rendering, audio synchronization, timeline editing, and schema validation.

---

### 2. Deep Comparative Analysis

#### Option A: Strictly Continuous Time (`timeSec: number`) — Current VideoIR Standard

Keyframes are stored as floating-point seconds relative to sequence start:
```json
{
  "type": "transform",
  "target": "video",
  "params": {
    "scale": {
      "keyframes": [
        { "timeSec": 0.0, "value": 1.0, "ease": "ease-in-out" },
        { "timeSec": 1.5, "value": 1.25, "ease": "ease-out" },
        { "timeSec": 3.0, "value": 1.0, "ease": "linear" }
      ]
    }
  }
}
```

##### Advantages (Pros)
1. **Frame-Rate Invariance (FPS Independence)**:
   - A 1.0-second fade or camera zoom takes exactly 1.0 real-world second whether rendered at **24 FPS** (cinematic film), **30 FPS** (standard broadcast), **60 FPS** (high frame rate), or **120 FPS** (slow-motion interpolation).
   - Changing the project frame rate in the titlebar does not alter animation timing, pacing, or audio sync.
2. **Universal Audio/DSP Parity**:
   - The Web Audio API, WebCodecs audio decoders, and procedural audio synthesis operate strictly in continuous time (seconds and sample frequencies like 44.1 kHz / 48 kHz).
   - Video motion and audio automation envelopes (volume ramps, dynamic sidechain ducking) can share the exact same `TemporalCurve<T>` data model and `TemporalKeyframeEvaluator` without unit conversions.
3. **Sub-frame Animation Precision**:
   - High-speed physics simulations, procedural noise effects, and sub-frame easing curves (e.g. motion blur sampling at 1/120th sec on a 30fps timeline) are supported natively without quantization error.
4. **Adherence to Existing Spec**:
   - Fully aligned with `docs/ir/1. video_(IR)_specification.md`, `packages/ir/src/schema/VideoIRSchemaValidator.ts`, and `packages/ir/src/motion/TemporalKeyframeEvaluator.ts`.

##### Disadvantages & Risks (Cons)
1. **IEEE 754 Floating-Point Drift**:
   - Non-integer frame rates (e.g. **29.97 FPS** or **59.94 FPS** SMPTE drop-frame) produce irrational fractions ($1 / 29.97 = 0.0333667...$). Checking if a user's playhead is sitting "on" a keyframe requires epsilon tolerance (`Math.abs(k.timeSec - currentTimeSec) < 0.5 / fps`), which can introduce snapping ambiguities.
2. **Studio UI Translation Overhead**:
   - The frontend property inspector and timeline ruler must continuously convert between integer frame indices and seconds: $\text{frame} = \text{round}(\text{timeSec} \times \text{fps})$.

---

#### Option B: Dual Polyglot Support (`frame?: number; timeSec?: number`)

The schema accepts either representation (or both), normalizing at evaluation time:
```json
{
  "type": "transform",
  "target": "video",
  "params": {
    "scale": {
      "keyframes": [
        { "frame": 0, "value": 1.0 },
        { "frame": 45, "value": 1.25, "ease": "ease-out" },
        { "timeSec": 3.0, "value": 1.0, "ease": "linear" }
      ]
    }
  }
}
```

##### Advantages (Pros)
1. **Maximum Ergonomic Flexibility**:
   - Video motion and clip transitions can be authored natively in discrete frames (`frame: 45`), which video editors find natural.
   - Generative story AI pipelines, music beat-drop aligners, and audio DSP tools can emit continuous seconds (`timeSec: 1.5`).
2. **Zero-Regression Migration**:
   - Existing documents containing `timeSec` continue to load and render with 100% backward compatibility.
   - Studio inspector can emit `frame` directly without breaking external tools or legacy files.

##### Disadvantages & Risks (Cons)
1. **Ambiguity & Precedence Rules**:
   - If a payload contains *both* `{ "frame": 30, "timeSec": 2.0 }`, the runtime must enforce explicit precedence rules (e.g. `frame !== undefined ? frame / fps : timeSec`), increasing mental model complexity.
2. **Schema & Validation Complexity**:
   - `VideoIRSchemaValidator` must validate that at least one of `frame` or `timeSec` is present, non-negative, and finite.
3. **Runtime Branching in Tight Loops**:
   - `TemporalKeyframeEvaluator` must branch to resolve effective seconds or normalize the array before sorting and binary-searching intervals, adding minor overhead in the hot 60 FPS frame loop.

---

#### Option C: Strictly Discrete Frames (`frame: number`)

Keyframes are stored strictly as discrete integer frame counts:
```json
{
  "type": "transform",
  "target": "video",
  "params": {
    "scale": {
      "keyframes": [
        { "frame": 0, "value": 1.0 },
        { "frame": 45, "value": 1.25, "ease": "ease-out" },
        { "frame": 90, "value": 1.0, "ease": "linear" }
      ]
    }
  }
}
```

##### Advantages (Pros)
1. **Bit-Identical Determinism & Snapping**:
   - Eliminates all floating-point rounding errors and epsilon checks. A keyframe at `frame: 45` matches `currentFrame === 45` with strict integer equality (`===`).
   - Timeline playhead, markers, razor cuts, and keyframes align to the same unified integer coordinate system.
2. **Direct Studio UI Ergonomics**:
   - 1:1 mapping with the Studio UI inputs. Dragging a keyframe by 1 frame on the timeline is simply `frame + 1`, with zero rounding artifacts.
3. **Optimized Sorting & Search**:
   - Keyframe arrays sort and binary-search on clean integers with zero floating-point drift.

##### Disadvantages & Risks (Cons)
1. **Frame-Rate Coupling (Pacing Distortion)**:
   - If a project is created at **30 FPS** with a 30-frame transition (1.0 second), and the user later changes the project to **60 FPS**, the transition will now finish in **0.5 seconds** (twice as fast), distorting all animation pacing unless a compiler scales all frame numbers.
2. **Audio/Video Disconnect**:
   - Audio pipelines require knowing the video FPS to evaluate an audio volume curve: $\text{timeSec} = \text{frame} / \text{fps}$. Standalone audio processing loses its time independence.
3. **Breaking Schema Migration**:
   - Breaks existing VideoIR schema specifications (`docs/ir/1. video_(IR)_specification.md`, `schema/video-ir.schema.json`, `VideoIRSchemaValidator.ts`, and multiple autogenerated test suites expecting `timeSec`). Requires full monorepo migration.

---

### 3. Architectural Trade-Off Matrix

| Metric / Dimension | Option A (`timeSec`) | Option B (`frame \| timeSec`) | Option C (`frame`) |
| :--- | :--- | :--- | :--- |
| **FPS Independence (Export Pacing)** | **Optimal** (Exact same duration at 24/30/60 FPS) | **High** (Resolves dynamically) | **Poor** (Coupled to FPS; changes speed if FPS changes) |
| **Audio / DSP Shared Compatibility** | **Native** (Web Audio uses seconds) | **High** (Audio can use `timeSec`) | **Low** (Audio must convert via video FPS) |
| **Snapping Determinism in UI** | Requires epsilon tolerance (`0.5 / fps`) | **Exact** for frames | **Exact** (Strict integer `===`) |
| **Schema Simplicity** | **High** (Single canonical format) | **Medium** (Two allowed fields) | **High** (Single canonical format) |
| **Migration Risk / Regressions** | **Zero** (Already live & passing) | **Low** (Additive, backwards compatible) | **High** (Breaking change across monorepo & validator) |

---

### 4. Industry Standards Reference

| Platform / Tool | Keyframe Storage Model | Rationale |
| :--- | :--- | :--- |
| **OpenTimelineIO (OTIO)** | Rational Time (`RationalTime(value, rate)`) | Preserves integer frame count paired with explicit timebase to avoid float drift while remaining FPS-aware. |
| **After Effects / Bodymovin (Lottie)** | Continuous Frame Index (relative to composition frame rate) | Tailored for 2D vector animation authored at a fixed composition frame rate. |
| **Remotion** | Discrete Frame Number (`frame: number`) | Centered around React components where the current state is purely a function of `useCurrentFrame()`. |
| **Apple Final Cut Pro (FCPXML)** | Rational Fraction (e.g. `1001/30000s`) | Exact fractional representation preventing float rounding on NTSC drop-frame rates (29.97). |
| **Web Animations API (WAAPI)** | Milliseconds / Seconds (`currentTime: number`) | Standard browser timing model across CSS transitions and Web Audio. |

---

### 5. Architectural Recommendation for ACC

1. **Retain `timeSec` as the canonical VideoIR ground truth**:
   - Guarantees that automated documentary and short-form render pipelines generate bit-identical pacing whether exporting for 24fps cinema or 60fps social media.
   - Preserves single unified `TemporalKeyframeEvaluator` across visual transforms, shader uniforms, and audio DSP ducking.
2. **Present discrete `frame` in Studio UI**:
   - The Studio property inspector should display and accept discrete integer frame numbers in the UI, transparently serializing to `timeSec = frame / fps` upon document mutation.
3. **If Future Hybrid Parity is Required**:
   - Adopt **Option B** as a non-breaking additive extension where `frame?: number` acts as an optional convenience alias resolved at compile time:
     $$\text{timeSec}_{\text{effective}} = \begin{cases} \frac{\text{frame}}{\text{fps}} & \text{if } \text{frame} \ne \text{undefined} \\ \text{timeSec} & \text{otherwise} \end{cases}$$
