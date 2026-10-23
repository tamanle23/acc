import React from 'react';
import { TimelineSnapGuideline } from './TimelineSnapGuideline';
import { TimelineRazorGuideline } from './TimelineRazorGuideline';
import { TimelineTimecodeBadge } from './TimelineTimecodeBadge';

export interface TimelineOverlayHUDProps {
  pixelsPerFrame: number;
  activeSnapGuideline: { frame: number; label?: string; isAbut?: boolean } | null;
  timelineMode: 'dom' | 'canvas';
  razorHoverFrame: number | null;
  timecodeHUD: {
    frame: number;
    deltaFrames: number;
    snapLabel?: string;
    durationFrames?: number;
  } | null;
}

/**
 * TimelineOverlayHUD:
 * Orchestrates timeline canvas overlays (magnetic snapping guidelines, razor cut indicator, and drag timecode badges).
 * Clip hover insight has been cleanly decoupled into TimelineClipHoverHUD using Radix/Shadcn HoverCard.
 */
export function TimelineOverlayHUD({
  pixelsPerFrame,
  activeSnapGuideline,
  timelineMode,
  razorHoverFrame,
  timecodeHUD,
}: TimelineOverlayHUDProps) {
  return (
    <>
      {/* 1. Magnetic Snapping Guideline (Cyan grid/playhead, Emerald abutting clip seams) */}
      <TimelineSnapGuideline
        pixelsPerFrame={pixelsPerFrame}
        activeSnapGuideline={activeSnapGuideline}
      />

      {/* 2. Razor Tool Hover Cut Indicator Guideline */}
      <TimelineRazorGuideline
        pixelsPerFrame={pixelsPerFrame}
        timelineMode={timelineMode}
        razorHoverFrame={razorHoverFrame}
      />

      {/* 3. Floating Timecode HUD Badge during Drag or Trim */}
      <TimelineTimecodeBadge
        pixelsPerFrame={pixelsPerFrame}
        timelineMode={timelineMode}
        timecodeHUD={timecodeHUD}
      />
    </>
  );
}
