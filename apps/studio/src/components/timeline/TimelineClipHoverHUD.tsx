import React from 'react';
import { Film, Music, Type, Sparkles, Box, Clock, Layers } from 'lucide-react';
import { RationalTime } from '@acc/core-isomorphic';

export interface TimelineClipHoverHUDProps {
  seq: any;
  track: any;
  fps: number;
  pixelsPerFrame: number;
  position: { leftPx: number; topPx: number; widthPx: number };
}

export const TimelineClipHoverHUD: React.FC<TimelineClipHoverHUDProps> = ({
  seq,
  track,
  fps,
  position,
}) => {
  const startFrame = seq.startFrame ?? 0;
  const durationFrames = seq.durationFrames ?? 30;
  const endFrame = startFrame + durationFrames;

  const startSMPTE = RationalTime.fromFrame(startFrame, fps).toSMPTE(fps);
  const endSMPTE = RationalTime.fromFrame(endFrame, fps).toSMPTE(fps);
  const durationSMPTE = RationalTime.fromFrame(durationFrames, fps).toSMPTE(fps);
  const durationSec = (durationFrames / fps).toFixed(2);

  const isAudio = track.type === 'audio';
  const isText = track.type === 'text' || seq.type === 'text' || Boolean(seq.cues?.length);
  const isFx = seq.modifiers?.some((m: any) => m.type.startsWith('vfx/'));

  const getArchetypeIcon = () => {
    if (isAudio) return <Music className="w-3.5 h-3.5 text-emerald-400" />;
    if (isText) return <Type className="w-3.5 h-3.5 text-violet-400" />;
    if (isFx) return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
    return <Film className="w-3.5 h-3.5 text-indigo-400" />;
  };

  const modifiers: any[] = seq.modifiers || [];
  const cueText = seq.cues?.[0]?.text;

  return (
    <div
      style={{
        left: `${Math.max(16, position.leftPx)}px`,
        bottom: `${Math.max(48, position.topPx)}px`,
      }}
      className="absolute z-50 pointer-events-none glass-panel border border-glass-border shadow-2xl rounded-xl p-3 min-w-[280px] max-w-sm text-foreground animate-in fade-in zoom-in-95 duration-100 backdrop-blur-xl"
    >
      {/* 1. Header with Archetype & Duration */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-glass-border">
        <div className="flex items-center gap-1.5 min-w-0">
          {getArchetypeIcon()}
          <span className="font-mono font-semibold text-xs truncate text-foreground">{seq.name || seq.id}</span>
          <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-muted/60 text-muted-foreground border border-glass-border">
            {track.type}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 font-mono text-[10px] text-accent-theme">
          <Clock className="w-3 h-3 text-accent-theme" />
          <span>{durationSMPTE} ({durationFrames}f)</span>
        </div>
      </div>

      {/* 2. Boundary Metrics (In / Out) */}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground mb-2 bg-black/20 p-1.5 rounded-lg border border-glass-border/40">
        <div>
          <span className="text-[9px] uppercase text-muted-foreground/60 block">In Point</span>
          <span className="text-foreground font-semibold">{startSMPTE}</span>
          <span className="text-[9px] ml-1 text-muted-foreground">({startFrame}f)</span>
        </div>
        <div>
          <span className="text-[9px] uppercase text-muted-foreground/60 block">Out Point</span>
          <span className="text-foreground font-semibold">{endSMPTE}</span>
          <span className="text-[9px] ml-1 text-muted-foreground">({endFrame}f)</span>
        </div>
      </div>

      {/* 3. Dialogue Cue Preview (if any) */}
      {cueText && (
        <div className="mb-2 text-[11px] font-sans italic text-violet-200 bg-violet-950/40 border border-violet-500/30 p-2 rounded-lg">
          "{cueText}"
        </div>
      )}

      {/* 4. Active Modifiers Chips */}
      {modifiers.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center pt-1">
          <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-0.5 mr-1">
            <Layers className="w-2.5 h-2.5" /> Modifiers ({modifiers.length}):
          </span>
          {modifiers.slice(0, 4).map((m: any, idx: number) => {
            const shortName = m.type.split('/').pop() || m.type;
            return (
              <span
                key={idx}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-accent-theme/10 border border-accent-theme/30 text-accent-theme truncate max-w-[100px]"
              >
                {shortName}
              </span>
            );
          })}
          {modifiers.length > 4 && (
            <span className="text-[9px] font-mono text-muted-foreground">+{modifiers.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
};
