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

  // Generate markers every second and intermediate frames
  const secondStep = Math.max(1, Math.round(fps));
  const markers: { frame: number; label: string; isMajor: boolean }[] = [];

  for (let f = 0; f <= totalFrames; f += Math.round(fps / 2)) {
    const isMajor = f % secondStep === 0;
    const sec = Math.floor(f / fps);
    const remainderFrames = f % fps;
    const label = isMajor
      ? `00:${sec < 10 ? '0' : ''}${sec}:00`
      : `:${remainderFrames < 10 ? '0' : ''}${remainderFrames}`;
    markers.push({ frame: f, label, isMajor });
  }

  return (
    <div
      onClick={handleClick}
      style={{ width: `${timelineWidth}px` }}
      className="h-6 bg-slate-100 dark:bg-slate-900/60 border-b border-border/40 relative select-none cursor-pointer"
    >
      {markers.map((m) => {
        const leftPx = m.frame * pixelsPerFrame;
        return (
          <div
            key={m.frame}
            style={{ left: `${leftPx}px` }}
            className={`absolute top-0 bottom-0 flex flex-col justify-between ${
              m.isMajor ? 'border-l border-slate-400 dark:border-slate-500' : 'border-l border-slate-300/70 dark:border-slate-700/50'
            }`}
          >
            <span
              className={`text-[9px] font-mono pl-1 pointer-events-none select-none ${
                m.isMajor ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 dark:text-slate-600 text-[8px]'
              }`}
            >
              {m.isMajor ? m.label : ''}
            </span>
            <div className={`w-0.5 ${m.isMajor ? 'h-2 bg-slate-500 dark:bg-slate-400' : 'h-1 bg-slate-300 dark:bg-slate-700'}`} />
          </div>
        );
      })}
    </div>
  );
}
