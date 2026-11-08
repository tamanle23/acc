# Master Implementation Plan - Iteration 80: Studio RightSidebar Slider Continuous Movement & Precision Control Engine

## 1. Executive Summary
In Iteration 78/79, while inspector sections were restructured with `<Index>` and sequence popup positioning was solved via polymorphic `HoverCardTrigger`, interaction with numeric sliders in `apps/studio/src/components/RightSidebar.tsx` and its child inspectors (`DynamicModifierInspector.tsx`, `SequenceInspector.tsx`, `TrackInspector.tsx`, `StudioColorGradingInspector.tsx`, and `ParameterControls.tsx`) exhibited a critical failure where **sliders were not moving** upon clicking or dragging.

Deep diagnostic tracing revealed the root cause: `@kobalte/core/slider`'s `SliderPrimitive.Root` contains an upstream flaw when controlled via SolidJS reactive props. Specifically, in Kobalte's `onSlideMove` handler, `state.setThumbPercent` is called (which dispatches `onChange` with the new value), and immediately on the subsequent line Kobalte executes `local.onChange?.(state.values())`. Because `state.values()` is an internal `createMemo` tracking `props.value`, and SolidJS signals do not flush synchronously mid-frame during an active event handler, `state.values()` evaluates to the stale value before the drag began. Kobalte's second call immediately reverts the property back to its old value, locking the thumb in place and preventing visual movement.

Iteration 80 replaces this defective Kobalte slider with an enterprise-grade, native SolidJS `Slider` primitive in `apps/studio/src/components/ui/slider.tsx` featuring direct pointer-capture drag tracking (`setPointerCapture`), step-clamping arithmetic with floating-point drift elimination, optimistic visual thumb positioning (`dragValue`), keyboard accessibility, and full WAI-ARIA slider semantics.

---

## 2. Architectural Trade-Off Matrices

| Dimension | Option A: Kobalte Upstream Workarounds (Wrapping & State Buffers) | Option B: Custom Pure SolidJS Slider Primitive (Selected) |
|---|---|---|
| **Drag Responsiveness** | Mediocre (snapping back, timer debouncing required to swallow duplicate events) | Pristine 60/120fps continuous pointer-capture tracking with zero jitter |
| **DOM Allocation Overhead** | High (`createDomCollectionItem`, multiple contexts, internal synthetic inputs) | Ultra-lightweight (single root `div`, track `div`, fill `div`, thumb `span`) |
| **Controlled State Parity** | Broken due to Kobalte memo evaluation order during synchronous drag | Immediate optimistic `dragValue` with bidirectional reactive synchronization |
| **Maintenance Burden** | High (dependent on Kobalte internal chunk changes and bug fixes) | Zero external dependencies, pure standard DOM Pointer & Keyboard Events |
| **WAI-ARIA Accessibility** | Standard Kobalte ARIA | 100% WCAG 2.2 AA compliant (`role="slider"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`) |

---

## 3. Mermaid Topology & Event Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Studio User
    participant Slider as apps/studio/ui/slider.tsx
    participant Control as PrimitiveControlStrategies.tsx
    participant Inspector as DynamicModifierInspector.tsx
    participant IRState as IRStateManager
    participant Renderer as IRPreviewEngine / Canvas

    User->>Slider: PointerDown on Slider Track or Thumb
    Slider->>Slider: setPointerCapture(e.pointerId) & compute clampAndStep(rawVal)
    Slider->>Slider: setDragValue(initialVal) (Optimistic Thumb Positioning)
    Slider->>Control: notifyChange(initialVal)
    Control->>Inspector: props.onChange(newVal)
    Inspector->>IRState: updateModifier(sequenceId, modifierType, params)
    IRState->>Renderer: DAG Dirty Mark & Request Frame

    loop Continuous Drag at 60/120 FPS
        User->>Slider: PointerMove (clientX, clientY)
        Slider->>Slider: getValueFromPointer(clientX, clientY)
        Slider->>Slider: setDragValue(nextVal) (Visual thumb tracks cursor instantaneously)
        Slider->>Control: notifyChange(nextVal)
        Control->>Inspector: props.onChange(nextVal)
        Inspector->>IRState: updateModifier(sequenceId, modifierType, nextParams)
        IRState->>Renderer: Live Canvas Update
    end

    User->>Slider: PointerUp / PointerCancel
    Slider->>Slider: releasePointerCapture(e.pointerId)
    Slider->>Slider: setIsDragging(false), setDragValue(null)
```

---

## 4. Mathematical & Algorithmic Specifications

### 4.1 Stepped Coordinate-to-Value Mapping
Given track bounding box $R = [x_{\text{left}}, y_{\text{top}}, w, h]$, pointer coordinate $(x, y)$, and scalar bounds $[m_{\min}, m_{\max}]$ with step size $s$:

$$\text{ratio} = \begin{cases} \text{clamp}\left(\frac{x - x_{\text{left}}}{w}, 0, 1\right) & \text{if horizontal} \\ \text{clamp}\left(1 - \frac{y - y_{\text{top}}}{h}, 0, 1\right) & \text{if vertical} \end{cases}$$

$$\text{rawVal} = m_{\min} + \text{ratio} \cdot (m_{\max} - m_{\min})$$

### 4.2 Floating-Point Drift Elimination
To prevent IEEE 754 precision artifacts (e.g., $1.0 - 0.05 = 0.9500000000000001$), we compute the decimal scale factor $10^D$ where $D = \min(\text{decimals}(s), 6)$:

$$\text{stepped} = \text{round}\left(\frac{\text{rawVal} - m_{\min}}{s}\right) \cdot s + m_{\min}$$
$$\text{clamped} = \max\left(m_{\min}, \min\left(m_{\max}, \frac{\text{round}(\text{stepped} \cdot 10^D)}{10^D}\right)\right)$$

### 4.3 Optimistic Drag Reconciliation
Let $V_{\text{prop}}$ be the scalar extracted from `props.value`, and $V_{\text{drag}}$ be the live pointer value. The effective thumb display value $V_{\text{eff}}$ is defined by:

$$V_{\text{eff}} = \begin{cases} V_{\text{drag}} & \text{if } \text{isDragging} \land V_{\text{drag}} \neq \text{null} \\ V_{\text{prop}} & \text{if } V_{\text{prop}} \neq \text{undefined} \\ V_{\text{default}} & \text{otherwise} \end{cases}$$

This guarantees that while dragging, visual thumb movement tracks the pointer with zero latency and zero snapping back, while preserving immediate synchronization when values change externally.

---

## 5. Concrete File & Class Signatures

### 5.1 `apps/studio/src/components/ui/slider.tsx`
```typescript
export interface SliderProps {
  class?: string;
  className?: string;
  value?: number[] | number;
  defaultValue?: number[] | number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  onChange?: (value: number[]) => void;
  orientation?: "horizontal" | "vertical";
  disabled?: boolean;
  onDblClick?: (e: MouseEvent) => void;
  [key: string]: any;
}

export function Slider(props: SliderProps): JSX.Element;
```

### 5.2 `apps/studio/src/components/inspector/strategies/PrimitiveControlStrategies.tsx`
```typescript
export function NumberControlStrategy(props: ControlStrategyProps): JSX.Element {
  // Binds defaultValue, numericVal(), and onChange cleanly to <Slider>
}
```

### 5.3 `apps/studio/src/components/inspector/ParameterControls.tsx`
```typescript
export function ParameterSlider(props: ParameterSliderProps): JSX.Element {
  // Binds props.defaultValue, props.value, props.onChange, and onDblClick cleanly to <Slider>
}
```

---

## 6. Phased Implementation Roadmap

- [x] **Phase 1: Diagnostic Audit & Kobalte Root-Cause Verification**
  - Traced Kobalte `SliderPrimitive.Root` double-invocation of `onChange` with stale memo.
  - Verified referential array wrapping issue with `value={[numericVal()]}`.
- [x] **Phase 2: Custom Enterprise SolidJS Slider Primitive**
  - Implemented `apps/studio/src/components/ui/slider.tsx` with direct pointer-capture dragging.
  - Added precision stepping math, keyboard navigation, and Liquid Glass design tokens.
- [x] **Phase 3: Inspector Strategy & Control Wiring**
  - Updated `PrimitiveControlStrategies.tsx` (`NumberControlStrategy`) to supply `defaultValue` and direct `value`.
  - Updated `ParameterControls.tsx` (`ParameterSlider`) to supply `defaultValue` and direct `value`.
- [x] **Phase 4: Formal Verification & Production Build**
  - Authored `autogenerated-tests/studio_slider_properties_interaction.test.ts`.
  - Verified 100% test pass and successful Vite production build (`pnpm --filter @acc/studio build`).

---

## 7. Formal Verification Matrix

| Test Suite / Command | Scope | Target Invariant | Result |
|---|---|---|---|
| `autogenerated-tests/studio_slider_properties_interaction.test.ts` | Slider Component & Strategies | Continuous dragging without Kobalte drag-snapping bug, precision step math | PASS (5/5) |
| `autogenerated-tests/studio_right_sidebar_properties_and_popup.test.ts` | RightSidebar & Popups | Popups positioning, `<Index>` modifier lists, IRState parameter updates | PASS (7/7) |
| `autogenerated-tests/studio_sidebar_inspector.test.ts` | Sidebar Panels | Accordion triggers, 3D numeric controls, modifier removal | PASS (6/6) |
| `pnpm --filter @acc/studio build` | Production Bundle | Vite SolidJS bundle generation without TypeScript or bundler errors | PASS (17.93s) |

---

## 8. Risk & Rollback Mitigations

| Risk | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| **Pointer capture failure in legacy environments** | Very Low | Low | Dual-layer tracking: uses both `target.setPointerCapture` and fallback `window.addEventListener('pointermove', ...)` with guaranteed cleanup on `pointerup`/`pointercancel`. |
| **Step floating-point precision error** | Very Low | Low | Implemented decimal factor scaling (`10 ** Math.min(stepDecimals, 6)`) before rounding. |
| **Component unmount mid-drag** | Low | Low | `onCleanup` hook safely unbinds any active window event listeners and resets dragging state. |
