import { Show, splitProps, type JSX } from 'solid-js';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '../ui/hover-card';
import { ClipInsightCard } from './ClipInsightCard';
import type { StudioSequence, StudioTrack } from '../../lib/ir/studioTypes';

export interface ClipHoverHUDProps {
  seq: StudioSequence;
  track?: StudioTrack | null;
  fps: number;
  disabled?: boolean;
  class?: string;
  className?: string;
  style?: JSX.CSSProperties | string;
  ref?: (el: HTMLElement) => void;
  onClick?: (e: MouseEvent) => void;
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: (e: MouseEvent) => void;
  children: JSX.Element;
}

export type TimelineClipHoverHUDProps = ClipHoverHUDProps;

/**
 * ClipHoverHUD:
 * Accessible, Kobalte-powered HoverCard wrapper around a timeline clip.
 * Polymorphic trigger architecture: renders the physical clip element directly as HoverCardTrigger,
 * ensuring triggerRef.getBoundingClientRect() evaluates to the true timeline position without
 * zero-size wrapper or display:contents defects.
 */
export function ClipHoverHUD(props: ClipHoverHUDProps) {
  const [hudProps, triggerProps] = splitProps(props, [
    'seq',
    'track',
    'fps',
    'disabled',
    'children',
  ]);

  return (
    <HoverCard openDelay={250} closeDelay={150}>
      <HoverCardTrigger
        as="div"
        disabled={hudProps.disabled}
        {...triggerProps}
      >
        {hudProps.children}
      </HoverCardTrigger>
      <Show when={!hudProps.disabled}>
        <HoverCardContent
          side="top"
          sideOffset={8}
          class="w-80 p-3 glass-panel border border-glass-border shadow-2xl rounded-xl backdrop-blur-xl bg-popover/95 text-foreground z-[100] pointer-events-auto select-auto"
        >
          <ClipInsightCard seq={hudProps.seq} track={hudProps.track} fps={hudProps.fps} />
        </HoverCardContent>
      </Show>
    </HoverCard>
  );
}

// Backward-compatible alias
export const TimelineClipHoverHUD = ClipHoverHUD;
