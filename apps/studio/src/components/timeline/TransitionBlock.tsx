import React from 'react';
import { Film, Sparkles, Layers } from 'lucide-react';
import type { ModifierNode } from '@acc/ir';

export interface TransitionBlockProps {
  transitionModifier: ModifierNode;
  sequenceId: string;
  pixelsPerFrame: number;
  onClick?: (e: React.MouseEvent) => void;
}

export type TimelineTransitionBlockProps = TransitionBlockProps;

/**
 * TransitionBlock:
 * Renders a stylized transition handle / badge directly on the incoming sequence's cut edge.
 * Visualizes the transition duration footprint and type icon (crossfade, wipe, push, zoom, dip, glitch).
 */
export const TransitionBlock: React.FC<TransitionBlockProps> = ({
  transitionModifier,
  sequenceId,
  pixelsPerFrame,
  onClick,
}) => {
  const p = (transitionModifier.params || {}) as Record<string, unknown>;
  const durationFrames = typeof p.durationFrames === 'number' ? p.durationFrames : 15;
  const transType =
    (typeof p.transitionType === 'string' && p.transitionType) ||
    transitionModifier.type.split('/').pop() ||
    'transition';
  const widthPx = Math.max(16, durationFrames * pixelsPerFrame);

  const getTransitionBadgeColor = () => {
    switch (transType) {
      case 'crossfade':
        return 'from-indigo-600/70 to-blue-500/70 border-indigo-400/60 text-white';
      case 'wipe':
        return 'from-emerald-600/70 to-teal-500/70 border-emerald-400/60 text-white';
      case 'push':
        return 'from-violet-600/70 to-purple-500/70 border-violet-400/60 text-white';
      case 'zoom':
        return 'from-amber-600/70 to-orange-500/70 border-amber-400/60 text-white';
      case 'dip':
        return 'from-slate-700/80 to-zinc-900/80 border-zinc-500/60 text-white';
      case 'glitch':
        return 'from-pink-600/70 to-rose-500/70 border-pink-400/60 text-white';
      default:
        return 'from-blue-600/70 to-indigo-500/70 border-blue-400/60 text-white';
    }
  };

  return (
    <div
      onClick={onClick}
      style={{ width: `${widthPx}px` }}
      className={`absolute left-0 top-0 bottom-0 z-20 pointer-events-auto cursor-pointer flex items-center justify-between px-1 bg-gradient-to-r ${getTransitionBadgeColor()} border-r border-t border-b shadow-2xs backdrop-blur-xs select-none hover:brightness-110 transition-all`}
      title={`Transition: ${transType} (${durationFrames}f) - Click to inspect`}
    >
      <div className="flex items-center gap-0.5 truncate pointer-events-none">
        <Film className="w-2.5 h-2.5 shrink-0 opacity-80" />
        <span className="text-[8px] font-mono font-bold uppercase truncate max-w-[40px]">
          {transType}
        </span>
      </div>
      <span className="text-[7px] font-mono bg-black/40 px-1 py-0.2 rounded-xs shrink-0 pointer-events-none">
        {durationFrames}f
      </span>
    </div>
  );
};

// Backward-compatible alias
export const TimelineTransitionBlock = TransitionBlock;

