# Implementation Plan - Isomorphic Canvas Provider & Unified Universal Audio Mixer

## Overview
This implementation unifies the media foundation across browser client runtimes (Studio Vite) and native headless server runtimes (Bun / Node FFI). It replaces fragmented `@napi-rs/canvas` imports with `UniversalCanvasProvider`, eliminates redundant mixer abstractions by turning `DecoupledAudioMixer` into a facade over `UniversalAudioMixer`, and guarantees that no native C or Node-only packages leak into browser bundles.

## Key Changes
1. **Universal Audio Mixer Master Bus Architecture**:
   - `UniversalAudioMixer.ts` in `packages/ir` serves as the sole audio mixing/muxing master bus.
   - Implemented `mixTimeline` and `exportToWav`.
   - `DecoupledAudioMixer.ts` refactored into a thin backward-compatible facade delegating directly to `UniversalAudioMixer`.
2. **Isomorphic Canvas Provider Integration**:
   - Replaced direct `@napi-rs/canvas` imports across `IRMasterRenderer`, `Depth3DPlugin`, `Camera3DPlugin`, and `CanvasParticleOverlayPlugin` with `UniversalCanvasProvider.createCanvas()` and `CanvasAssetLoader.loadImage()`.
3. **Browser Bundle Isolation & Zero Node/FFI Leakage**:
   - Ensured `apps/studio` and browser packages strictly import from `@acc/ir/client` and `@acc/effect-engines/client`.
   - Made `MediabunnyClientSink` safe for browser packaging by removing top-level static `fs`/`path` imports.
   - Updated `ProceduralAudioSynthesizer` bridge to re-export from `@acc/ir/client`.
   - Configured Vite rollup externals in `apps/studio/vite.config.ts`.
