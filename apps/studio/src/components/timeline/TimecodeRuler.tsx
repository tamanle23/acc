import { RationalTime } from '@acc/core-isomorphic';
import React from 'react';

interface TimecodeRulerProps {
  totalFrames: number;
  fps: number;
  pixelsPerFrame: number;
  timelineWidth: number;
  onScrub: (frame: number) => void;
}

export function TimecodeRuler({
  totalFrames,
  fps,
  pixelsPerFrame,
  timelineWidth,
  onScrub,
}: TimecodeRulerProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetFrame = Math.max(0, Math.min(totalFrames, Math.round(clickX / pixelsPerFrame)));
    onScrub(targetFrame);
  };

  // Generate markers every second and intermediate frames using exact RationalTime arithmetic
  const secondStep = Math.max(1, Math.round(fps));
  const markers: { frame: number; label: string; isMajor: boolean }[] = [];

  for (let f = 0; f <= totalFrames; f += Math.round(fps / 2)) {
    const isMajor = f % secondStep === 0;
    const rTime = RationalTime.fromFrame(f, fps);
    const smpte = rTime.toSMPTE(fps); // HH:MM:SS:FF
    // For major ticks show MM:SS, for minor show :FF
    const label = isMajor ? smpte.slice(3, 8) : `:${smpte.slice(9, 11)}`;
    markers.push({ frame: f, label, isMajor });
  }

  return (
    <div
      onClick={handleClick}
      style={{ width: `${timelineWidth}px` }}
      className="h-6 bg-muted/30 border-b border-border/40 relative select-none cursor-pointer"
    >
      {markers.map((m) => {
        const leftPx = m.frame * pixelsPerFrame;
        return (
          <div
            key={m.frame}
            style={{ left: `${leftPx}px` }}
            className={`absolute top-0 bottom-0 flex flex-col justify-between ${m.isMajor ? 'border-l border-border' : 'border-l border-border/40'
              }`}
          >
            <span
              className={`text-[9px] font-mono pl-1 pointer-events-none select-none ${m.isMajor ? 'text-foreground/80 font-medium' : 'text-muted-foreground/60 text-[8px]'
                }`}
            >
              {m.isMajor ? m.label : ''}
            </span>
            <div className={`w-0.5 ${m.isMajor ? 'h-2 bg-muted-foreground' : 'h-1 bg-border'}`} />
          </div>
        );
      })}
    </div>
  );
}
