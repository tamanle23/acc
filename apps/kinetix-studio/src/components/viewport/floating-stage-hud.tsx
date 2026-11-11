import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { ZoomIn, ZoomOut, Maximize2, Maximize, HelpCircle } from 'lucide-solid';

export interface FloatingStageHudProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onOpenShortcuts?: () => void;
  onOpenPresenter?: () => void;
  dimensionsText: string;
}

export const FloatingStageHud: Component<FloatingStageHudProps> = (props) => {
  return (
    <div class="absolute bottom-3 right-3 z-30 flex items-center gap-1.5 p-1 rounded-full bg-card/85 backdrop-blur-md border border-border shadow-xl select-none text-xs font-mono text-card-foreground">
      {/* Aspect Ratio & Resolution Badge */}
      <span class="px-2.5 py-0.5 text-xs text-muted-foreground font-medium border-r border-border">
        {props.dimensionsText}
      </span>

      {/* Zoom Controls */}
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          onClick={props.onZoomOut}
          disabled={props.zoom <= 0.5}
          class="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut class="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={props.onZoomReset}
          class="px-1.5 py-0.5 rounded text-foreground hover:bg-accent font-bold cursor-pointer transition-colors"
          title="Reset Zoom to 100% / Fit"
        >
          {Math.round(props.zoom * 100)}%
        </button>

        <button
          type="button"
          onClick={props.onZoomIn}
          disabled={props.zoom >= 2.0}
          class="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn class="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Reset Fit */}
      <button
        type="button"
        onClick={props.onZoomReset}
        class="p-1 rounded-full text-muted-foreground hover:text-primary hover:bg-accent cursor-pointer transition-colors"
        title="Fit to Screen"
      >
        <Maximize2 class="w-3 h-3" />
      </button>

      {/* Fullscreen Exhibition Kiosk Presenter (F) */}
      <Show when={props.onOpenPresenter}>
        <button
          type="button"
          onClick={props.onOpenPresenter}
          class="p-1 rounded-full text-emerald-400 hover:text-emerald-300 hover:bg-accent cursor-pointer transition-colors"
          title="Fullscreen Exhibition Kiosk Mode (Hotkey: F)"
        >
          <Maximize class="w-3.5 h-3.5" />
        </button>
      </Show>

      {/* Shortcuts Trigger (?) */}
      <Show when={props.onOpenShortcuts}>
        <button
          type="button"
          onClick={props.onOpenShortcuts}
          class="p-1 rounded-full text-muted-foreground hover:text-primary hover:bg-accent cursor-pointer transition-colors border-l border-border pl-1.5 ml-0.5"
          title="Keyboard Shortcuts (?)"
        >
          <HelpCircle class="w-3.5 h-3.5" />
        </button>
      </Show>
    </div>
  );
};
