import React from 'react';

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

export function TimelineOverlayHUD({
  pixelsPerFrame,
  activeSnapGuideline,
  timelineMode,
  razorHoverFrame,
  timecodeHUD,
}: TimelineOverlayHUDProps) {
  return (
    <>
      {/* Magnetic Snapping Guideline (Cyan for grid/playhead, Emerald for abutting clip seams) */}
      {activeSnapGuideline !== null && (
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
      )}

      {/* Razor Tool Hover Cut Indicator Guideline */}
      {timelineMode === 'canvas' && razorHoverFrame !== null && (
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
      )}

      {/* Floating Timecode HUD Badge during Drag or Trim */}
      {timelineMode === 'canvas' && timecodeHUD && (
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
      )}
    </>
  );
}
