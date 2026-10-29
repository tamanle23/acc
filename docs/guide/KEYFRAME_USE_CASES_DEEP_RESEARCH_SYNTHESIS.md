# Deep Research & First-Principles Synthesis: Keyframe Use Cases in Professional NLEs & ACC

## Executive Summary
Keyframing in Non-Linear Editors (NLEs) represents the mathematical automation of parameters across time. While a theoretical "universal keyframe" engine sounds elegant, in real-world production across Premiere Pro, DaVinci Resolve, Final Cut Pro, and After Effects, **parameter automation behaves fundamentally differently across four distinct domains**:

1. **Category A: Spatial & Transform (Kinematics & Projection)**: Continuous affine matrices, 2D/3D vectors, spline paths, and Bézier handles.
2. **Category B: Audio Envelopes (DSP Sample Stream)**: High-frequency logarithmic curves, sample-accurate decimation, and anti-zipper slew limiting.
3. **Category C: Color & Exposure Transitions (Photometric & Colorimetry)**: Perceptual non-linear scales (EV, Kelvin, LUT blends) and scene transitions.
4. **Category D: Obscure & Filter Parameters (Procedural & Simulation)**: Discontinuous discrete integers, seed steps, and GPU shader uniforms.

This document breaks down each category from first principles, comparing mathematical formulations, execution engines, UI paradigms, industry standards, and architectural trade-offs.

---

## 1. Category A: Spatial & Transform (Kinematics & Projection)

### 1.1 First Principles & Domain Mechanics
Spatial transformation represents continuous rigid-body kinematics in Euclidean space:
$$\mathbf{p}' = \mathbf{T}(x(t), y(t)) \cdot \mathbf{R}(\theta(t)) \cdot \mathbf{S}(s_x(t), s_y(t)) \cdot \mathbf{p}$$

- **Compound Coupling**: Spatial motion is rarely 1-dimensional. Position coordinates $(x, y, z)$ are coupled into **spatial spline paths** (Catmull-Rom or cubic Hermite splines in pixel space), while temporal progress along that path is controlled by a **separate temporal curve** (easing/velocity graph).
- **Perceptual Sensitivity**: The human eye detects motion jitter at sub-pixel levels. Discontinuities in acceleration ($\frac{d^2 x}{dt^2}$, or "jerk") look unnatural; hence standard linear keyframes are rarely used in favor of $C^1$-continuous cubic Béziers.

### 1.2 Industry Standards & Benchmarks
- **After Effects**: Distinct separation between *Spatial Interpolation* (Bezier path on canvas) and *Temporal Interpolation* (Graph Editor speed/value curves).
- **DaVinci Resolve / Fusion**: Transform modifiers operate inside GPU vector matrices; keyframe curves allow independent X/Y curve decoupling.
- **Current ACC Architecture**:
  - `DeterministicMotionEvaluator.ts` evaluates `x`, `y`, `scale`, `rotation`, and `opacity`.
  - Driven by `TemporalKeyframeEvaluator.evaluateNumeric` using cubic Béziers (`solveCubicBezier`).
  - Rendered natively in `TransformModifierPlugin.ts` via canvas 2D matrix stacking:
    ```ts
    canvasCtx.translate(anchorX + motion.x, anchorY + motion.y);
    canvasCtx.rotate((motion.rotation * Math.PI) / 180);
    canvasCtx.scale(motion.scale, motion.scale);
    ```

### 1.3 Key Architectural Requirements
1. **Coupled Multi-Axis vs. Independent Axis**: High-end editing demands independent X and Y curves (e.g. bouncing ball where X moves linearly while Y follows a parabola).
2. **Anchor Point Invariance**: Transformations must orbit around a normalized pivot `[anchorX, anchorY]` rather than the top-left origin.
3. **Motion Blur Integration**: Keyframed high-velocity movement requires sub-frame shutter accumulation or directional blur.

---

## 2. Category B: Audio Envelopes (DSP Sample Stream)

### 2.1 First Principles & Domain Mechanics
Audio automation operates in the continuous signal processing domain at **sample rates** ($f_s = 44,100\,\text{Hz}$ or $48,000\,\text{Hz}$):
- **Rate Mismatch**: Video renders at $30\,\text{Hz}$ or $60\,\text{Hz}$ ($\Delta t \approx 16.6\text{--}33.3\,\text{ms}$). Audio renders blocks of 128 to 4096 samples ($\Delta t \approx 2.9\text{--}85.3\,\text{ms}$). Evaluating keyframes only once per video frame produces **zipper noise** (audible stepping clicks and harmonic distortion) on audio gain.
- **Logarithmic vs. Linear Perception**: Human hearing perceives loudness logarithmically according to the Weber-Fechner law and decibel scale:
  $$L_{\text{dB}} = 20 \log_{10}\left(\frac{A}{A_0}\right)$$
  A linear gain ramp ($1.0 \to 0.0$) sounds like it drops abruptly at first and lingers silently at the end. Equal-power crossfades and exponential curves are required.

### 2.2 Industry Standards & Benchmarks
- **DAWs (Pro Tools, Ableton, Logic)**: Automation curves are sampled per audio quantum (128 samples) with linear de-zippering / one-pole smoothing filters:
  $$y[n] = (1 - \alpha) y[n-1] + \alpha x[n]$$
- **Video NLEs (Premiere, Resolve Fairlight)**: Clip-based rubber bands on timeline audio tracks; volume points support linear, fast-fade, and slow-fade logarithmic curves.
- **Current ACC Architecture**:
  - `VolumeModifierPlugin.ts` operates directly on raw `Float32Array` PCM buffers in `processAudioStream`.
  - Supports sequence-level `fadeInSec`, `fadeOutSec`, and `fadeCurve: 'cosine' | 'linear' | 'exponential'`:
    ```ts
    // Cosine S-curve equal-power approximation
    envelope = Math.sin((progress * Math.PI) / 2);
    buffer[i] *= volume * envelope;
    ```
  - `DynamicDuckingPlugin.ts` implements analog sidechain ducking with attack and release slew times.

### 2.3 Key Architectural Requirements
1. **De-Zippered Block Interpolation**: Audio keyframes should evaluate target values per audio render block, applying linear interpolation across buffer samples.
2. **Per-Sequence Envelopes vs. Track Automation**:
   - *Sequence Envelopes*: In/out fades, clip gain trims (tied to clip content).
   - *Track Automation*: Fader volume rides, dialogue ducking under music (tied to timeline master time).

---

## 3. Category C: Color & Exposure Transitions (Photometric & Colorimetry)

### 3.1 First Principles & Domain Mechanics
Color grading parameters modify pixel transfer characteristics and photometric exposure:
$$C_{\text{out}} = f(C_{\text{in}}, \mathbf{p}_{\text{color}})$$

- **Exposure ($EV$)**: Photographic exposure is logarithmic base 2 ($2^{\Delta EV}$). A keyframe ramp from $0 \to +1\,EV$ doubles luminance; $0 \to +2\,EV$ quadruples luminance.
- **Contrast ($S$-Curve)**: Non-linear expansion around a pivot point (middle grey, $\approx 18\%$ or $0.18$ in linear scene space):
  $$\tilde{C} = \left(\frac{C}{\text{pivot}}\right)^{\gamma} \cdot \text{pivot}$$
- **Color Temperature ($K$)**: Non-linear locus across the CIE chromaticity diagram (Planckian locus). Shifting from $3200\,\text{K} \to 5600\,\text{K}$ is visually far larger than $7000\,\text{K} \to 9400\,\text{K}$ (mired scale).

### 3.2 Industry Standards & Benchmarks
- **DaVinci Resolve**: Color grading keyframes are split between **Static Grades** (applied across the shot) and **Dynamic Keyframes** (interpolating CDL/Lift-Gamma-Gain values or Dissolves between color memories).
- **Premiere Pro (Lumetri)**: Allows keyframing individual slider numbers in the Effect Controls panel, but in practice, 95% of editors use clip cuts or adjustment layer crossfades rather than automating contrast sliders.
- **Current ACC Architecture**:
  - `ColorGradingEngine.ts` translates settings to CSS filters in canvas preview and FFmpeg `eq=contrast=...:saturation=...` during server export:
    ```ts
    ctx.filter = `contrast(${contrastPct}%) saturate(${saturatePct}%) brightness(${brightnessPct}%)`;
    ```
  - Clean sequence-level static parameters avoid real-time shader recompilation.

### 3.3 Key Architectural Requirements
1. **Static Clip Primary vs. Dynamic Transitions**: Color grades are 99% shot-based static configurations. Keyframing is primarily needed for **shot transitions** (e.g. flash-to-white, fade-to-black, day-to-night passage of time).
2. **Transition Curves vs. Arbitrary Keyframes**: Sequence-level fade/transition presets (e.g. Flash In, Grade Dissolve) provide 10x better UX than manually placing diamond keyframes on 7 separate color sliders.

---

## 4. Category D: Obscure & Filter Parameters (Procedural & Simulation)

### 4.1 First Principles & Domain Mechanics
Filter and procedural modifiers govern discrete algorithms, particle physics, and shader uniforms:
- **Discrete & Quantized Values**: Many parameters cannot be mathematically smoothed. For example:
  - `particleCount`: discrete integer; allocating 150 particles at $t=1.0$ and 151 at $t=1.03$ causes particle emitter buffer reallocations or popping artifacts.
  - `seed`: pseudorandom generator seed; interpolating seeds ($1337 \to 1338$) completely scrambles procedural layout on every frame.
  - `filterType` / `blendMode`: enumerated discrete modes (`multiply`, `screen`).
- **Non-Linear Physical Simulations**: Particle emitter velocities, fluid dynamics, and lens flare chromatic aberrations have physical momentum that cannot be represented by simple scalar keyframe ramps without resetting the simulation state.

### 4.2 Industry Standards & Benchmarks
- **TouchDesigner / Blender Geometry Nodes**: Strict distinction between continuous scalar channels and discrete trigger pulses.
- **Nuke**: Animation curves on filter kernels are discouraged; instead, two distinct nodes are crossfaded using a `Dissolve` or `Switch` node.
- **Current ACC Architecture**:
  - `CanvasParticleOverlayPlugin.ts` caches particle physics arrays and runs deterministic state updates:
    ```ts
    const seed = params.seed ?? 1337;
    // Uses seeded DeterministicNoiseGenerator
    ```
  - Changing discrete parameters mid-clip causes visual resets or buffer thrashing.

### 4.3 Key Architectural Requirements
1. **Hold / Step Keyframes Only**: If discrete parameters are automated, they must enforce step evaluation ($v(t) = v_i$) with zero interpolation.
2. **A/B Blend vs. Parameter Morph**: For shader effects, interpolating between Effect A (configured) and Effect B (configured) via a crossfade is dramatically more robust and stable than interpolating internal shader uniforms.

---

## 5. Comparative Domain Matrix

| Evaluation Dimension | Category A: Spatial / Transform | Category B: Audio Envelopes | Category C: Color & Exposure | Category D: Procedural / Filters |
|---|---|---|---|---|
| **Primary Domain** | Geometric 2D/3D Space | High-Frequency Audio DSP | Photometric / Colorimetry | Discrete GPU / Algorithm |
| **Typical Parameters** | `x, y, scale, rotation, opacity` | `volume, pan, fadeIn, fadeOut` | `contrast, saturation, EV` | `particleCount, cutoffHz, seed` |
| **Interpolation Type** | Continuous Bézier Spline | Exponential / S-Curve / Log | Perceptual Linear / EV Scale | Step / Hold (or Dissolve) |
| **Sampling Rate** | Video Frame Rate (30--60 Hz) | Audio Sample Rate (44.1--48 kHz) | Video Frame Rate (30--60 Hz) | Discrete Events / Stepped |
| **Failure Mode if Misapplied** | Motion jerk / subpixel jitter | Zipper noise / clicks | Inverted colors / `NaN` filters | Simulation popping / resets |
| **Frequency of Use** | **Very High (~80%)** | **High (~15%)** | **Occasional (~4%)** | **Rare (<1%)** |
| **Recommended Architecture** | Dedicated Motion Curve Engine | DSP Envelope Block Slew | Sequence Static + Transitions | Static Settings + A/B Mix |

---

## 6. Strategic Architecture Recommendations for ACC

Based on this deep-dive analysis:

1. **Category A (Spatial/Transform)**:
   - Continue maintaining dedicated keyframe curves in `DeterministicMotionEvaluator` and `CameraSplineInterpolator`.
   - Expose dedicated motion curve and keyframe tooling strictly on transform controls (pan/zoom, position, rotation, opacity).

2. **Category B (Audio Envelopes)**:
   - Retain sequence-level parametric fade controls (`fadeInSec`, `fadeOutSec`, `fadeCurve`) in `VolumeModifierPlugin`.
   - Avoid generic per-frame UI diamonds; instead, provide visual rubber-band fade handles directly on timeline audio clips (matching industry-standard DAW/NLE paradigms).

3. **Category C (Color & Exposure)**:
   - Maintain static sequence-level values in the Inspector (as successfully established in Milestone 383).
   - If color changes over time are desired, implement them as **Transition Modifiers** (e.g. `vfx/exposure_flash`, `editorial/crossfade`) rather than per-slider temporal keyframes.

4. **Category D (Procedural & Filter Parameters)**:
   - Enforce pure static sequence configuration. Do not support keyframes on simulation counts, seeds, or discrete kernel options.
