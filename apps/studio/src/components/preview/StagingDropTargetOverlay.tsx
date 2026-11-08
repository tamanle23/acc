import { Show } from 'solid-js';
import { Sparkles } from 'lucide-solid';

export interface StagingDropTargetOverlayProps {
  isOver: boolean;
  isDragOver: boolean;
  dragCoords: { normX: number; normY: number } | null;
}

export function StagingDropTargetOverlay(props: StagingDropTargetOverlayProps) {
  const shouldShow = () => props.isOver || (props.isDragOver && Boolean(props.dragCoords));

  return (
    <Show when={shouldShow()}>
      <div
        style={{
          left: props.dragCoords ? `${props.dragCoords.normX * 100}%` : '50%',
          top: props.dragCoords ? `${props.dragCoords.normY * 100}%` : '50%',
        }}
        class="absolute -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-[var(--accent-primary)] bg-[var(--accent-glow)]/20 rounded-2xl p-5 flex flex-col items-center justify-center pointer-events-none z-30 shadow-[0_0_25px_var(--accent-glow)] backdrop-blur-md animate-pulse"
      >
        <Sparkles class="w-6 h-6 text-[var(--accent-primary)] animate-spin" />
        <span class="text-[11px] font-mono font-bold text-foreground mt-2 whitespace-nowrap drop-shadow-sm">
          {props.dragCoords
            ? `Drop to stage (${Math.round(props.dragCoords.normX * 100)}%, ${Math.round(props.dragCoords.normY * 100)}%)`
            : 'Drop into Canvas Viewport'}
        </span>
      </div>
    </Show>
  );
}
