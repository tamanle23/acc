import React from 'react';
import {
  Film,
  Music,
  Type,
  Sparkles,
  Image as ImageIcon,
  Clock,
  Magnet,
  AlertOctagon,
} from 'lucide-react';

export interface ClipDragProxyProps {
  seq: any;
  track: any;
  pixelsPerFrame: number;
  deltaFrames: number;
  snappedStartFrame: number;
  isInvalidDrop?: boolean;
  snapLabel?: string | null;
  getTrackBadgeStyle?: (track: any) => string;
}

/**
 * ClipDragProxy:
 * High-performance, elevated proxy rendered exclusively within @dnd-kit's <DragOverlay>.
 * Visual Model:
 * - Fluidly translates with the pointer in top-level unclipped portal (z-index: 100).
 * - Displays precise SMPTE delta frame micro-pill HUD.
 * - Displays magnetic snap target badge when locked to abutment or playhead.
 * - Highlights red with forbidden state when hovering over incompatible track.
 */
export const ClipDragProxy: React.FC<ClipDragProxyProps> = ({
  seq,
  track,
  pixelsPerFrame,
  deltaFrames,
  snappedStartFrame,
  isInvalidDrop = false,
  snapLabel = null,
  getTrackBadgeStyle,
}) => {
  const durationFrames = seq.durationFrames || 30;
  const widthPx = Math.max(16, durationFrames * pixelsPerFrame);
  const isAudio = seq.type === 'audio' || track?.type === 'audio';

  const durationSec = (durationFrames / 30).toFixed(1);
  const durationBadge = durationFrames >= 30 ? `${durationSec}s` : `${durationFrames}f`;

  return (
    <div
      style={{
        width: `${widthPx}px`,
        height: '32px',
      }}
      className={`rounded-sm border px-2 flex items-center justify-between select-none shadow-2xl scale-[1.02] backdrop-blur-md pointer-events-none transition-transform duration-75 ${
        isInvalidDrop
          ? 'bg-destructive/35 border-destructive text-destructive-foreground ring-2 ring-destructive cursor-not-allowed shadow-[0_0_20px_rgba(239,68,68,0.4)]'
          : 'bg-popover/90 border-accent-theme/80 text-foreground ring-2 ring-accent-theme/90 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
      }`}
    >
      {/* Left Icon & Clip ID */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="shrink-0 opacity-90">
          {isAudio ? (
            <Music className="w-3 h-3 text-emerald-400" />
          ) : seq.type === 'text' || seq.cues?.length ? (
            <Type className="w-3 h-3 text-violet-400" />
          ) : !seq.assetId ? (
            <Sparkles className="w-3 h-3 text-amber-400" />
          ) : seq.type === 'image' ? (
            <ImageIcon className="w-3 h-3 text-blue-400" />
          ) : (
            <Film className="w-3 h-3 text-indigo-400" />
          )}
        </span>
        <span className="font-mono text-[9.5px] font-semibold text-white drop-shadow-xs truncate max-w-[90px]">
          {seq.id}
        </span>
      </div>

      {/* Center / Right Delta HUD Pill */}
      <div className="flex items-center gap-1 shrink-0">
        {snapLabel && (
          <span className="flex items-center gap-0.5 text-[8px] font-mono px-1 py-0.2 rounded bg-amber-400 text-black font-bold uppercase shadow-xs">
            <Magnet className="w-2.5 h-2.5" />
            {snapLabel}
          </span>
        )}

        <span
          className={`text-[8.5px] font-mono px-1.5 py-0.2 rounded font-bold shadow-xs ${
            isInvalidDrop
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-black/90 text-accent-theme border border-accent-theme/50'
          }`}
        >
          {deltaFrames >= 0 ? `+${deltaFrames}f` : `${deltaFrames}f`}
        </span>

        <span className="text-[8px] font-mono text-muted-foreground/80 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {durationBadge}
        </span>
      </div>
    </div>
  );
};
