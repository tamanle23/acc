import { createSignal, Show, type JSX } from "solid-js";
import { Columns } from "lucide-solid";

export interface DraggableSplitWipeProps {
  wipePct: number;
  onWipeChange: (newPct: number) => void;
  beforeContent: JSX.Element;
  afterContent: JSX.Element;
  beforeLabel?: string;
  afterLabel?: string;
  class?: string;
  containerStyle?: JSX.CSSProperties;
}

export function DraggableSplitWipe(props: DraggableSplitWipeProps) {
  const [isDragging, setIsDragging] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const updateWipeFromPointer = (clientX: number) => {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    if (rect.width <= 0) return;
    const rawPct = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(2, Math.min(98, Math.round(rawPct)));
    props.onWipeChange(clamped);
  };

  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateWipeFromPointer(e.clientX);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging()) return;
    e.preventDefault();
    e.stopPropagation();
    updateWipeFromPointer(e.clientX);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!isDragging()) return;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      props.onWipeChange(Math.max(2, props.wipePct - 2));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      props.onWipeChange(Math.min(98, props.wipePct + 2));
    } else if (e.key === "Home") {
      e.preventDefault();
      props.onWipeChange(2);
    } else if (e.key === "End") {
      e.preventDefault();
      props.onWipeChange(98);
    }
  };

  return (
    <div
      ref={containerRef}
      class={`relative w-full h-full overflow-hidden select-none touch-none ${props.class || ""}`}
      style={props.containerStyle}
    >
      {/* Layer 1: AFTER / Right Side Content (Background) */}
      <div class="absolute inset-0 w-full h-full">
        {props.afterContent}
      </div>

      {/* Layer 2: BEFORE / Left Side Content (Clipped to Split Wipe Percent) */}
      <div
        class="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
        style={{
          "clip-path": `inset(0 ${100 - props.wipePct}% 0 0)`,
        }}
      >
        <div class="w-full h-full pointer-events-auto">
          {props.beforeContent}
        </div>
      </div>

      {/* Layer 3: Draggable Divider Wire & Pill Handle */}
      <div
        class="absolute top-0 bottom-0 z-20 flex items-center justify-center -translate-x-1/2 cursor-ew-resize group"
        style={{
          left: `${props.wipePct}%`,
          width: "44px", // 44px hit-target for Fitts's Law
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-label="Split Wipe Comparison Divider"
        aria-valuenow={props.wipePct}
        aria-valuemin={2}
        aria-valuemax={98}
        aria-valuetext={`${props.wipePct} percent before frame visible`}
      >
        {/* Visible 2px Neon Guide Wire */}
        <div
          class={`absolute top-0 bottom-0 w-[2px] transition-colors duration-150 ${
            isDragging()
              ? "bg-primary shadow-[0_0_12px_rgba(var(--primary),0.8)]"
              : "bg-primary/80 group-hover:bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)]"
          }`}
        />

        {/* Center Draggable Grip Pill */}
        <div
          class={`relative w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 border-2 shadow-lg ${
            isDragging()
              ? "bg-primary border-primary-foreground text-primary-foreground scale-110 ring-4 ring-primary/30"
              : "bg-background/95 hover:bg-primary border-primary text-primary hover:text-primary-foreground group-hover:scale-105"
          }`}
        >
          <Columns class="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Floating Corner Badges */}
      <Show when={props.beforeLabel}>
        <div class="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-lg bg-background/85 dark:bg-card/85 text-foreground border border-border/80 backdrop-blur-sm font-mono text-[10px] font-semibold shadow-xs pointer-events-none">
          {props.beforeLabel}
        </div>
      </Show>

      <Show when={props.afterLabel}>
        <div class="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded-lg bg-background/85 dark:bg-card/85 text-foreground border border-border/80 backdrop-blur-sm font-mono text-[10px] font-semibold shadow-xs pointer-events-none">
          {props.afterLabel}
        </div>
      </Show>

      {/* Wipe Percentage Readout at Bottom Center */}
      <div class="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-md bg-background/80 dark:bg-card/80 text-muted-foreground border border-border/60 backdrop-blur-sm font-mono text-[10px] pointer-events-none tabular-nums">
        WIPE {props.wipePct}%
      </div>
    </div>
  );
}
