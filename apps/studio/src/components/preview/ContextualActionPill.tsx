import React from 'react';
import { Copy, AlignCenter, Lock, Unlock, RotateCcw, Trash2 } from 'lucide-react';
import { Tooltip } from '../ui/tooltip';

export interface ContextualActionPillProps {
  selectedSeqId: string;
  isLocked: boolean;
  onDuplicate: (seqId: string) => void;
  onCenter: () => void;
  onToggleLock: () => void;
  onResetTransform: () => void;
  onDelete: (seqId: string) => void;
}

export const ContextualActionPill: React.FC<ContextualActionPillProps> = ({
  selectedSeqId,
  isLocked,
  onDuplicate,
  onCenter,
  onToggleLock,
  onResetTransform,
  onDelete,
}) => {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute -top-12 left-1/2 -translate-x-1/2 glass-panel shadow-[0_8px_32px_rgba(0,0,0,0.6)] border border-[var(--glass-border-highlight)] px-2 py-1 rounded-full flex items-center gap-1.5 z-30 select-none pointer-events-auto backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Duplicate */}
      <Tooltip content="Duplicate Sequence (Ctrl+D)">
        <button
          type="button"
          onClick={() => onDuplicate(selectedSeqId)}
          className="p-1 hover:bg-white/15 dark:hover:bg-white/10 rounded-full text-foreground/80 hover:text-foreground active:scale-90 transition-all cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      {/* Center Alignment */}
      <Tooltip content="Center in Canvas">
        <button
          type="button"
          onClick={onCenter}
          className="p-1 hover:bg-white/15 dark:hover:bg-white/10 rounded-full text-foreground/80 hover:text-foreground active:scale-90 transition-all cursor-pointer"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      {/* Lock / Unlock */}
      <Tooltip content={isLocked ? 'Unlock Transform' : 'Lock Transform'}>
        <button
          type="button"
          onClick={onToggleLock}
          className={`p-1 rounded-full active:scale-90 transition-all cursor-pointer ${isLocked
            ? 'text-amber-400 bg-amber-500/15'
            : 'text-foreground/80 hover:text-foreground hover:bg-white/15 dark:hover:bg-white/10'
            }`}
        >
          {isLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>
      </Tooltip>

      {/* Reset Transform */}
      <Tooltip content="Reset Transform">
        <button
          type="button"
          onClick={onResetTransform}
          className="p-1 hover:bg-white/15 dark:hover:bg-white/10 rounded-full text-foreground/80 hover:text-foreground active:scale-90 transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      <div className="w-px h-3.5 bg-[var(--glass-border)] mx-0.5" />

      {/* Delete */}
      <Tooltip content="Delete Sequence (Del)">
        <button
          type="button"
          onClick={() => onDelete(selectedSeqId)}
          className="p-1 hover:bg-rose-500/20 rounded-full text-rose-400 hover:text-rose-300 active:scale-90 transition-all cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
    </div>
  );
};
