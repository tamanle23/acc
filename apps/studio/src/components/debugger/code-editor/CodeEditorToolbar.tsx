import { Wand2, Minimize2, Copy, Check, RotateCcw } from 'lucide-solid';
import { Show } from 'solid-js';

export interface CodeEditorToolbarProps {
  onPrettify: () => void;
  onMinify: () => void;
  onCopy: () => void;
  onReset: () => void;
  copied: boolean;
  canFormat: boolean;
}

export function CodeEditorToolbar(props: CodeEditorToolbarProps) {
  return (
    <div class="flex items-center justify-between px-3 py-1.5 bg-[var(--glass-bg)]/40 border-b border-[var(--glass-border)] shrink-0 backdrop-blur-xs">
      <span class="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
        JSON Source Code
      </span>

      <div class="flex items-center gap-1.5">
        <button
          type="button"
          onClick={props.onPrettify}
          disabled={!props.canFormat}
          title="Format JSON (2-space indentation)"
          class="h-6 px-2 text-[10px] font-mono flex items-center gap-1 glass-card rounded text-foreground hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          <Wand2 class="w-2.5 h-2.5 text-[var(--accent-primary)]" />
          Format
        </button>

        <button
          type="button"
          onClick={props.onMinify}
          disabled={!props.canFormat}
          title="Minify JSON (Compact single-line)"
          class="h-6 px-2 text-[10px] font-mono flex items-center gap-1 glass-card rounded text-foreground hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          <Minimize2 class="w-2.5 h-2.5" />
          Minify
        </button>

        <button
          type="button"
          onClick={props.onCopy}
          class="h-6 px-2 text-[10px] font-mono flex items-center gap-1 glass-card rounded text-foreground hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] cursor-pointer transition-all"
        >
          <Show when={props.copied} fallback={<Copy class="w-2.5 h-2.5" />}>
            <Check class="w-2.5 h-2.5 text-emerald-400" />
          </Show>
          {props.copied ? 'Copied' : 'Copy'}
        </button>

        <button
          type="button"
          onClick={props.onReset}
          title="Reset to live Studio state"
          class="h-6 px-2 text-[10px] font-mono flex items-center gap-1 glass-card rounded text-muted-foreground hover:text-foreground cursor-pointer transition-all"
        >
          <RotateCcw class="w-2.5 h-2.5" />
          Reset
        </button>
      </div>
    </div>
  );
}
