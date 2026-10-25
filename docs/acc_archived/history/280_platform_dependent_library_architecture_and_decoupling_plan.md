# History Item 280: Platform-Dependent Native Library Decoupling & Architecture Modernization Plan

- **Task**: Platform-Dependent Native Library Decoupling & Architecture Modernization Plan (`@napi-rs/canvas`, `bun:ffi`, `dlopen`)
- **Date**: 2026-10-19
- **Scope**: Core Architecture / Monorepo Isolation / Native Decoupling / Parity Harness
- **Backlog**: [`../backlogs/036_platform_dependent_library_decoupling.md`](../backlogs/036_platform_dependent_library_decoupling.md)

---

## 1. Overview
Conducted comprehensive architectural analysis and design session to establish the definitive blueprint for isolating and organizing platform-dependent libraries (`@napi-rs/canvas`, `bun:ffi`, `dlopen`, FFmpeg C shared libraries) across the isomorphic monorepo.
Guarantees clean separation between native server rendering (Bun/Node CLI) and browser client authoring (Studio Vite), preventing bundler failures, eliminating tight coupling, and establishing dual-layer regression prevention.

---

## 2. Key Architectural Decisions & Patterns
1. **Monorepo Package Boundary Splitting**:
   - `@acc/core-isomorphic`: Pure TypeScript interfaces (`ICanvasInstance`, `ICanvasAdapter`, `IMediaEngineStrategy`, `IVideoDecoder`) and abstract factories (`UniversalCanvasProvider`, `MediaEngineRegistry`). Free of native C or Node/Bun binary imports.
   - `@acc/core-native`: Encapsulates server-only native bindings (`@napi-rs/canvas`, `bun:ffi`, `FFmpegManager`, `NapiCanvasAdapter`, `BunFFIEngineStrategy`).
   - `@acc/core-web`: Encapsulates browser implementations (`HTMLCanvasElement`, `OffscreenCanvas`, `WebCanvasAdapter`, `MediabunnyClientStrategy`).
2. **Abstract Factory & Strategy Pattern**:
   - Universal Canvas and Media Engines exposed via registries (`UniversalCanvasProvider`, `MediaEngineRegistry`).
   - Replaces ~20 legacy direct imports of `@napi-rs/canvas` across CLI pipelines, effect engines, and exporters to use `UniversalCanvasProvider.createCanvas()`.
3. **Inversion of Control (IoC) Bootstrap Lifecycle**:
   - Native adapters register at CLI/server entrypoints; Web adapters register at Studio/browser entrypoints.
4. **Dual-Layer Regression Guardrails**:
   - **Compile-time**: ESLint `no-restricted-imports` + Vite build validation preventing `.node` / `bun:ffi` pollution.
   - **Runtime Parity**: Parity test harness asserting matching pixel buffers, dimensions, and container metadata between web and native implementations.

---

## 3. Reference Artifacts
- Plan Artifact: `implementation_plan.md` (Approved by user)
- Macro-Epic: [`docs/backlogs/036_platform_dependent_library_decoupling.md`](../backlogs/036_platform_dependent_library_decoupling.md)
