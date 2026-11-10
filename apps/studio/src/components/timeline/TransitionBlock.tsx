import { Film } from 'lucide-solid';
import type { ModifierNode } from '@acc/ir';

export interface TransitionBlockProps {
  transitionModifier: ModifierNode;
  sequenceId: string;
  pixelsPerFrame: number;
  onClick?: (e: MouseEvent) => void;
}

export type TimelineTransitionBlockProps = TransitionBlockProps;

/**
 * TransitionBlock:
 * Renders a stylized transition handle / badge directly on the incoming sequence's cut edge.
 * Visualizes the transition duration footprint and type icon (crossfade, wipe, push, zoom, dip, glitch).
 */
export function TransitionBlock(props: TransitionBlockProps) {
  const p = () => (props.transitionModifier.params || {}) as Record<string, unknown>;
  const durationFrames = () => (typeof p().durationFrames === 'number' ? (p().durationFrames as number) : 15);
  const transType = () =>
    (typeof p().transitionType === 'string' && (p().transitionType as string)) ||
    props.transitionModifier.type.split('/').pop() ||
    'transition';
  const widthPx = () => Math.max(16, durationFrames() * props.pixelsPerFrame);

  const getTransitionBadgeColor = () => {
    switch (transType()) {
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
      onClick={props.onClick}
      style={{ width: `${widthPx()}px` }}
      class={`absolute left-0 top-0 bottom-0 z-20 pointer-events-auto cursor-pointer flex items-center justify-between px-1 bg-gradient-to-r ${getTransitionBadgeColor()} border-r border-t border-b shadow-2xs backdrop-blur-xs select-none hover:brightness-110 transition-all`}
      title={`Transition: ${transType()} (${durationFrames()}f) - Click to inspect`}
    >
      <div class="flex items-center gap-0.5 truncate pointer-events-none">
        <Film class="w-2.5 h-2.5 shrink-0 opacity-80" />
        <span class="text-[8px] font-mono font-bold uppercase truncate max-w-[40px]">
          {transType()}
        </span>
      </div>
      <span class="text-[7px] font-mono bg-black/40 px-1 py-0.2 rounded-xs shrink-0 pointer-events-none">
        {durationFrames()}f
      </span>
    </div>
  );
}

// Backward-compatible alias
export const TimelineTransitionBlock = TransitionBlock;
