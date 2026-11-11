import { Show } from "solid-js";
import { Crosshair } from "lucide-solid";

export interface PixelProbeOverlayProps {
  active: boolean;
  x: number;
  y: number;
  imgWidth?: number;
  imgHeight?: number;
  mode: "alpha_matte" | "depth";
  rgba?: { r: number; g: number; b: number; a: number };
  depthValue?: number;
  isMetric?: boolean;
}

export function PixelProbeOverlay(props: PixelProbeOverlayProps) {
  const alphaPct = () => {
    if (!props.rgba) return 100;
    return Math.round((props.rgba.a / 255) * 100);
  };

  const hexColor = () => {
    if (!props.rgba) return "#000000";
    const r = props.rgba.r.toString(16).padStart(2, "0");
    const g = props.rgba.g.toString(16).padStart(2, "0");
    const b = props.rgba.b.toString(16).padStart(2, "0");
    return `#${r}${g}${b}`.toUpperCase();
  };

  return (
    <Show when={props.active}>
      <div
        class="absolute bottom-2.5 left-2.5 z-30 flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-background/90 dark:bg-card/90 backdrop-blur-md border border-border/80 shadow-md font-mono text-[11px] select-none tabular-nums text-foreground"
        aria-live="polite"
        role="status"
      >
        <div class="flex items-center gap-1.5 text-primary">
          <Crosshair class="w-3.5 h-3.5" />
          <span class="font-bold">PROBE</span>
        </div>

        <div class="h-3.5 w-px bg-border/60" />

        {/* Coordinate Display */}
        <div class="flex items-center gap-1 text-muted-foreground">
          <span>X:</span>
          <span class="text-foreground font-semibold">{Math.round(props.x)}</span>
          <span>Y:</span>
          <span class="text-foreground font-semibold">{Math.round(props.y)}</span>
          <Show when={props.imgWidth && props.imgHeight}>
            <span class="text-[9px] text-muted-foreground/80">
              ({props.imgWidth}×{props.imgHeight})
            </span>
          </Show>
        </div>

        <div class="h-3.5 w-px bg-border/60" />

        <Show
          when={props.mode === "depth"}
          fallback={
            /* Alpha Matte / RGBA Mode */
            <div class="flex items-center gap-2">
              <Show when={props.rgba}>
                <div
                  class="w-3.5 h-3.5 rounded-full border border-border shadow-xs"
                  style={{
                    "background-color": `rgba(${props.rgba!.r}, ${props.rgba!.g}, ${props.rgba!.b}, ${props.rgba!.a / 255})`,
                  }}
                  title={`RGB(${props.rgba!.r}, ${props.rgba!.g}, ${props.rgba!.b})`}
                />
                <span class="text-muted-foreground">{hexColor()}</span>
                <span
                  class={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                    alphaPct() === 100
                      ? "text-success bg-success/10"
                      : alphaPct() === 0
                      ? "text-destructive bg-destructive/10"
                      : "text-primary bg-primary/10"
                  }`}
                >
                  α: {alphaPct()}%
                </span>
              </Show>
            </div>
          }
        >
          {/* Depth Mode */}
          <div class="flex items-center gap-1.5">
            <span class="text-muted-foreground">DEPTH Z:</span>
            <span class="text-primary font-bold">
              {props.depthValue !== undefined
                ? props.isMetric
                  ? `${props.depthValue.toFixed(2)}m`
                  : props.depthValue.toFixed(3)
                : "--"}
            </span>
          </div>
        </Show>
      </div>
    </Show>
  );
}
