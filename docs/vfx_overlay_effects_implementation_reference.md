# Procedural VFX Overlay Effects Engine - Technical Implementation Reference

## Executive Overview

This document provides a comprehensive technical reference for the refactored, procedural VFX overlay engine in `@acc/effect-engines/overlay-effects`. The engine provides high-performance, zero-disk RGBA frame generation piped directly to FFmpeg encoders, utilizing modern software design patterns (Strategy, Factory, Decorator, Composite, Adapter, Pipeline, Observer).

---

## 1. System Architecture & Component Design

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             CLI & Engine Layer                                  │
│             (overlay-effects-cli.ts / BaseEffectEngine subclasses)               │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            VFXSimulatorFactory                                   │
│            (Maps effect & variant names to IVFXSimulatorStrategy)                │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           SeamlessLoopDecorator                                  │
│               (Enforces continuous modulo/phase time wrapping)                   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        Concrete IVFXSimulatorStrategy                            │
│   (RainStrategy, SnowStrategy, DustStrategy, FogStrategy, LeavesStrategy, etc.) │
└───────────────────────────┬────────────────────────────┬─────────────────────────┘
                            │                            │
                            ▼                            ▼
┌──────────────────────────────────────┐     ┌─────────────────────────────────────┐
│       Core Physics & Solvers         │     │         Canvas Adapter              │
│  - ParticlePool (Zero-GC memory)     │     │      (NapiRsCanvasAdapter)          │
│  - BoidsSolver (Flocking mechanics)  │     └──────────────────┬──────────────────┘
│  - CurlNoise (Vector field flow)     │                        │
│  - Grid2DSolver (Eulerian fluid)     │                        ▼
│  - VoronoiFracture (Cell breaking)   │     ┌─────────────────────────────────────┐
└──────────────────────────────────────┘     │      Zero-Disk FFmpeg Pipeline      │
                                             │     (PassThrough -> stdin stream)   │
                                             └─────────────────────────────────────┘
```

---

## 2. Core Physics Solvers & Math Engines

The core physics engines reside under `packages/effect-engines/src/overlay-effects/simulators/`:

### 2.1 Particle Memory Pool (`ParticlePool`)
* **Location**: `simulators/particles/particle-pool.ts`
* **Purpose**: Prevents Garbage Collection (GC) latency during high-speed frame rendering. Pre-allocates fixed particle arrays and manages active particle counts via swapping.
* **Key Methods**:
  - `spawn(initialProps)`: Spawns particle into active list.
  - `release(index)`: Swaps released particle with last active particle in $O(1)$ time.
  - `getActiveParticles()`: Returns current active slice.

### 2.2 Swarm Logic Flocking Solver (`BoidsSolver`)
* **Location**: `simulators/particles/boids-solver.ts`
* **Purpose**: Simulates emergent flocking behaviors for swarms (insects, leaves, debris, sparks) based on Craig Reynolds' Boids algorithm.
* **Math Formulas**:
  - **Separation**: $\vec{F}_{\text{sep}} = \sum \frac{\vec{x}_i - \vec{x}_j}{\|\vec{x}_i - \vec{x}_j\|^2}$
  - **Alignment**: $\vec{F}_{\text{align}} = \text{Avg}(\vec{v}_{\text{neighbors}}) - \vec{v}_i$
  - **Cohesion**: $\vec{F}_{\text{coh}} = \text{Avg}(\vec{x}_{\text{neighbors}}) - \vec{x}_i$

### 2.3 Divergence-Free Vector Noise (`CurlNoise` & `SimplexNoise`)
* **Location**: `simulators/noise/curl-noise.ts`
* **Purpose**: Computes 2D/3D divergence-free curl vector fields to simulate turbulent gas, swirling embers, and air currents without particle clustering.
* **Math Formula**:
  $$\vec{v}_x = \frac{\partial \Psi}{\partial y}, \quad \vec{v}_y = -\frac{\partial \Psi}{\partial x}$$

### 2.4 Eulerian Fluid Grid Solver (`Grid2DSolver`)
* **Location**: `simulators/fluids/grid2d-solver.ts`
* **Purpose**: Solves 2D Navier-Stokes equations on a voxel grid for smoke, mist, and fluid advection.
* **Key Methods**:
  - `addDensity(x, y, amount)`: Injects fluid density.
  - `addVelocity(x, y, vx, vy)`: Injects directional forces.
  - `step()`: Solves linear pressure system (`lin_solve`), advects velocity fields, and diffuses density.

### 2.5 Voronoi Cell Fracturing Engine (`VoronoiFracture`)
* **Location**: `simulators/destruction/voronoi-fracture.ts`
* **Purpose**: Fractures 2D geometry procedurally using Voronoi cells and glue constraint networks for film damage, glass shatters, and debris impact.

---

## 3. Design Patterns Applied

| Pattern Name | Core Interface / Class | Responsibility |
| :--- | :--- | :--- |
| **Strategy** | `IVFXSimulatorStrategy` / `BaseVFXSimulator` | Encapsulates specific simulation and rendering algorithms for each effect type. |
| **Factory** | `VFXSimulatorFactory` | Instantiates and configures simulator strategy instances based on effect and variant names. |
| **Decorator** | `SeamlessLoopDecorator`, `MotionBlurDecorator` | Wraps any strategy to enforce seamless modulo/phase loop wrapping or accumulation blur. |
| **Composite** | `VFXCompositeLayerStack` | Chains multiple overlay video layers into complex FFmpeg `filter_complex` graphs. |
| **Adapter** | `CanvasAdapter` (`NapiRsCanvasAdapter`) | Decouples Canvas 2D operations from native node canvas backends. |
| **Pipeline** | `EffectPipeline` | Stream raw RGBA frame buffers into FFmpeg stdin (`PassThrough` stream). |

---

## 4. Complete Strategy & Effect Catalog Reference

All 28 overlay effect categories map to dedicated strategies:

| Effect Category | Class Name | File Path | Core Algorithm / Physics |
| :--- | :--- | :--- | :--- |
| `rain` | `RainSimulatorStrategy` | `strategies/rain-strategy.ts` | Semi-implicit kinematic integration + Z-depth parallax |
| `snow` | `SnowSimulatorStrategy` | `strategies/snow-strategy.ts` | Curl noise air turbulence + sine wave drift |
| `dust` | `DustSimulatorStrategy` | `strategies/dust-strategy.ts` | Ambient micro-flocking particles + alpha pulse |
| `fog` / `smoke` | `FogSimulatorStrategy` | `strategies/fog-strategy.ts` | Grid2DSolver Eulerian density advection |
| `leaves` | `LeavesSimulatorStrategy` | `strategies/leaves-strategy.ts` | Boids flocking + 3D pendulum oscillation |
| `embers` | `EmbersSimulatorStrategy` | `strategies/embers-strategy.ts` | Buoyant heat sparks + Curl noise turbulence |
| `fire` | `FireSimulatorStrategy` | `strategies/fire-strategy.ts` | fBm noise heightmap gradient flames |
| `film_damage` | `FilmDamageSimulatorStrategy` | `strategies/film-damage-strategy.ts` | Voronoi fracture spots + hairline scratches |
| `bubbles` | `BubblesSimulatorStrategy` | `strategies/bubbles-strategy.ts` | Buoyant rising spheres + phase-locked sway |
| `confetti` | `ConfettiSimulatorStrategy` | `strategies/confetti-strategy.ts` | 3D flapping paper rigid body rotation |
| `floating_hearts` | `FloatingHeartsSimulatorStrategy` | `strategies/floating-hearts-strategy.ts` | Bezier path followers + pulsing scale |
| `lightning` | `LightningSimulatorStrategy` | `strategies/lightning-strategy.ts` | Fractal branching lightning bolts |
| `rain_on_glass` | `RainOnGlassSimulatorStrategy` | `strategies/rain-on-glass-strategy.ts` | Droplet surface tension + sliding physics |
| `digital_glitch` | `DigitalGlitchSimulatorStrategy` | `strategies/digital-glitch-strategy.ts` | Block datamosh + RGB channel splitting |
| `camera_ui` | `CameraUISimulatorStrategy` | `strategies/camera-ui-strategy.ts` | Camcorder REC, CCTV, and DSLR viewfinders |
| `vhs` | `VHSSimulatorStrategy` | `strategies/vhs-strategy.ts` | Analog tracking lines + signal noise |
| `matrix_rain` | `MatrixRainSimulatorStrategy` | `strategies/matrix-rain-strategy.ts` | Digital code stream glyph drops |
| `speed_lines` | `SpeedLinesSimulatorStrategy` | `strategies/speed-lines-strategy.ts` | Manga radial burst & horizontal rush vectors |
| `sci_fi_hud` | `SciFiHUDSimulatorStrategy` | `strategies/sci-fi-hud-strategy.ts` | Target lock reticle & data ring HUD |
| `god_rays` | `GodRaysSimulatorStrategy` | `strategies/god-rays-strategy.ts` | Volumetric light shaft scattering |
| `grunge_texture` | `GrungeTextureSimulatorStrategy` | `strategies/grunge-texture-strategy.ts` | Stop-motion paper halftone noise |
| `lens_flare` | `LensFlareSimulatorStrategy` | `strategies/lens-flare-strategy.ts` | Anamorphic streak & radial flares |
| `light_leak` | `LightLeakSimulatorStrategy` | `strategies/light-leak-strategy.ts` | Vintage film burn edge lighting |
| `audio_spectrum` | `AudioSpectrumSimulatorStrategy` | `strategies/audio-spectrum-strategy.ts` | Oscillating EQ frequency spectrum bars |
| `bokeh` | `BokehSimulatorStrategy` | `strategies/bokeh-strategy.ts` | Drifting out-of-focus optical circles |
| `starfield` | `StarfieldSimulatorStrategy` | `strategies/starfield-strategy.ts` | Twinkling night sky / 3D warp speed vectors |

---

## 5. Composite Layer Stacking Engine (`VFXCompositeLayerStack`)

The composite stacker in `stacker.ts` allows combining multiple overlay video layers into a single output stream using the Composite pattern:

```typescript
import { VFXCompositeLayerStack } from './stacker';

const stack = new VFXCompositeLayerStack('main_video.mp4');
stack.addLayer({ videoPath: 'rain_storm_5s.mp4', overlayMethod: 'screen' });
stack.addLayer({ videoPath: 'fog_ground_mist_7s.mp4', overlayMethod: 'screen' });
stack.addLayer({ videoPath: 'film_damage_3s.mp4', overlayMethod: 'overlay' });

await stack.renderComposite('final_output.mp4');
```

The stacker inspects companion JSON metadata files (`rain_storm_5s.json`) automatically to select optimal FFmpeg filter graph chains (`blend=all_mode=screen`, `blend=all_mode=overlay`, or `overlay=shortest=1`).

---

## 6. Testing & Quality Assurance

Unit tests are located at `packages/effect-engines/src/overlay-effects/__tests__/procedural_vfx_simulators.test.ts`.

Run unit tests using Bun:
```bash
bun test packages/effect-engines/src/overlay-effects/__tests__/procedural_vfx_simulators.test.ts
```

Tests cover:
1. `ParticlePool` zero-GC memory allocation and release.
2. `BoidsSolver` flocking force updates.
3. `CurlNoise` vector field divergence checks.
4. `Grid2DSolver` Eulerian fluid advection and density updates.
5. `VoronoiFracture` seed generation, polygon points calculation, and impact cell breaking.
6. `SeamlessLoopDecorator` transparent time wrapping.
