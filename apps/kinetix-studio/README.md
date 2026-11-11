# Kinetix Studio v4.0

> Modular Motion Poster Design System & Studio Suite engineered with React, shadcn/ui, Tailwind CSS, TypeScript, and Web-standard APIs.

## 🚀 Features

- **24 Spatial Layout Skeletons**: Modular Bento, Swiss Asymmetric, Split Stage, Full-Bleed, Brutalist Cage, Capsule Arch Portal, Cyberpunk HUD, and 17 more.
- **12 Strategy-Pattern Ambient Shaders**: 3D Orbital Knot, Silk Waves, Brutalist Perspective Grid, Data Rain Matrix, 4D Tesseract Cube, Topo Horizon, Laser Harmonograph, Golden Spiral Vortex, Liquid Plasma Orbs, Plexus Constellation, Sonar Radar, and Op-Art Moiré.
- **12 Hero Subjects & 2.5D Breakout**: Cyber Runner Sneaker, Spatial Headphone, Luxury Perfume, Tourbillon Chronograph, Neural AR Visor, Liquid Chrome Monolith, Holographic Cyber Skull, 180g Vinyl, and 4 Bodymovin / Lottie SVG rigs.
- **Physics & Easing Engine**: 12 custom easing curves (Expo-out Snap, Damped Spring, Strobe-safe ≤3Hz, Anime Cel 12fps, Bi-phasic Heartbeat, and more).
- **12 Kinetic Typography Movement Engines**: Variable Weight Wave, Elastic Tracking, 3D Perspective Shear, Brutalist Slide Stagger, Cylinder Flip, Chromatic RGB Glitch, and more with automatic WCAG scrim guards.
- **Web Audio API Synth Engine**: Real-time 909 sub-bass kick & acid sawtooth pluck sequencer synchronized with the BPM clock.
- **WinterTC Web-Standard Media Export**: One-click composite video renderer generating `.webm` video captures using WHATWG `MediaRecorder`, `Blob`, and `AbortController`.
- **High-Resolution PNG Snapshot Exporter**: 1080p+ composite snapshot generator.
- **Template Vault**: 24 full production one-click templates across Music, Fashion, Tech, and Cinema.
- **Multi-Format Responsive Matrix Test**: Live 4-up stage simulation across 9:16, 4:5, 1:1, and 16:9 formats with automated batch variant cycling.

---

## 📁 Architecture Overview

```
kinetix-studio/
├── src/
│   ├── types/                     # Strict erasable domain contracts
│   │   ├── spatial.ts             # Aspect ratios & spatial skeleton specs
│   │   ├── motion.ts              # Temporal choreo, cadences & easings
│   │   ├── shader.ts              # Shader context & strategy contracts
│   │   ├── hero.ts                # Hero subject IDs & category models
│   │   ├── studio.ts              # Master StudioState & Context contracts
│   │   └── preset.ts              # Template presets & brand archetypes
│   ├── lib/                       # Utility & defense libraries
│   │   ├── utils.ts               # cn() class merger
│   │   ├── safe-canvas-2d.ts      # SafeCanvas2D defensive geometry adapter
│   │   ├── color.ts               # WCAG 2.2 contrast & palette synthesizer
│   │   ├── schema.ts              # 3-layer declarative schema generator
│   │   └── export-video.ts        # WHATWG video & snapshot capture
│   ├── constants/                 # Curated registries & presets
│   │   ├── spatial-layouts.ts     # 24 spatial layout definitions
│   │   ├── shaders.ts             # 12 ambient shader definitions
│   │   ├── heroes.ts              # 12 hero subject definitions
│   │   ├── easings.ts             # 12 easing curves & formulas
│   │   ├── kinetic-types.ts       # 12 kinetic typography modes
│   │   ├── archetypes.ts          # 12 brand archetypes
│   │   ├── palettes.ts            # Curated WCAG palettes
│   │   ├── sample-events.ts       # Event payloads for randomizer
│   │   ├── template-vault.ts      # 24 complete production presets
│   │   └── initial-state.ts       # Canonical default StudioState
│   ├── engine/                    # Math, rendering & synthesis engines
│   │   ├── choreography.ts        # 3-phase and 4-act temporal math
│   │   ├── spatial-skeleton.ts    # 24-layout spatial skeleton reflow
│   │   ├── audio-synth.ts         # Web Audio API 909 analog synthesizer
│   │   ├── shaders/               # 12 individual ambient shader strategies
│   │   └── heroes/                # 12 hero subject renderers
│   ├── context/                   # Centralized studio state
│   │   ├── studio-context.ts      # StudioContext & useStudio() hook
│   │   └── studio-provider.tsx    # State provider & RAF loop
│   ├── components/                # Modular React/shadcn UI components
│   │   ├── ui/                    # Button, Badge, SwitchRow, Modal, Toast
│   │   ├── header/                # StudioHeader, ArchetypeBar, QuickActionBar
│   │   ├── inspector/             # Spatial, Brand, Motion & Payload tabs
│   │   ├── viewport/              # StageViewport, Canvas stage & overlays
│   │   ├── timeline/              # Transport controls, Phase jumps, Scrubber
│   │   ├── telemetry/             # QA audit card, BPM strip, Schema viewer
│   │   └── modals/                # Template Vault, Lottie Hub, Matrix Test
│   ├── App.tsx                    # Studio application shell
│   ├── main.tsx                   # DOM mounting entry
│   └── index.ts                   # Public library barrel export
```

---

## 🛠️ Development & Usage

### Standalone Studio Development

```bash
# Install dependencies
bun install   # or pnpm install

# Start Vite dev server
bun run dev

# Run automated unit/integration test suite
bun test

# Strict TypeScript type check
bun run typecheck

# Production build
bun run build
```

### Reusable Library Consumption

You can import any part of the Kinetix system directly:

```tsx
import {
  StudioProvider,
  useStudio,
  MotionPosterStage,
  TimelineTransport,
  SPATIAL_LAYOUTS,
  computeChoreography
} from './kinetix-studio';

export function CustomPosterViewer() {
  return (
    <StudioProvider>
      <div className="h-screen w-full bg-zinc-950 flex flex-col">
        <MyPosterCanvas />
        <TimelineTransport />
      </div>
    </StudioProvider>
  );
}
```

