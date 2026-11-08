import { Show, type JSX } from 'solid-js';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '../ui/hover-card';
import { ClipInsightCard } from './ClipInsightCard';
import type { StudioSequence, StudioTrack } from '../../lib/ir/studioTypes';

export interface ClipHoverHUDProps {
  seq: StudioSequence;
  track?: StudioTrack | null;
  fps: number;
  disabled?: boolean;
  children: JSX.Element;
}

export type TimelineClipHoverHUDProps = ClipHoverHUDProps;

/**
 * ClipHoverHUD:
 * Accessible, Kobalte-powered HoverCard wrapper around a timeline clip.
 * Automatically handles viewport edge detection, floating collision boundaries,
 * portal rendering above sticky headers, and smooth enter/exit transitions without manual coordinate hacking.
 */
export function ClipHoverHUD(props: ClipHoverHUDProps) {
  return (
    <Show when={!props.disabled} fallback={props.children}>
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          {props.children}
        </HoverCardTrigger>
        <HoverCardContent
          class="w-80 p-3 glass-panel border border-glass-border shadow-2xl rounded-xl backdrop-blur-xl bg-popover/95 text-foreground z-[100] pointer-events-auto select-auto"
        >
          <ClipInsightCard seq={props.seq} track={props.track} fps={props.fps} />
        </HoverCardContent>
      </HoverCard>
    </Show>
  );
}

// Backward-compatible alias
export const TimelineClipHoverHUD = ClipHoverHUD;
