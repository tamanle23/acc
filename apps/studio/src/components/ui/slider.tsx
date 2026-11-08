import { splitProps, createMemo, createSignal, onCleanup, type JSX } from "solid-js";
import { cn } from "cn";

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

/**
 * Enterprise-grade SolidJS Slider primitive with zero Kobalte drag-snapping bugs.
 * Features:
 * - Direct pointer-capture tracking with 60fps/120fps smooth continuous dragging.
 * - Precision step clamping without floating-point drift.
 * - Immediate optimistic visual update during dragging with zero snapping back.
 * - Full ARIA semantics (role="slider", aria-valuenow, min, max, orientation).
 * - Keyboard navigation (Arrow keys, PageUp/PageDown, Home/End).
 * - Liquid Glass aesthetic tokens.
 */
function Slider(props: SliderProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "className",
    "value",
    "defaultValue",
    "min",
    "max",
    "step",
    "onValueChange",
    "onChange",
    "orientation",
    "disabled",
    "onDblClick",
  ]);

  const min = () => (typeof local.min === "number" && !Number.isNaN(local.min) ? local.min : 0);
  const max = () => (typeof local.max === "number" && !Number.isNaN(local.max) ? local.max : 100);
  const step = () => (typeof local.step === "number" && local.step > 0 ? local.step : 1);
  const isDisabled = () => Boolean(local.disabled);

  // Parse scalar number from props (handles both number and number[])
  const extractScalar = (val: number[] | number | undefined): number | undefined => {
    if (val === undefined || val === null) return undefined;
    if (Array.isArray(val)) {
      const first = val[0];
      return typeof first === "number" && !Number.isNaN(first) ? first : undefined;
    }
    return typeof val === "number" && !Number.isNaN(val) ? val : undefined;
  };

  const defaultScalar = () => extractScalar(local.defaultValue) ?? min();

  // Internal drag state for zero-lag, jitter-free interactive dragging
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragValue, setDragValue] = createSignal<number | null>(null);

  // Controlled or uncontrolled current value
  const currentValue = () => {
    if (isDragging() && dragValue() !== null) {
      return dragValue()!;
    }
    const propVal = extractScalar(local.value);
    return propVal !== undefined ? propVal : defaultScalar();
  };

  const notifyChange = (newVal: number) => {
    if (local.onChange) local.onChange([newVal]);
    if (local.onValueChange) local.onValueChange([newVal]);
  };

  let trackRef: HTMLDivElement | undefined;

  const clampAndStep = (rawVal: number): number => {
    const s = step();
    const m = min();
    const mx = max();
    const stepDecimals = s.toString().includes(".") ? s.toString().split(".")[1].length : 0;
    const factor = 10 ** Math.min(stepDecimals, 6);
    const stepped = Math.round((rawVal - m) / s) * s + m;
    const clamped = Math.max(m, Math.min(mx, stepped));
    return Math.round(clamped * factor) / factor;
  };

  const getValueFromPointer = (clientX: number, clientY: number): number => {
    if (!trackRef) return currentValue();
    const rect = trackRef.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) return currentValue();

    const isVertical = local.orientation === "vertical";
    const ratio = isVertical
      ? Math.max(0, Math.min(1, 1 - (clientY - rect.top) / (rect.height || 1)))
      : Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));

    const rawVal = min() + ratio * (max() - min());
    return clampAndStep(rawVal);
  };

  let activeCleanups: (() => void) | null = null;

  const handlePointerDown = (e: PointerEvent) => {
    if (isDisabled() || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}

    const initialVal = getValueFromPointer(e.clientX, e.clientY);
    setDragValue(initialVal);
    notifyChange(initialVal);

    const onPointerMove = (moveEv: PointerEvent) => {
      if (moveEv.pointerId !== e.pointerId) return;
      const nextVal = getValueFromPointer(moveEv.clientX, moveEv.clientY);
      setDragValue(nextVal);
      notifyChange(nextVal);
    };

    const onPointerUp = (upEv: PointerEvent) => {
      if (upEv.pointerId !== e.pointerId) return;
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
      setDragValue(null);
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      activeCleanups = null;
    };

    activeCleanups = cleanup;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  onCleanup(() => {
    if (activeCleanups) {
      activeCleanups();
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (isDisabled()) return;
    const cur = currentValue();
    const s = step();
    const m = min();
    const mx = max();
    let nextVal: number | null = null;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        nextVal = Math.min(mx, cur + s);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        nextVal = Math.max(m, cur - s);
        break;
      case "PageUp":
        nextVal = Math.min(mx, cur + s * 10);
        break;
      case "PageDown":
        nextVal = Math.max(m, cur - s * 10);
        break;
      case "Home":
        nextVal = m;
        break;
      case "End":
        nextVal = mx;
        break;
    }

    if (nextVal !== null) {
      e.preventDefault();
      const rounded = clampAndStep(nextVal);
      setDragValue(rounded);
      notifyChange(rounded);
      setDragValue(null);
    }
  };

  const handleDblClick = (e: MouseEvent) => {
    if (isDisabled()) return;
    if (local.defaultValue !== undefined) {
      const def = defaultScalar();
      notifyChange(def);
    }
    if (typeof local.onDblClick === "function") {
      local.onDblClick(e);
    }
  };

  const percent = createMemo(() => {
    const range = max() - min();
    if (range <= 0) return 0;
    const pct = ((currentValue() - min()) / range) * 100;
    return Math.max(0, Math.min(100, pct));
  });

  return (
    <div
      data-slot="slider"
      class={cn(
        "relative flex w-full touch-none items-center select-none py-1 group",
        isDisabled() ? "opacity-50 pointer-events-none" : "cursor-pointer",
        local.class || local.className
      )}
      onPointerDown={handlePointerDown}
      onDblClick={handleDblClick}
      {...rest}
    >
      <div
        ref={trackRef}
        data-slot="slider-track"
        class="relative grow overflow-hidden rounded-full bg-muted/70 dark:bg-slate-800/90 border border-white/10 dark:border-white/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] h-1.5 w-full"
      >
        <div
          data-slot="slider-range"
          class="absolute bg-accent-theme select-none h-full shadow-[0_0_8px_var(--accent-glow,rgba(6,182,212,0.4))]"
          style={{
            left: "0%",
            width: `${percent()}%`,
          }}
        />
      </div>
      <span
        role="slider"
        tabIndex={isDisabled() ? -1 : 0}
        aria-valuemin={min()}
        aria-valuemax={max()}
        aria-valuenow={currentValue()}
        aria-orientation={local.orientation ?? "horizontal"}
        data-slot="slider-thumb"
        onKeyDown={handleKeyDown}
        class="block h-3.5 w-3.5 shrink-0 rounded-full bg-foreground border-2 border-accent-theme shadow-md transition-transform select-none hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-theme cursor-ew-resize absolute top-1/2"
        style={{
          left: `${percent()}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <input
          type="range"
          min={min()}
          max={max()}
          step={step()}
          value={currentValue()}
          disabled={isDisabled()}
          class="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </span>
    </div>
  );
}

export { Slider };
