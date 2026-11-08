import { type JSX } from 'solid-js';
import { useDroppable } from '@dnd-kit/solid';
import type { StudioTrack } from '../../lib/ir/studioTypes';

export interface DroppableTrackLaneProps {
  track: StudioTrack;
  isLocked: boolean;
  isInvalidDrop?: boolean;
  children: JSX.Element;
  scrollLeft?: number;
  viewportWidth?: number;
  pixelsPerFrame?: number;
  fps?: number;
}

export function DroppableTrackLane(props: DroppableTrackLaneProps) {
  const droppable = useDroppable({
    id: () => `track-${props.track.id}`,
    data: () => ({
      type: 'track',
      trackId: props.track.id,
      trackType: props.track.type || 'video',
    }),
    disabled: () => props.isLocked,
  });

  const isInvalidOver = () => droppable.isDropTarget() && props.isInvalidDrop;
  const isValidOver = () => droppable.isDropTarget() && !props.isInvalidDrop;

  return (
    <div
      ref={droppable.ref}
      style={{
        'content-visibility': 'auto',
        'contain-intrinsic-size': '1000px 40px',
      }}
      class={`flex-1 h-full rounded-md border relative overflow-hidden transition-colors ${
        props.isLocked
          ? 'opacity-60 pointer-events-none bg-muted/40 border-[var(--glass-border)]'
          : isInvalidOver()
            ? 'bg-destructive/15 border-destructive/60 ring-2 ring-destructive/40 cursor-not-allowed shadow-[0_0_15px_rgba(239,68,68,0.2)]'
            : isValidOver()
              ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/40 ring-1 ring-[var(--accent-primary)]/30'
              : 'bg-background/25 border-[var(--glass-border)] hover:border-[var(--glass-border-highlight)]/40'
      }`}
    >
      {props.children}
    </div>
  );
}
