import React from 'react';

export interface RazorGuidelineProps {
  pixelsPerFrame: number;
  timelineMode: 'dom' | 'canvas';
  razorHoverFrame: number | null;
}

export type TimelineRazorGuidelineProps = RazorGuidelineProps;

/**
 * RazorGuideline:
 * Renders the razor/scissors cut position indicator when hovering over the timeline in razor mode.
 */
export const RazorGuideline: React.FC<RazorGuidelineProps> = ({
  pixelsPerFrame,
  timelineMode,
  razorHoverFrame,
}) => {
  if (timelineMode !== 'canvas' || razorHoverFrame === null) return null;

  return (
    <div
      className="absolute top-7 bottom-0 z-35 pointer-events-none flex flex-col items-center"
      style={{
        left: `${208 + razorHoverFrame * pixelsPerFrame}px`,
      }}
    >
      <div className="w-1.5 h-1.5 bg-rose-400 rotate-45 -mt-1 shadow-[0_0_8px_#f43f5e]" />
      <div className="w-[1.5px] flex-1 bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
      <span className="text-[9px] font-mono text-rose-300 bg-popover/95 px-1 py-0.5 rounded -mt-4 shadow-sm border border-rose-500/40">
        ✂ Cut @ {razorHoverFrame}f
      </span>
    </div>
  );
};

// Backward-compatible alias
export const TimelineRazorGuideline = RazorGuideline;
