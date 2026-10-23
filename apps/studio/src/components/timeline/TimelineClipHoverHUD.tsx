import React from 'react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '../ui/hover-card';
import { TimelineClipInsightCard } from './TimelineClipInsightCard';

export interface TimelineClipHoverHUDProps {
  seq: any;
  track: any;
  fps: number;
  children: React.ReactNode;
}

/**
 * TimelineClipHoverHUD:
 * Accessible, Radix/Shadcn-powered HoverCard wrapper around a timeline clip.
 * Automatically handles viewport edge detection, floating collision boundaries,
 * portal rendering above sticky headers, and smooth enter/exit transitions without manual coordinate hacking.
 */
export const TimelineClipHoverHUD: React.FC<TimelineClipHoverHUDProps> = ({
  seq,
  track,
  fps,
  children,
}) => {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={8}
        avoidCollisions={true}
        className="w-80 p-3 glass-panel border border-glass-border shadow-2xl rounded-xl backdrop-blur-xl bg-popover/95 text-foreground z-[100]"
      >
        <TimelineClipInsightCard seq={seq} track={track} fps={fps} />
      </HoverCardContent>
    </HoverCard>
  );
};
