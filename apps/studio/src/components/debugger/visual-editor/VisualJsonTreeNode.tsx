import { createSignal, createEffect, createMemo, Show, For } from 'solid-js';
import { ChevronRight, ChevronDown } from 'lucide-solid';
import { Badge } from '../../ui/badge';
import { type JsonPath } from '../types';
import { VisualJsonFieldEditor } from './VisualJsonFieldEditor';
import { VisualJsonNodeContextMenu } from './VisualJsonNodeContextMenu';

export interface VisualJsonTreeNodeProps {
  label: string;
  value: unknown;
  path: JsonPath;
  depth?: number;
  searchQuery?: string;
  onUpdateValue: (path: JsonPath, newValue: unknown) => void;
  onInsertChild?: (path: JsonPath) => void;
  onDuplicate?: (path: JsonPath) => void;
  onDelete?: (path: JsonPath) => void;
  onSelectSequence?: (seqId: string) => void;
  onFocusPath?: (path: JsonPath) => void;
}

export function VisualJsonTreeNode(props: VisualJsonTreeNodeProps) {
  const depth = () => props.depth ?? 0;
  const [expanded, setExpanded] = createSignal(depth() < 2);

  const isObject = () => props.value !== null && typeof props.value === 'object';
  const isArray = () => Array.isArray(props.value);

  // Search match logic
  const matchesSearch = createMemo(() => {
    const q = props.searchQuery?.trim();
    if (!q) return false;
    const lowerQ = q.toLowerCase();
    return (
      props.label.toLowerCase().includes(lowerQ) ||
      (!isObject() && String(props.value).toLowerCase().includes(lowerQ))
    );
  });

  // Auto-expand if child or node matches search
  createEffect(() => {
    if (matchesSearch()) {
      setExpanded(true);
    }
  });

  const handleNodeClick = () => {
    props.onFocusPath?.(props.path);
    if (isObject()) {
      setExpanded((prev) => !prev);
    }
  };

  const entries = createMemo(() => {
    if (!isObject()) return [];
    if (isArray()) {
      return (props.value as unknown[]).map((v, idx) => [String(idx), v] as const);
    }
    return Object.entries(props.value as Record<string, unknown>);
  });

  const objId = () => {
    if (!isArray() && props.value && typeof (props.value as any).id === 'string') {
      return (props.value as any).id as string;
    }
    return null;
  };

  const objType = () => {
    if (!isArray() && props.value && typeof (props.value as any).type === 'string') {
      return (props.value as any).type as string;
    }
    return null;
  };

  const objName = () => {
    if (!isArray() && props.value && typeof (props.value as any).name === 'string') {
      return (props.value as any).name as string;
    }
    return null;
  };

  return (
    <Show
      when={isObject()}
      fallback={
        /* 1. Primitive leaf node */
        <div
          class={`group/node flex items-center justify-between py-1 px-2 rounded text-[11px] font-mono transition-colors ${
            matchesSearch() ? 'bg-accent-theme/20 ring-1 ring-accent-theme' : 'hover:bg-foreground/5'
          }`}
          style={{ "padding-left": `${depth() * 14 + 10}px` }}
          onClick={() => props.onFocusPath?.(props.path)}
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-muted-foreground select-none">{props.label}:</span>
            <VisualJsonFieldEditor
              fieldKey={props.label}
              value={props.value}
              path={props.path}
              onUpdate={props.onUpdateValue}
            />
          </div>

          <VisualJsonNodeContextMenu
            path={props.path}
            isArray={false}
            isObject={false}
            onDuplicate={props.onDuplicate}
            onDelete={props.onDelete}
          />
        </div>
      }
    >
      {/* 2. Object or Array composite node */}
      <div class="select-none">
        <div
          onClick={handleNodeClick}
          class={`group/node flex items-center justify-between py-1 px-2 rounded cursor-pointer text-[11px] font-mono transition-colors ${
            matchesSearch() ? 'bg-accent-theme/20 ring-1 ring-accent-theme' : 'hover:bg-foreground/5'
          }`}
          style={{ "padding-left": `${depth() * 14}px` }}
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              class="p-0.5 text-muted-foreground hover:text-foreground shrink-0 focus:outline-hidden"
            >
              <Show when={expanded()} fallback={<ChevronRight class="w-3.5 h-3.5" />}>
                <ChevronDown class="w-3.5 h-3.5" />
              </Show>
            </button>

            <span class="text-foreground font-semibold tracking-wide">{props.label}</span>

            <Show when={objName()}>
              {(name) => (
                <span class="text-foreground/80 font-sans text-[10px] truncate max-w-[120px] bg-glass-surface border border-glass-border px-1.5 py-0.2 rounded-md">
                  "{name()}"
                </span>
              )}
            </Show>

            <Show when={objId()}>
              {(id) => (
                <Badge
                  variant="outline"
                  class="text-[9px] py-0 px-1 font-mono border-accent-theme/40 text-accent-theme bg-accent-theme/10 shrink-0"
                >
                  #{id()}
                </Badge>
              )}
            </Show>

            <Show when={objType()}>
              {(type) => (
                <Badge
                  variant="outline"
                  class="text-[9px] py-0 px-1 font-mono border-purple-500/40 text-purple-500 dark:text-purple-300 bg-purple-500/10 shrink-0"
                >
                  {type()}
                </Badge>
              )}
            </Show>

            <span class="text-[10px] text-muted-foreground font-mono">
              {isArray() ? `[${entries().length}]` : `{${entries().length}}`}
            </span>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <Show when={objId() && objId()!.startsWith('seq-') && props.onSelectSequence}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onSelectSequence?.(objId()!);
                }}
                class="h-5 px-1.5 text-[9px] font-mono rounded glass-pill text-accent-theme hover:text-foreground cursor-pointer"
              >
                Inspect Clip
              </button>
            </Show>

            <VisualJsonNodeContextMenu
              path={props.path}
              isArray={isArray()}
              isObject={true}
              onInsertChild={props.onInsertChild}
              onDuplicate={props.onDuplicate}
              onDelete={props.onDelete}
            />
          </div>
        </div>

        <Show when={expanded()}>
          <div class="border-l border-[var(--glass-border)] ml-3">
            <For each={entries()}>
              {([k, v]) => (
                <VisualJsonTreeNode
                  label={k}
                  value={v}
                  path={[...props.path, isArray() ? Number(k) : k]}
                  depth={depth() + 1}
                  searchQuery={props.searchQuery}
                  onUpdateValue={props.onUpdateValue}
                  onInsertChild={props.onInsertChild}
                  onDuplicate={props.onDuplicate}
                  onDelete={props.onDelete}
                  onSelectSequence={props.onSelectSequence}
                  onFocusPath={props.onFocusPath}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}
