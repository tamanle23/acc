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

export function OverlayHUD(props: OverlayHUDProps) {
  return (
    <>
      {/* 1. Magnetic Snapping Guideline */}
      <SnapGuideline
        pixelsPerFrame={props.pixelsPerFrame}
        activeSnapGuideline={props.activeSnapGuideline}
      />

      {/* 2. Razor Tool Hover Cut Indicator Guideline */}
      <RazorGuideline
        pixelsPerFrame={props.pixelsPerFrame}
        razorHoverFrame={props.razorHoverFrame}
      />

      {/* 3. Floating Timecode HUD Badge during Drag or Trim */}
      <TimecodeBadge
        pixelsPerFrame={props.pixelsPerFrame}
        timecodeHUD={props.timecodeHUD}
      />
    </>
  );
}

export const TimelineOverlayHUD = OverlayHUD;
