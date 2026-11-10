# Studio Implementation Plan - Iteration 65 (Master Iteration 73)
# Complete React 19 to SolidJS 1.9 Migration Architecture for @acc/studio

## 1. Executive Summary
`@acc/studio` is an enterprise-grade pro NLE and motion graphics workstation. This plan details the phased execution of migrating `@acc/studio` from React 19 to SolidJS 1.9, eliminating Virtual DOM overhead, reducing timeline scrubbing GC pauses to zero, and aligning Studio with the SolidJS architecture already established in `apps/supervisor-desktop`.

---

## 2. Technical Mapping: React 19 to SolidJS 1.9

### 2.1 Core Reactivity & Lifecycle Mapping
| React 19 Construct | SolidJS 1.9 Equivalent | Architectural Idiom & Nuance |
| :--- | :--- | :--- |
| `useState<T>(initial)` | `createSignal<T>(initial)` | Returns `[getter, setter]`. In Solid, the getter is an accessor function `state()`, not a value. |
| `useMemo(() => expr, deps)` | `createMemo(() => expr)` | No explicit dependency array required; dependencies are tracked automatically via signal reads. |
| `useEffect(() => { ... return cleanup }, deps)` | `createEffect(() => { ... onCleanup(cleanup) })` | Runs on dependency change. `onCleanup` registers cleanup handlers within the reactive scope. |
| `useEffect(() => { ... }, [])` | `onMount(() => { ... })` | Executes once after the DOM elements are attached. Non-tracking context. |
| `useLayoutEffect` | `createRenderEffect` | Executes synchronously during initial DOM tree compilation before paint. |
| `useRef<T>(initial)` | Variable or element ref `let el; <div ref={el!} />` | For DOM elements, use direct variable binding. For mutable state, use `{ current: initial }` or primitive variables. |
| `useCallback(fn, deps)` | Plain function | Since Solid component bodies run only once, callbacks do not re-create on renders. |
| `useContext(Ctx)` | `useContext(Ctx)` | 1:1 mapping with Solid's `createContext` and `useContext`. |
| `useSyncExternalStore` | Custom Signal Bridge | Bridge external pub/sub stores using `createSignal` + `onCleanup`. |
| `React.lazy` / `<Suspense>` | `lazy` / `<Suspense>` | Solid provides native `lazy(() => import(...))` and `<Suspense fallback={...}>`. |

### 2.2 JSX & Control Flow Mapping
| React JSX Pattern | SolidJS JSX Equivalent | Critical Rule |
| :--- | :--- | :--- |
| `className="..."` | `class="..."` or `classList={{ active: isActive() }}` | `className` is supported as an alias, but `class` is canonical in Solid. |
| `{cond ? <A/> : <B/>}` | `<Show when={cond()} fallback={<B/>}>{(val) => <A val={val}/>}</Show>` | Prevents re-instantiating DOM nodes when signal evaluates truthy. |
| `{items.map(item => <Item {...item} />)}` | `<For each={items()}>{(item, index) => <Item item={item} />}</For>` | Keyed by object reference identity; recycles DOM elements when items reorder. |
| `{primitives.map((x, i) => <Tag>{x}</Tag>)}` | `<Index each={primitives()}>{(item, index) => <Tag>{item()}</Tag>}</Index>` | Keyed by index; optimal when array contains primitive strings or numbers. |
| `{mode === 'a' ? <A/> : mode === 'b' ? <B/> : <C/>}` | `<Switch fallback={<C/>}><Match when={mode() === 'a'}><A/></Match><Match when={mode() === 'b'}><B/></Match></Switch>` | Declarative multi-branch switching. |
| `props.children` | `props.children` wrapped with `children(() => props.children)` | Solid evaluates children reactively; use `children()` helper to avoid re-evaluating JSX expressions. |

---

## 3. Dependency Modernization & UI Primitive Bridges

### 3.1 Replacement Matrix for NPM Dependencies
1. **Bundler & Core**:
   - REMOVE: `@vitejs/plugin-react`, `react`, `react-dom`, `@types/react`, `@types/react-dom`
   - ADD: `@solidjs/vite-plugin`, `solid-js`
2. **Accessible Primitives**:
   - REMOVE: `@radix-ui/react-*`, `radix-ui`, `@base-ui/react`, `@shadcn/react`
   - ADD: `@kobalte/core`
3. **Multi-Pane Bento Resizable**:
   - REMOVE: `react-resizable-panels`
   - ADD: `@corvu/resizable`
4. **Icons**:
   - REMOVE: `lucide-react`
   - ADD: `lucide-solid`
5. **Toast Notifications**:
   - REMOVE: `sonner`
   - ADD: `solid-sonner`
6. **Virtualization**:
   - REMOVE: `@tanstack/react-virtual`
   - ADD: `@tanstack/solid-virtual`
7. **Drag & Drop**:
   - REMOVE: `@dnd-kit/core`, `@dnd-kit/utilities`
   - ADD: `@dnd-kit/solid`, `@dnd-kit/dom`, `@dnd-kit/abstract`
   - RETAIN: `TimelinePointerStateMachine` completely intact for timeline interactions.

---

## 4. Companion Phased Implementation (Strict Parity with Master Plan 73)

### Phase 1: Tooling, Packaging & Bundler Modernization
- Update `package.json`, `vite.config.ts`, and `tsconfig.json` for Solid JSX transformation (`jsxImportSource: "solid-js"`).

### Phase 2: Reactive State Bridge & Shuttle Composable
- Modernize `src/lib/ir/useStudioStore.ts` with Solid signals for `useIRState`, `useIRSelector`, `usePlayheadFrame`, and `usePlayheadIsPlaying`.
- Rewrite `src/lib/shuttle/useShuttleEngine.ts` to `createShuttleEngine()`.
- Rewrite `src/lib/theme/ThemeProvider.tsx` to Solid Context and signal architecture.

### Phase 3: Core UI Primitives Layer (`src/components/ui/*`)
- Port all primitives in `src/components/ui/` to `@kobalte/core` and `@corvu/resizable`.
- Ensure strict Liquid Glass visual token parity (specular borders, frosted glass backdrops, obsidian canvas).

### Phase 4: Main Application Shell & Workbench Layout
- Port `src/main.tsx` (`render(() => <App />, root)`) and `src/App.tsx`.
- Wire `Titlebar.tsx` with fine-grained SMPTE timecode signal.

### Phase 5: Viewport, Canvas & Interactive Overlays (`src/components/Preview.tsx`)
- Port `Preview.tsx`, `ViewportCanvasLayer.tsx`, `TransformGizmoOverlay.tsx`, `TransformHandles.tsx`.
- Connect vanilla `IRPreviewEngine` strategy without VDOM diffing.
- Connect `@dnd-kit/solid` drop target.

### Phase 6: Timeline & Multi-Track Sequencing (`src/components/Timeline.tsx`)
- Port `Timeline.tsx`, `TimelineDom.tsx`, `TrackHeaderCard.tsx`, `DroppableTrackLane.tsx`, `ClipItem.tsx`, `TimecodeRuler.tsx`.
- Retain `TimelinePointerStateMachine` intact.

### Phase 7: Left Media Vault & Right Multi-Tier Inspector
- Port `LeftSidebar.tsx` with `@tanstack/solid-virtual` and `@dnd-kit/solid`.
- Port `RightSidebar.tsx`, `DynamicModifierInspector.tsx`, `ModifierControlStrategies.tsx`.

### Phase 8: Modals, Debugger & OPFS Subsystems
- Port export modals, settings modal, shortcuts modal, OPFS explorer, and visual IR debugger.

### Phase 9: Verification, Test Parity & Build Hardening
- Update `autogenerated-tests/studio_phase2_reactive_store_and_types.test.ts`.
- Author `autogenerated-tests/studio_solid_migration_architecture.test.ts`.
- Verify build cleanly with zero type errors and sub-25s execution.
