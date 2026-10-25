import React from 'react';
import { Type } from 'lucide-react';
import { IRStateManager } from '../../lib/ir/irState';

export interface InlineTextEditorModalProps {
  editingCue: {
    sequenceId: string;
    cueIndex: number;
    text: string;
  } | null;
  onUpdateText: (text: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

export function InlineTextEditorModal({
  editingCue,
  onUpdateText,
  onCommit,
  onCancel,
}: InlineTextEditorModalProps) {
  if (!editingCue) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md pointer-events-auto">
      <div className="glass-panel border-t-[var(--glass-border-highlight)] rounded-2xl p-5 shadow-2xl flex flex-col gap-3.5 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="flex items-center gap-1.5 font-bold text-[var(--accent-primary)]">
            <Type className="w-4 h-4 text-[var(--accent-primary)]" />
            Inline Canvas Text Editor
          </span>
          <span className="text-[10px] text-muted-foreground">[Enter to commit, Esc to cancel]</span>
        </div>
        <input
          type="text"
          autoFocus
          value={editingCue.text}
          onChange={(e) => onUpdateText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onCommit();
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
          onBlur={onCommit}
          className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl px-3.5 py-2.5 text-foreground font-mono text-sm focus:outline-hidden focus:border-[var(--accent-primary)] focus:shadow-[0_0_15px_var(--accent-glow)] transition-all shadow-inner"
        />
      </div>
    </div>
  );
}
