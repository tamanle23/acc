import React from 'react';
import { SnapGuideline } from './SnapGuideline';
import { RazorGuideline } from './RazorGuideline';
import { TimecodeBadge } from './TimecodeBadge';

export interface OverlayHUDProps {
  pixelsPerFrame: number;
  activeSnapGuideline: { frame: number; label?: string; isAbut?: boolean } | null;
  razorHoverFrame: number | null;
  timecodeHUD: {
    frame: number;
    deltaFrames: number;
    snapLabel?: string;
    durationFrames?: number;
  } | null;
}

export type TimelineOverlayHUDProps = OverlayHUDProps;

/**
 * OverlayHUD:
 * Orchestrates timeline canvas overlays (magnetic snapping guidelines, razor cut indicator, and drag timecode badges).
 * Clip hover insight has been cleanly decoupled into ClipHoverHUD using Radix/Shadcn HoverCard.
 */
export function OverlayHUD({
  pixelsPerFrame,
  activeSnapGuideline,
  razorHoverFrame,
  timecodeHUD,
}: OverlayHUDProps) {
  return (
    <>
      {/* 1. Magnetic Snapping Guideline (Cyan grid/playhead, Emerald abutting clip seams) */}
      <SnapGuideline
        pixelsPerFrame={pixelsPerFrame}
        activeSnapGuideline={activeSnapGuideline}
      />

      {/* 2. Razor Tool Hover Cut Indicator Guideline */}
      <RazorGuideline
        pixelsPerFrame={pixelsPerFrame}
        razorHoverFrame={razorHoverFrame}
      />

      {/* 3. Floating Timecode HUD Badge during Drag or Trim */}
      <TimecodeBadge
        pixelsPerFrame={pixelsPerFrame}
        timecodeHUD={timecodeHUD}
      />
    </>
  );
}

// Backward-compatible alias
export const TimelineOverlayHUD = OverlayHUD;
