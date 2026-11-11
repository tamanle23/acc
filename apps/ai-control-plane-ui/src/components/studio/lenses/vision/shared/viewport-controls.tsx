import { Show } from "solid-js";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Move,
} from "lucide-solid";

export interface ViewportControlsProps {
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onReset: () => void;
  onFit?: () => void;
  isPanActive: boolean;
  onTogglePan: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  class?: string;
}

export function ViewportControls(props: ViewportControlsProps) {
  const handleZoomIn = () => {
    props.onZoomChange(Math.min(4.0, Number((props.zoom + 0.25).toFixed(2))));
  };

  const handleZoomOut = () => {
    props.onZoomChange(Math.max(0.25, Number((props.zoom - 0.25).toFixed(2))));
  };

  const zoomPct = () => Math.round(props.zoom * 100);

  return (
    <div
      class={`flex items-center gap-1 px-2 py-1 rounded-xl bg-background/90 dark:bg-card/90 backdrop-blur-md border border-border/80 shadow-md font-mono text-[11px] select-none z-30 ${
        props.class || ""
      }`}
      role="toolbar"
      aria-label="Viewport Canvas Pan and Zoom Controls"
    >
      {/* Pan Mode Toggle */}
      <button
        type="button"
        onClick={props.onTogglePan}
        class={`p-1.5 rounded-lg border transition ${
          props.isPanActive
            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
            : "bg-card/80 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/50"
        }`}
        title={props.isPanActive ? "Pan Mode Active (Drag to Pan)" : "Enable Pan Mode (Hold Space to Pan)"}
        aria-pressed={props.isPanActive}
        aria-label="Toggle Canvas Pan Hand Tool"
      >
        <Move class="w-3.5 h-3.5" />
      </button>

      <div class="h-4 w-px bg-border/60 mx-0.5" />

      {/* Zoom Out */}
      <button
        type="button"
        onClick={handleZoomOut}
        disabled={props.zoom <= 0.25}
        class="p-1.5 rounded-lg bg-card/80 text-muted-foreground border border-border/60 hover:text-foreground hover:bg-muted/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        title="Zoom Out (-25%)"
        aria-label="Zoom Out"
      >
        <ZoomOut class="w-3.5 h-3.5" />
      </button>

      {/* Zoom Display / Preset Reset */}
      <button
        type="button"
        onClick={props.onReset}
        class="px-2 py-1 rounded-lg bg-card/60 hover:bg-card text-foreground font-semibold border border-border/50 transition tabular-nums min-w-[52px] text-center"
        title="Click to Reset Zoom to 100%"
        aria-label={`Current Zoom ${zoomPct()} percent. Click to reset.`}
      >
        {zoomPct()}%
      </button>

      {/* Zoom In */}
      <button
        type="button"
        onClick={handleZoomIn}
        disabled={props.zoom >= 4.0}
        class="p-1.5 rounded-lg bg-card/80 text-muted-foreground border border-border/60 hover:text-foreground hover:bg-muted/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        title="Zoom In (+25%)"
        aria-label="Zoom In"
      >
        <ZoomIn class="w-3.5 h-3.5" />
      </button>

      <Show when={props.onFit}>
        <button
          type="button"
          onClick={props.onFit}
          class="px-2 py-1 rounded-lg bg-card/80 text-muted-foreground border border-border/60 hover:text-foreground hover:bg-muted/50 transition font-semibold"
          title="Fit Viewport to Screen"
          aria-label="Fit Viewport to Screen"
        >
          Fit
        </button>
      </Show>

      {/* Reset */}
      <button
        type="button"
        onClick={props.onReset}
        class="p-1.5 rounded-lg bg-card/80 text-muted-foreground border border-border/60 hover:text-foreground hover:bg-muted/50 transition"
        title="Reset Pan and Zoom to 1:1"
        aria-label="Reset Viewport Pan and Zoom"
      >
        <RotateCcw class="w-3.5 h-3.5" />
      </button>

      <Show when={props.onToggleFullscreen}>
        <div class="h-4 w-px bg-border/60 mx-0.5" />
        <button
          type="button"
          onClick={props.onToggleFullscreen}
          class="p-1.5 rounded-lg bg-card/80 text-muted-foreground border border-border/60 hover:text-foreground hover:bg-muted/50 transition"
          title={props.isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          aria-label={props.isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
        >
          <Show when={props.isFullscreen} fallback={<Maximize2 class="w-3.5 h-3.5" />}>
            <Minimize2 class="w-3.5 h-3.5" />
          </Show>
        </button>
      </Show>
    </div>
  );
}
