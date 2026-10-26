import React from 'react';

export interface TimecodeBadgeProps {
  pixelsPerFrame: number;
  timecodeHUD: {
    frame: number;
    deltaFrames: number;
    snapLabel?: string;
    durationFrames?: number;
  } | null;
}

export type TimelineTimecodeBadgeProps = TimecodeBadgeProps;

/**
 * TimecodeBadge:
 * Renders the floating numeric timecode/delta badge during active clip drag or trim interactions.
 */
export const TimecodeBadge: React.FC<TimecodeBadgeProps> = ({
  pixelsPerFrame,
  timecodeHUD,
}) => {
  if (!timecodeHUD) return null;

  return (
    <div
      className="absolute z-40 pointer-events-none -top-1 px-2.5 py-1 rounded bg-popover/95 border border-accent-theme text-accent-theme font-mono text-[10px] shadow-xl flex items-center gap-2 backdrop-blur-md transition-transform"
      style={{
        left: `${Math.max(210, 208 + timecodeHUD.frame * pixelsPerFrame - 40)}px`,
      }}
    >
      <span className="font-semibold text-foreground">Frame {timecodeHUD.frame}</span>
      <span
        className={
          timecodeHUD.deltaFrames > 0
            ? 'text-emerald-400 font-bold'
            : timecodeHUD.deltaFrames < 0
              ? 'text-amber-400 font-bold'
              : 'text-muted-foreground'
        }
      >
        ({timecodeHUD.deltaFrames >= 0 ? `+${timecodeHUD.deltaFrames}` : timecodeHUD.deltaFrames}f)
      </span>
      {timecodeHUD.durationFrames !== undefined && (
        <span className="text-muted-foreground text-[9px] border-l border-border pl-1.5">
          Dur: {timecodeHUD.durationFrames}f
        </span>
      )}
      {timecodeHUD.snapLabel && (
        <span className="text-accent-theme text-[9px] bg-accent-theme/15 border border-accent-theme/30 px-1 rounded">
          {timecodeHUD.snapLabel}
        </span>
      )}
    </div>
  );
};

// Backward-compatible alias
export const TimelineTimecodeBadge = TimecodeBadge;
