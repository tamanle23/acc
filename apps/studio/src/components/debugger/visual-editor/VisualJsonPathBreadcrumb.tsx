import { createSignal, For, Show } from 'solid-js';
import { ChevronRight, Home, Copy, Check } from 'lucide-solid';
import { type JsonPath, formatJsonPath } from '../types';

export interface VisualJsonPathBreadcrumbProps {
  path: JsonPath;
  onNavigate?: (slicePath: JsonPath) => void;
}

export function VisualJsonPathBreadcrumb(props: VisualJsonPathBreadcrumbProps) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = () => {
    const str = formatJsonPath(props.path);
    navigator.clipboard.writeText(str);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div class="flex items-center justify-between px-3 py-1.5 bg-[var(--glass-bg)]/20 border-b border-[var(--glass-border)] text-xs font-mono text-muted-foreground shrink-0 backdrop-blur-xs">
      <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => props.onNavigate?.([])}
          class="flex items-center gap-1 hover:text-[var(--accent-primary)] text-muted-foreground transition-colors cursor-pointer"
          title="Root Document"
        >
          <Home class="w-3 h-3 text-[var(--accent-primary)]" />
          <span>doc</span>
        </button>

        <For each={props.path}>
          {(segment, idx) => {
            const slice = () => props.path.slice(0, idx() + 1);
            const isLast = () => idx() === props.path.length - 1;
            return (
              <>
                <ChevronRight class="w-3 h-3 text-muted-foreground/40 shrink-0" />
                <button
                  type="button"
                  onClick={() => props.onNavigate?.(slice())}
                  class={`transition-colors truncate max-w-[120px] cursor-pointer ${
                    isLast() ? 'text-[var(--accent-primary)] font-bold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {typeof segment === 'number' ? `[${segment}]` : segment}
                </button>
              </>
            );
          }}
        </For>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        class="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground ml-2 px-1.5 py-0.5 rounded-md glass-card shrink-0 cursor-pointer"
        title="Copy path pointer to clipboard"
      >
        <Show when={copied()} fallback={<Copy class="w-2.5 h-2.5" />}>
          <Check class="w-2.5 h-2.5 text-emerald-400" />
        </Show>
        <span>{copied() ? 'Copied' : 'Copy Pointer'}</span>
      </button>
    </div>
  );
}
