# Integration Master Plan: Iteration 26 - Isomorphic Platform & Feature Detection with Synchronized Registry Defaults

**Target Systems:**  
- `@acc/core-isomorphic` (`packages/core-isomorphic/src/platform`, `packages/core-isomorphic/src/canvas`, `packages/core-isomorphic/src/media-engine`, `packages/core-isomorphic/src/cache`)  
- `@acc/core-web` (`packages/core-web/src/index.ts`)  
- `@acc/core` (`packages/core/src/bootstrap.ts`)  
**Lead Systems Architect:** Principal Polyglot Architect, Database Architect & Operations Specialist, TypeScript Architect & Enterprise Clean Coder  
**Architectural Framework:** Clean Architecture, Hexagonal Isomorphic Domain Design, Erasable Syntax Only, GoF Strategy & Abstract Factory Patterns  
**Reference Invariants:** Monorepo Isolation (`scripts/check-native-imports.ts`), Zero-Stub Runtime Invariants, Coordinated Bootstrap Lifecycle  

---

## 1. Executive Summary & Core Architectural Invariants

Iteration 26 implements an isomorphic, zero-dependency **Platform & Feature Detection** module in `@acc/core-isomorphic`. This system enables runtime environments (Bun, Node.js, Browser Window, and Web Worker) across diverse host operating systems (Windows, macOS, Linux, iOS, Android) to be detected with 100% type safety and zero native bundle leakage.

Crucially, **`UniversalCanvasProvider` and `MediaEngineRegistry` are synchronized during bootstrap**:
- In browser clients, `bootstrapClient()` sets `WebCanvasAdapter` (`'web'`) alongside `MediabunnyClientStrategy` (`'mediabunny-client'`), backed by optimal client caching (`'indexeddb'` $\rightarrow$ `'web-cache'` $\rightarrow$ `'memory'`).
- In server/CLI environments, `bootstrapNode()` sets `NapiCanvasAdapter` (`'node'`) alongside `'bun-ffi'` (on Bun) or `'mediabunny-server'` (on Node.js), backed by native filesystem caching (`'native-file'`).

### Architectural Invariants:
1. **Erasable Syntax First**: `RuntimeEnvironment` and `OperatingSystem` use `as const` object dictionaries with matching type aliases, providing runtime property inspection and compile-time type-safety without emitting non-standard TypeScript artifacts.
2. **Synchronized Engine-Canvas Pairing**: A media engine designed for server (e.g. `bun-ffi`) must never run against a browser canvas, and client engines (`mediabunny-client`) must strictly pair with DOM/Offscreen canvas adapters.
3. **Resilient Feature Gating**: Private/incognito browsing or non-HTTPS origins gracefully fall back to functional in-memory cache strategies without throwing unhandled exceptions.
4. **Zero Native Leakage**: All platform detection primitives in `@acc/core-isomorphic` remain 100% free of Node built-ins (`fs`, `child_process`, `crypto`) or native C++ addons (`@napi-rs/canvas`).

---

## 2. Architecture & Information Flow

```mermaid
flowchart TD
    subgraph Host["Host Environment (Runtime & Hardware)"]
        H_SERVER["Server (process.platform / process.versions)"]
        H_BROWSER["Client / Browser (window / navigator / caches / indexedDB)"]
    end

    subgraph CoreIsomorphic["@acc/core-isomorphic (platform/)"]
        PD["PlatformDetector (Singleton Engine)"]
        
        subgraph EnumsAndTypes["Typed Enums & Contracts"]
            OS["OperatingSystem\n(Windows | MacOS | Linux | IOS | Android | Unknown)"]
            RT["RuntimeEnvironment\n(Bun | Node | Browser | WebWorker | Unknown)"]
            CAP["RuntimeCapabilities\n(hasBunFFI | hasFileSystem | hasIndexedDb | hasWebCache | hasWebCodecs)"]
        end

        subgraph Resolvers["Coordinated Resolution Facade"]
            RESOLVE_CANVAS["resolveDefaultCanvasAdapter()\n'web' | 'node'"]
            RESOLVE_ENGINE["resolveDefaultMediaEngine()\n'bun-ffi' | 'mediabunny-server' | 'mediabunny-client'"]
            RESOLVE_CACHE["resolveDefaultCacheStrategy()\n'native-file' | 'indexeddb' | 'web-cache' | 'memory'"]
        end

        PD --> EnumsAndTypes
        EnumsAndTypes --> Resolvers
    end

    H_SERVER -->|probes| PD
    H_BROWSER -->|probes| PD

    subgraph WebBootstrap["@acc/core-web"]
        BC["bootstrapClient()"]
        BC -->|queries resolution| Resolvers
        BC -->|1. sets default canvas 'web'| UCP_W["UniversalCanvasProvider\n(WebCanvasAdapter)"]
        BC -->|2. sets default media engine 'mediabunny-client'| MER_W["MediaEngineRegistry\n(MediabunnyClientStrategy)"]
        BC -->|3. sets default cache ('indexeddb'/'web-cache')| CCR_W["ContentCacheRegistry"]
        UCP_W -.->|synchronized pairing| MER_W
    end

    subgraph NodeBootstrap["@acc/core"]
        BN["bootstrapNode()"]
        BN -->|queries resolution| Resolvers
        BN -->|1. sets default canvas 'node'| UCP_N["UniversalCanvasProvider\n(NapiCanvasAdapter)"]
        BN -->|2. sets default media engine ('bun-ffi' / 'mediabunny-server')| MER_N["MediaEngineRegistry\n(BunFFI / Mediabunny / Fluent)"]
        BN -->|3. sets default cache 'native-file'| CCR_N["ContentCacheRegistry"]
        UCP_N -.->|synchronized pairing| MER_N
    end
```

---

## 3. Implementation Blueprint

### 3.1. `@acc/core-isomorphic` Platform Detection Module
- **`packages/core-isomorphic/src/platform/types.ts`**:
  - `RuntimeEnvironment` (`Bun`, `Node`, `Browser`, `WebWorker`, `Unknown`).
  - `OperatingSystem` (`Windows`, `MacOS`, `Linux`, `IOS`, `Android`, `Unknown`).
  - `RuntimeCapabilities`:
    - `hasBunFFI: boolean`
    - `hasFileSystem: boolean`
    - `hasIndexedDb: boolean`
    - `hasWebCache: boolean`
    - `hasWebCodecs: boolean`
  - `PlatformProfile`: readonly snapshot of `{ os, runtime, capabilities }`.
- **`packages/core-isomorphic/src/platform/PlatformDetector.ts`**:
  - Methods:
    - `getOS(): OperatingSystem`
    - `getRuntime(): RuntimeEnvironment`
    - `getCapabilities(): RuntimeCapabilities`
    - `getProfile(): PlatformProfile`
    - `resolveDefaultCanvasAdapter(): 'web' | 'node'`
    - `resolveDefaultMediaEngine(): MediaEngineType`
    - `resolveDefaultCacheStrategy(registeredIds?: string[]): string`
    - `isServer(): boolean`
    - `isBrowser(): boolean`
    - `isWorker(): boolean`
- **`packages/core-isomorphic/src/canvas/UniversalCanvasProvider.ts`**:
  - Refactor `detectEnvironment()` to delegate directly to `PlatformDetector.resolveDefaultCanvasAdapter()`.
- **`packages/core-isomorphic/src/media-engine/MediaEngineRegistry.ts`**:
  - Initialize default engine via `PlatformDetector.resolveDefaultMediaEngine()`.

### 3.2. `@acc/core-web` Client Bootstrap Integration
- **`packages/core-web/src/index.ts` (`bootstrapClient`)**:
  - Configure `UniversalCanvasProvider.registerAdapter(new WebCanvasAdapter(), true)` and ensure engine matches `'web'`.
  - Register `MediabunnyClientStrategy` with `MediaEngineRegistry` and set as active default engine.
  - Register `WebCacheStrategy` and `IndexedDbCacheStrategy` with `ContentCacheRegistry`.
  - Set default cache strategy dynamically using `PlatformDetector.resolveDefaultCacheStrategy()`.

### 3.3. `@acc/core` Node/Bun Bootstrap Integration
- **`packages/core/src/bootstrap.ts` (`bootstrapNode`)**:
  - Configure `UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true)` and ensure engine matches `'node'`.
  - Dynamically resolve default media engine (`'bun-ffi'` on Bun, `'mediabunny-server'` on Node) if `options.defaultMediaEngine` is not specified.
  - Register all available server media engines (`bun-ffi`, `mediabunny-server`, `fluent-ffmpeg`).
  - Register `NativeFileCacheStrategy` into `ContentCacheRegistry` and set as default.

---

## 4. Verification Plan

### Automated Test Specifications
1. **`autogenerated-tests/platform_detector.test.ts`**:
   - Detects live runtime (Bun) and OS accurately.
   - Mocked environments verify correct resolution for Node.js, Browser (with/without IndexedDB/WebCache), and WebWorker.
   - Validates synchronized default pairings between canvas and media engines.
2. **`autogenerated-tests/core_web_services.test.ts`**:
   - Verifies `bootstrapClient()` sets synchronized Web canvas, `mediabunny-client` engine, and optimal browser cache.
3. **`autogenerated-tests/core_node_bootstrap.test.ts`**:
   - Verifies `bootstrapNode()` sets synchronized Node canvas, Bun/Node media engine, and native disk cache.
4. **Monorepo Invariants**:
   - `bun run scripts/check-native-imports.ts`: Confirms 0 unauthorized native import leaks.
   - `bun test autogenerated-tests/core_isomorphic_universal_services.test.ts autogenerated-tests/media_engine_registry.test.ts`: Confirms backward compatibility.
