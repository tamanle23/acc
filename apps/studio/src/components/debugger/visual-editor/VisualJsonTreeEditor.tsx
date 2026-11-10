import { createSignal, Show } from 'solid-js';
import { Search, Sparkles } from 'lucide-solid';
import { Input } from '../../ui/input';
import {
  type JsonPath,
  setJsonValueAtPath,
  deleteJsonValueAtPath,
  insertJsonArrayItem,
  getJsonValueAtPath,
} from '../types';
import { VisualJsonTreeNode } from './VisualJsonTreeNode';
import { VisualJsonPathBreadcrumb } from './VisualJsonPathBreadcrumb';

export interface VisualJsonTreeEditorProps {
  data: unknown;
  onChange: (newData: unknown) => void;
  onSelectSequence?: (seqId: string) => void;
  class?: string;
  className?: string;
}

export function VisualJsonTreeEditor(props: VisualJsonTreeEditorProps) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [activeFocusedPath, setActiveFocusedPath] = createSignal<JsonPath>([]);

  // Mutator Callbacks
  const handleUpdateValue = (path: JsonPath, newValue: unknown) => {
    const updated = setJsonValueAtPath(props.data, path, newValue);
    props.onChange(updated);
  };

  const handleDelete = (path: JsonPath) => {
    const updated = deleteJsonValueAtPath(props.data, path);
    props.onChange(updated);
    if (activeFocusedPath().length >= path.length) {
      setActiveFocusedPath(path.slice(0, -1));
    }
  };

  const handleDuplicate = (path: JsonPath) => {
    const target = getJsonValueAtPath(props.data, path);
    if (target === undefined) return;
    const parentPath = path.slice(0, -1);
    const parentVal = getJsonValueAtPath(props.data, parentPath);

    if (Array.isArray(parentVal)) {
      const idx = Number(path[path.length - 1]);
      const deepCopied = JSON.parse(JSON.stringify(target));
      if (deepCopied && typeof deepCopied === 'object' && typeof deepCopied.id === 'string') {
        deepCopied.id = `${deepCopied.id}-copy-${Date.now().toString(36).slice(-4)}`;
      }
      const updated = insertJsonArrayItem(props.data, parentPath, deepCopied, idx + 1);
      props.onChange(updated);
    } else {
      // In object: duplicate with appended key
      const key = String(path[path.length - 1]);
      const newKey = `${key}_copy`;
      const deepCopied = JSON.parse(JSON.stringify(target));
      const updated = setJsonValueAtPath(props.data, [...parentPath, newKey], deepCopied);
      props.onChange(updated);
    }
  };

  const handleInsertChild = (path: JsonPath) => {
    const target = getJsonValueAtPath(props.data, path);
    if (!Array.isArray(target)) return;

    // Smart template guessing based on array parent name
    const parentKey = String(path[path.length - 1]);
    let newItem: any = {};
    if (parentKey === 'tracks') {
      newItem = {
        id: `track-${Date.now().toString(36).slice(-4)}`,
        type: 'video',
        sequences: [],
      };
    } else if (parentKey === 'sequences') {
      newItem = {
        id: `seq-${Date.now().toString(36).slice(-4)}`,
        name: 'New Sequence',
        time: { start: 0, duration: 60 },
      };
    } else if (parentKey === 'modifiers') {
      newItem = {
        type: 'fx/bloom',
        params: { intensity: 1.0 },
      };
    } else {
      newItem = 'new_item';
    }

    const updated = insertJsonArrayItem(props.data, path, newItem);
    props.onChange(updated);
  };

  return (
    <Show
      when={props.data !== null && typeof props.data === 'object'}
      fallback={
        <div class="p-8 text-center text-muted-foreground font-mono text-xs">
          No valid JSON object loaded to edit visually.
        </div>
      }
    >
      <div
        class={`flex flex-col h-full bg-[var(--glass-bg)]/30 backdrop-blur-xs ${
          props.class || props.className || ''
        }`}
      >
        {/* Search & Tree Toolbar */}
        <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--glass-border)] bg-[var(--glass-bg)]/40 gap-2 shrink-0">
          <div class="relative flex-1 max-w-sm">
            <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search keys, values, sequence IDs..."
              value={searchQuery()}
              onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) => setSearchQuery(e.currentTarget.value)}
              class="h-7 pl-8 text-xs font-mono bg-[var(--glass-bg)] border-[var(--glass-border)] text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]"
            />
          </div>

          <div class="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span class="flex items-center gap-1 text-[10px] bg-[var(--glass-bg)] px-2 py-0.5 rounded-full border border-[var(--glass-border)] text-muted-foreground">
              <Sparkles class="w-3 h-3 text-[var(--accent-primary)]" />
              Visual In-Place Mode
            </span>
          </div>
        </div>

        {/* Path Breadcrumb Tracker */}
        <VisualJsonPathBreadcrumb
          path={activeFocusedPath()}
          onNavigate={(slice) => setActiveFocusedPath(slice)}
        />

        {/* Tree View Canvas */}
        <div class="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono">
          <VisualJsonTreeNode
            label="root"
            value={props.data}
            path={[]}
            depth={0}
            searchQuery={searchQuery()}
            onUpdateValue={handleUpdateValue}
            onInsertChild={handleInsertChild}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onSelectSequence={props.onSelectSequence}
            onFocusPath={(p) => setActiveFocusedPath(p)}
          />
        </div>
      </div>
    </Show>
  );
}
