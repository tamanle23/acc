import { Show } from 'solid-js';
import { Type } from 'lucide-solid';

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

export function InlineTextEditorModal(props: InlineTextEditorModalProps) {
  return (
    <Show when={props.editingCue}>
      {(cue) => (
        <div class="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md pointer-events-auto">
          <div class="glass-panel border-t-[var(--glass-border-highlight)] rounded-2xl p-5 shadow-2xl flex flex-col gap-3.5 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-150">
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="flex items-center gap-1.5 font-bold text-[var(--accent-primary)]">
                <Type class="w-4 h-4 text-[var(--accent-primary)]" />
                Inline Canvas Text Editor
              </span>
              <span class="text-[10px] text-muted-foreground">[Enter to commit, Esc to cancel]</span>
            </div>
            <input
              type="text"
              autofocus
              value={cue().text}
              onInput={(e: any) => props.onUpdateText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  props.onCommit();
                } else if (e.key === 'Escape') {
                  props.onCancel();
                }
              }}
              onBlur={props.onCommit}
              class="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl px-3.5 py-2.5 text-foreground font-mono text-sm focus:outline-hidden focus:border-[var(--accent-primary)] focus:shadow-[0_0_15px_var(--accent-glow)] transition-all shadow-inner"
            />
          </div>
        </div>
      )}
    </Show>
  );
}
