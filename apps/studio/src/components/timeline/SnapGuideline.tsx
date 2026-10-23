import React from 'react';

export interface SnapGuidelineProps {
  pixelsPerFrame: number;
  activeSnapGuideline: { frame: number; label?: string; isAbut?: boolean } | null;
}

export type TimelineSnapGuidelineProps = SnapGuidelineProps;

/**
 * SnapGuideline:
 * Renders the vertical magnetic snapping guideline (cyan for grid/playhead, emerald for abutting clip seams).
 */
export const SnapGuideline: React.FC<SnapGuidelineProps> = ({
  pixelsPerFrame,
  activeSnapGuideline,
}) => {
  if (!activeSnapGuideline) return null;

  return (
    <div
      className="absolute top-7 bottom-0 z-35 pointer-events-none flex flex-col items-center"
      style={{
        left: `${208 + activeSnapGuideline.frame * pixelsPerFrame}px`,
      }}
    >
      <div
        className={`w-2 h-2 rotate-45 -mt-1 ${
          activeSnapGuideline.isAbut
            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] ring-1 ring-emerald-300'
            : 'bg-accent-theme shadow-accent-glow'
        }`}
      />
      <div
        className={`w-[1.5px] flex-1 ${
          activeSnapGuideline.isAbut
            ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
            : 'bg-accent-theme shadow-accent-glow'
        }`}
      />
      <span
        className={`text-[9px] font-mono px-1.5 py-0.5 rounded -mt-4 shadow-sm border flex items-center gap-1 backdrop-blur-md ${
          activeSnapGuideline.isAbut
            ? 'text-emerald-300 bg-emerald-950/90 border-emerald-500/60'
            : 'text-accent-theme bg-popover/95 border-accent-theme/40'
        }`}
      >
        <span>{activeSnapGuideline.frame}f</span>
        {activeSnapGuideline.label && (
          <span
            className={`text-[8px] uppercase font-semibold ${
              activeSnapGuideline.isAbut ? 'text-emerald-200' : 'text-accent-theme/80'
            }`}
          >
            ({activeSnapGuideline.label})
          </span>
        )}
      </span>
    </div>
  );
};

// Backward-compatible alias
export const TimelineSnapGuideline = SnapGuideline;
