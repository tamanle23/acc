import React from 'react';
import { Film, Music, Type, Sparkles, Clock, Layers } from 'lucide-react';
import { RationalTime } from '@acc/core-isomorphic';

export interface TimelineClipInsightCardProps {
  seq: any;
  track: any;
  fps: number;
}

/**
 * TimelineClipInsightCard:
 * Semantic content card showing clip archetype, duration, SMPTE In/Out, dialogue cues, and active modifiers.
 * Designed to be embedded cleanly inside Shadcn's HoverCardContent.
 */
export const TimelineClipInsightCard: React.FC<TimelineClipInsightCardProps> = ({
  seq,
  track,
  fps,
}) => {
  const startFrame = seq.startFrame ?? 0;
  const durationFrames = seq.durationFrames ?? 30;
  const endFrame = startFrame + durationFrames;

  const startSMPTE = RationalTime.fromFrame(startFrame, fps).toSMPTE(fps);
  const endSMPTE = RationalTime.fromFrame(endFrame, fps).toSMPTE(fps);
  const durationSMPTE = RationalTime.fromFrame(durationFrames, fps).toSMPTE(fps);

  const isAudio = track?.type === 'audio' || seq.type === 'audio';
  const isText = track?.type === 'text' || track?.type === 'timed_text' || seq.type === 'text' || Boolean(seq.cues?.length);
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
    <div className="flex flex-col w-full text-foreground select-none pointer-events-none">
      {/* 1. Header with Archetype & Duration */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border/50">
        <div className="flex items-center gap-1.5 min-w-0">
          {getArchetypeIcon()}
          <span className="font-mono font-semibold text-xs truncate text-foreground">{seq.name || seq.id}</span>
          <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-muted/60 text-muted-foreground border border-border/50">
            {track?.type || 'media'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 font-mono text-[10px] text-accent-theme">
          <Clock className="w-3 h-3 text-accent-theme" />
          <span>{durationSMPTE} ({durationFrames}f)</span>
        </div>
      </div>

      {/* 2. Boundary Metrics (In / Out) */}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground mb-2 bg-black/20 p-1.5 rounded-lg border border-border/40">
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
