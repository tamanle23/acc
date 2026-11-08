import { createSignal, Show } from 'solid-js';
import { Copy, Plus, Trash2, Layers, Check } from 'lucide-solid';
import { type JsonPath, formatJsonPath } from '../types';

export interface VisualJsonNodeContextMenuProps {
  path: JsonPath;
  isArray: boolean;
  isObject: boolean;
  onInsertChild?: (path: JsonPath) => void;
  onDuplicate?: (path: JsonPath) => void;
  onDelete?: (path: JsonPath) => void;
  onCopyPath?: (path: JsonPath) => void;
}

export function VisualJsonNodeContextMenu(props: VisualJsonNodeContextMenuProps) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    const str = formatJsonPath(props.path);
    navigator.clipboard.writeText(str);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    props.onCopyPath?.(props.path);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      class="opacity-0 group-hover/node:opacity-100 transition-opacity flex items-center gap-0.5 ml-2 glass-card px-1 py-0.5 rounded-md shadow-xs shrink-0"
    >
      <button
        type="button"
        onClick={handleCopy}
        class="p-1 rounded text-muted-foreground hover:text-[var(--accent-primary)] hover:bg-[var(--glass-bg)] transition-colors cursor-pointer"
        title="Copy JSON path pointer"
      >
        <Show when={copied()} fallback={<Copy class="w-2.5 h-2.5" />}>
          <Check class="w-2.5 h-2.5 text-emerald-400" />
        </Show>
      </button>

      <Show when={props.isArray && props.onInsertChild}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            props.onInsertChild?.(props.path);
          }}
          class="p-1 rounded text-muted-foreground hover:text-emerald-400 hover:bg-[var(--glass-bg)] transition-colors cursor-pointer"
          title="Add element to array"
        >
          <Plus class="w-2.5 h-2.5" />
        </button>
      </Show>

      <Show when={props.path.length > 0 && props.onDuplicate}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            props.onDuplicate?.(props.path);
          }}
          class="p-1 rounded text-muted-foreground hover:text-[var(--accent-primary)] hover:bg-[var(--glass-bg)] transition-colors cursor-pointer"
          title="Duplicate this node"
        >
          <Layers class="w-2.5 h-2.5" />
        </button>
      </Show>

      <Show when={props.path.length > 0 && props.onDelete}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            props.onDelete?.(props.path);
          }}
          class="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-[var(--glass-bg)] transition-colors cursor-pointer"
          title="Delete this node"
        >
          <Trash2 class="w-2.5 h-2.5" />
        </button>
      </Show>
    </div>
  );
}
