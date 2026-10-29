# Deep Research & First-Principles Synthesis: Enriching `TimeSpaceStateMachine` Motion Templates

## Executive Summary
The **Time-Space State Machine** (`TimeSpaceStateMachine.ts` + `DeterministicPtsEngine.ts` + `StatelessHashNoise.ts`) in `@acc/core-isomorphic` is one of the most powerful procedural rendering architectures in the monorepo. It marries:
1. **Virtual Time Orchestration**: Deterministic GSAP timelines structured into discrete phases (`enter`, `idle`, `exit`) or multi-track timelines with boundary policies (`loop`, `pingpong`, `clamp`, `once`).
2. **Computational Space Geometry**: Point lattice mathematics, Bézier splines, Delaunay/Voronoi tessellation, and noise curl vectors in `pts`.
3. **Deterministic Stateless Execution**: Reproducible math at any arbitrary seek frame $(t_{\text{frame}})$ with zero accumulated drift and zero memory leakage.

Currently, `TimeSpaceRegistry` only registers 3 basic prototypes: `callout_leader`, `kinetic_title`, and `particle_ambient`. 

This deep research document analyzes industry motion graphics standards (Broadcast HUDs, Sci-Fi FUI, Kinetic Infographics, Cyberpunk Overlays, Tech Lower-Thirds) and designs **8 production-grade motion templates** that unlock the full mathematical and aesthetic potential of the engine.

---

## 1. First-Principles Capabilities of the Core Stack

Before designing templates, we inventory the underlying primitives available in `@acc/core-isomorphic`:

```mermaid
graph TD
    subgraph Temporal Engine
        GSAP["GSAP Timeline (Virtual Clock)"]
        Boundary["solveTemporalBoundary (loop, pingpong, clamp, once)"]
        Phases["Phase Architecture (enter, idle, exit)"]
    end

    subgraph Spatial Geometry Engine
        Pts["Pt, Group, Line, Polygon, Circle, Bound"]
        Splines["Curve.bezier (Cubic & Cardinal Splines)"]
        Tessellation["Delaunay & Voronoi Tessellation"]
        Noise["StatelessHashNoise (hash, noise2D, curlNoise2D)"]
    end

    subgraph Render Adapters
        PtsForm["DeterministicPtsForm (Canvas2D Path/Stroke/Fill)"]
        WebGLBuffers["Float32Array Vertex & Color Buffers"]
    end

    Temporal Engine --> Compositor["TimeSpaceStateMachine.seek()"]
    Spatial Geometry Engine --> Compositor
    Compositor --> RenderAdapters["TimeSpaceSnapshot"]
    RenderAdapters --> Output["Canvas / WebGL / MP4 Output"]
```

1. **`Curve.bezier(pts, tension)`**: Generates smooth parametric curves through control points with progress-based trimming (`curve.slice(0, count)`), ideal for self-drawing telemetry vectors, radar sweeps, and connector lines.
2. **`Delaunay.from(pts)` / `Voronoi`**: Transforms a dynamic particle cloud into a connected geometric mesh, plexuses, or shattered crystal facets with $O(N \log N)$ complexity.
3. **`StatelessHashNoise.curlNoise2D`**: Produces smooth, divergence-free rotational vector fields, perfect for organic turbulent floating particles, magnetic anomalies, and smoke wisps.
4. **`Circle` & `Polygon` math**: Instantaneous mathematical intersection, polygon bounding boxes, and convex hulls.

---

## 2. The 8 New Motion Graphic Templates

We propose 8 distinct templates grouped into 4 high-value visual categories:

```
+-----------------------------------------------------------------------------------+
|                        8 EXPANDED MOTION TEMPLATES                                |
+-----------------------+------------------------+----------------------------------+
| CATEGORY              | TEMPLATE ID            | CORE MATHEMATICAL MECHANICS      |
+-----------------------+------------------------+----------------------------------+
| I. Broadcast & FUI    | 1. hud_tactical_reticle| Concentric rings, tick marks,    |
|    Telemetry          |                        | rotating degree dial, crosshairs |
|                       | 2. callout_multitarget | Multi-point leader lines with    |
|                       |                        | simultaneous telemetry readouts  |
+-----------------------+------------------------+----------------------------------+
| II. Data & Network    | 3. network_plexus      | Delaunay dynamic triangulation,  |
|     Visualizations    |                        | distance-faded edge connections  |
|                       | 4. audio_waveform_ring | Radial trigonometric frequencies,|
|                       |                        | reactive audio visualizer ring   |
+-----------------------+------------------------+----------------------------------+
| III. Kinetic Layouts  | 5. cyber_lower_third   | Glitch split box, corner bracket |
|      & Lower-Thirds   |                        | framing, animated accent bars    |
|                       | 6. dynamic_countdown   | Circular progress sweep with     |
|                       |                        | digit tick down & spring pop-in  |
+-----------------------+------------------------+----------------------------------+
| IV. Procedural VFX    | 7. energy_shield_hex   | Hexagonal lattice tessellation   |
|      Overlays         |                        | with impact ripple waves         |
|                       | 8. glitch_data_stream  | Vertical binary/hex data matrix  |
|                       |                        | rain with phase-based dissipation|
+-----------------------+------------------------+----------------------------------+
```

---

### Template 1: `hud_tactical_reticle` (Military & Sci-Fi FUI Targeting System)
- **Visual Description**: Concentric high-tech targeting reticle with animated outer degree markers, rotating tick arcs, a center crosshair, and real-time range/azimuth telemetry readouts.
- **GSAP State**:
  - `reticleScale`: elastic pop-in ($0 \to 1.0$)
  - `outerRotation`: steady clockwise rotation ($0 \to 360^\circ$)
  - `innerCounterRotation`: steady counter-clockwise oscillation
  - `radarSweepAngle`: continuous $0 \to 2\pi$ radar sweep
  - `alpha`: fade in/out
- **Pts Geometry**:
  - Concentric `Circle` rings with 8 segmented arc gaps.
  - Radial `Line` tick marks spaced every $30^\circ$ and $15^\circ$.
  - Corner HUD framing brackets `[L-brackets]` framing the target.
- **Use Cases**: Video tracking subject, targeting crosshair in action/sci-fi scenes, gaming UI overlay.

### Template 2: `callout_multitarget` (Multi-Point Intelligence Annotation)
- **Visual Description**: A master telemetry card connected to 2 or 3 independent target tracking nodes simultaneously with dynamically curving leader lines.
- **GSAP State**:
  - `drawProgress`: staggered $0 \to 1$ drawing of leader line A, B, and C.
  - `nodePulse`: independent sine oscillation for each target node.
  - `cardDeploy`: unfolding of data readout box.
- **Pts Geometry**:
  - Multi-target spline curves: `Curve.bezier([anchorA, elbowA, cardPoint])`.
  - Floating target nodes with pulsing concentric rings.
  - Data table polygon card with connecting brackets.
- **Use Cases**: Explainer videos, product feature breakdown, drone surveillance overlays.

### Template 3: `network_plexus` (Neural Network & Constellation Field)
- **Visual Description**: Autonomous drifting particles that dynamically form glowing connection lines whenever two nodes come within proximity distance, with subtle Voronoi background tinting.
- **GSAP State**:
  - `turbulence`: curl noise intensity ($1.0 \to 2.5$)
  - `connectionThreshold`: proximity distance for drawing lines
  - `clusterExpansion`: overall lattice scale
- **Pts Geometry**:
  - `StatelessHashNoise.curlNoise2D` moves 30--50 points organically without collisions.
  - Distance matrix evaluation: pairs with $d < \text{threshold}$ draw lines whose `lineWidth` and `alpha` scale with $\frac{\text{threshold} - d}{\text{threshold}}$.
  - `Delaunay.from(pts)` computes triangular mesh surfaces with low-opacity alpha fills.
- **Use Cases**: Tech video backgrounds, AI/neural network title sequences, documentary b-roll overlays.

### Template 4: `audio_waveform_ring` (Circular Cyber Audio Visualizer)
- **Visual Description**: Circular radial audio oscilloscope with oscillating frequency peaks radiating outward from an animated circular crest.
- **GSAP State**:
  - `ringRadius`: baseline circle size ($r_0$)
  - `waveEnergy`: overall amplitude scaling
  - `rotationOffset`: slow ambient spin
- **Pts Geometry**:
  - 64 radial samples: $p_i = [c_x + (r_0 + \Delta r_i) \cos(\theta_i), c_y + (r_0 + \Delta r_i) \sin(\theta_i)]$.
  - $\Delta r_i = A \cdot \text{noise2D}(\text{seed}, \text{frame}, i \cdot 0.2)$.
  - Closed polygon loop rendered with cyan neon glow and inner translucent core.
- **Use Cases**: Music visualizers, podcast video clips, AI assistant voice feedback ring (Siri/JARVIS style).

### Template 5: `cyber_lower_third` (Broadcast & Streamer Tech Lower-Third)
- **Visual Description**: Sleek, high-contrast lower-third banner with corner chamfers, animated accent line wipes, category badge pill, and kinetic subtitle reveal.
- **GSAP State**:
  - `barWipe`: $0 \to 1.0$ horizontal line slice with overshoot.
  - `cardHeight`: vertical expansion of frosted acrylic background.
  - `textSlide`: text reveal with clipping mask / offset.
  - `badgeAlpha`: accent tag pop.
- **Pts Geometry**:
  - Chamfered rectangular polygon (`Polygon.fromRectangle` with cut corners).
  - Cyan/amber gradient divider lines.
  - Category pill badge and dual-level typography (Title + Role/Handle).
- **Use Cases**: YouTube interviews, esports streams, corporate speaker introductions.

### Template 6: `dynamic_countdown` (Cinematic Timer & Metric Dial)
- **Visual Description**: Circular radial progress arc with numeric second/millisecond readout, ticking tick marks, and elastic completion pulse.
- **GSAP State**:
  - `sweepProgress`: $1.0 \to 0.0$ radial arc angle ($2\pi \to 0$).
  - `tickPulse`: scale bump on every full second transition ($1.2 \to 1.0$).
  - `colorShift`: transitions from cyan $\to$ yellow $\to$ alert red as timer nears 0.
- **Pts Geometry**:
  - Arc path segmented into 60 circular segments.
  - Numerical monospace display centered within the dial.
  - Outer orbital marker tracking the leading edge of the arc.
- **Use Cases**: High-energy workout timers, challenge videos, dramatic suspense countdowns.

### Template 7: `energy_shield_hex` (Sci-Fi Hexagonal Force Field)
- **Visual Description**: Honeycomb hexagonal grid with localized energy ripples traveling outward from an impact coordinate.
- **GSAP State**:
  - `impactWave`: expanding radial distance wave from target center.
  - `hexGlow`: per-cell illumination falloff.
  - `shieldAlpha`: global barrier visibility.
- **Pts Geometry**:
  - Hexagonal tiling grid computed via regular polygons:
    $$\mathbf{p}_{\text{hex}} = [x + r \cos(k \pi/3), y + r \sin(k \pi/3)], \quad k \in [0, 5]$$
  - Each cell's brightness is modulated by distance to impact wave.
- **Use Cases**: Sci-Fi VFX, gaming clips, protected status indicators, tech transitions.

### Template 8: `glitch_data_stream` (Cyberpunk Matrix Telemetry Rain)
- **Visual Description**: Vertical columns of glyphs and hex coordinates falling at staggered velocities with high-speed character flickering and glowing leading heads.
- **GSAP State**:
  - `fallProgress`: vertical position of leading cursor per column.
  - `flickerSeed`: character randomize cycle.
  - `dissipation`: column fade out.
- **Pts Geometry**:
  - Column lattice with monospace glyph rendering.
  - Leading head rendered in glowing white/green, trailing characters fading to deep emerald.
  - Horizontal scanline glitch slices triggered deterministically by hash noise.
- **Use Cases**: Hacker/terminal sequences, Cyberpunk intro titles, tech transitions.

---

## 3. Mathematical & Algorithmic Blueprint

### 3.1 Proximity Delaunay Network Algorithm (Template 3)
```ts
// Evaluated deterministically inside generateGeometry
const pts: Pt[] = [];
for (let i = 0; i < count; i++) {
  const normX = StatelessHashNoise.hash(seed, 0, i * 3);
  const normY = StatelessHashNoise.hash(seed, 0, i * 3 + 1);
  const curl = StatelessHashNoise.curlNoise2D(seed, time.frame, normX * 1.5, normY * 1.5);
  pts.push(space.toPixels([normX + curl.x * state.turbulence, normY + curl.y * state.turbulence]));
}

// Compute active proximity lines with alpha falloff
const lines: Group[] = [];
for (let i = 0; i < pts.length; i++) {
  for (let j = i + 1; j < pts.length; j++) {
    const dist = pts[i].$subtract(pts[j]).magnitude();
    if (dist < thresholdPx) {
      const alpha = 1.0 - (dist / thresholdPx);
      lines.push(new Group(pts[i], pts[j]).setAttrs({ alpha }));
    }
  }
}
```

---

## 4. Implementation Plan in Monorepo

1. **Phase 1: Implement Templates in `TimeSpaceRegistry.ts` (`@acc/core-isomorphic`)**:
   - Register all 8 templates in `TimeSpaceRegistry.registerDefaults()`.
   - Ensure 100% deterministic mathematical execution via `StatelessHashNoise` and `pts` vector operations.
   - Zero DOM / zero window dependencies.

2. **Phase 2: Update Schema in `TimeSpaceModifierPlugin.ts` (`@acc/ir`)**:
   - Expand the `templateId` select options to include all 8 templates.
   - Provide clean parameter defaults for each template.

3. **Phase 3: Studio Inspector & Catalog Integration (`apps/studio`)**:
   - Update `modifierCatalog.ts` with template descriptions.
   - Enable template selection dropdown in the Right Inspector.

4. **Phase 4: Automated Verification**:
   - Add comprehensive tests in `autogenerated-tests/timespace_modifier_templates.test.ts` verifying all templates seek, evaluate geometry, and render onto mock canvas contexts across all 4 boundary policies (`loop`, `pingpong`, `clamp`, `once`) without throwing.
