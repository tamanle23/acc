import { createSignal, createMemo, Show, For, type JSX } from 'solid-js';
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  ArrowUpDown,
  HardDrive,
  Trash2,
} from 'lucide-solid';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { formatOpfsBytes, type OpfsTreeNode } from '@acc/core-web';
import { type OpfsFilterType, type OpfsSortField, type OpfsSortDirection } from './types';

/**
 * Helper to determine whether an OPFS node is a companion metadata file (*.meta.json)
 */
export function isMetadataFile(node: OpfsTreeNode): boolean {
  return Boolean(node.isMetadata || /\.meta\.json$/i.test(node.name));
}

interface OpfsTreeProps {
  rootNode: OpfsTreeNode | null;
  selectedPath: string | null;
  onSelectNode: (node: OpfsTreeNode) => void;
  onDeleteNode?: (name: string, isDirectory?: boolean) => void;
}

function renderIcon(node: OpfsTreeNode, isOpen: boolean) {
  if (node.kind === 'directory') {
    return isOpen ? (
      <FolderOpen class="w-4 h-4 text-accent-theme shrink-0" />
    ) : (
      <Folder class="w-4 h-4 text-accent-theme shrink-0" />
    );
  }

  const mime = node.mimeType || '';
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(node.name)) {
    return <ImageIcon class="w-4 h-4 text-emerald-400 shrink-0" />;
  }
  if (mime.startsWith('audio/') || /\.(wav|mp3|aac|ogg)$/i.test(node.name)) {
    return <FileAudio class="w-4 h-4 text-cyan-400 shrink-0" />;
  }
  if (mime.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(node.name)) {
    return <FileVideo class="w-4 h-4 text-violet-400 shrink-0" />;
  }
  if (node.isMetadata) {
    return <FileCode class="w-4 h-4 text-amber-400 shrink-0" />;
  }
  if (mime === 'application/json' || node.name.endsWith('.json')) {
    return <FileCode class="w-4 h-4 text-amber-300 shrink-0" />;
  }
  return <FileText class="w-4 h-4 text-slate-400 shrink-0" />;
}

export function OpfsTree(props: OpfsTreeProps) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [filterType, setFilterType] = createSignal<OpfsFilterType>('all');
  const [sortField, setSortField] = createSignal<OpfsSortField>('name');
  const [sortDirection, setSortDirection] = createSignal<OpfsSortDirection>('asc');
  const [expandedFolders, setExpandedFolders] = createSignal<Record<string, boolean>>({
    acc_content_cache: true,
  });

  const toggleFolder = (path: string, e: MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !(prev[path] !== false),
    }));
  };

  // Filter predicate
  const filterNode = (node: OpfsTreeNode): boolean => {
    if (isMetadataFile(node)) {
      return false;
    }

    const query = searchQuery().trim();
    if (node.kind === 'directory') {
      if (query) {
        const q = query.toLowerCase();
        const matchDirName = node.name.toLowerCase().includes(q);
        return matchDirName || (node.children ? node.children.some(filterNode) : false);
      }
      return node.children ? (node.children.length === 0 ? true : node.children.some(filterNode)) : true;
    }

    if (query) {
      const q = query.toLowerCase();
      const matchName = node.name.toLowerCase().includes(q);
      const matchKey = node.decodedKey?.toLowerCase().includes(q) || false;
      if (!matchName && !matchKey) return false;
    }

    const filter = filterType();
    if (filter === 'all') return true;
    if (filter === 'json') return node.mimeType === 'application/json' || node.name.endsWith('.json');
    if (filter === 'media') {
      const m = node.mimeType.toLowerCase();
      return m.startsWith('image/') || m.startsWith('audio/') || m.startsWith('video/');
    }
    if (filter === 'other') {
      const m = node.mimeType.toLowerCase();
      return !node.name.endsWith('.json') && !m.startsWith('image/') && !m.startsWith('audio/') && !m.startsWith('video/');
    }

    return true;
  };

  const sortNodes = (nodes: OpfsTreeNode[]): OpfsTreeNode[] => {
    const field = sortField();
    const dir = sortDirection();

    return [...nodes].sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }

      let diff = 0;
      if (field === 'name') {
        diff = a.name.localeCompare(b.name);
      } else if (field === 'size') {
        diff = a.sizeBytes - b.sizeBytes;
      } else if (field === 'date') {
        diff = a.lastModified - b.lastModified;
      }

      return dir === 'asc' ? diff : -diff;
    });
  };

  const renderTree = (node: OpfsTreeNode, depth: number = 0): JSX.Element => {
    const isDir = node.kind === 'directory';
    const isExpanded = () => expandedFolders()[node.path] !== false;
    const isSelected = () => props.selectedPath === node.path;
    const paddingLeft = `${depth * 14 + 10}px`;

    const visibleChildren = () =>
      isDir && node.children ? sortNodes(node.children.filter(filterNode)) : [];

    return (
      <div class="select-none text-xs">
        <div
          onClick={() => {
            if (isDir) {
              setExpandedFolders((prev) => ({ ...prev, [node.path]: !(prev[node.path] !== false) }));
            }
            props.onSelectNode(node);
          }}
          style={{ "padding-left": paddingLeft }}
          class={`flex items-center justify-between py-1.5 pr-2.5 rounded-lg cursor-pointer transition-colors group ${
            isSelected()
              ? 'bg-accent-theme/20 text-accent-theme font-medium border-l-2 border-accent-theme shadow-xs'
              : 'text-foreground/90 hover:bg-muted/60'
          }`}
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <Show
              when={isDir}
              fallback={<span class="w-3.5" />}
            >
              <button
                type="button"
                onClick={(e) => toggleFolder(node.path, e)}
                class="p-0.5 hover:text-foreground text-muted-foreground"
              >
                <Show when={isExpanded()} fallback={<ChevronRight class="w-3.5 h-3.5" />}>
                  <ChevronDown class="w-3.5 h-3.5" />
                </Show>
              </button>
            </Show>

            {renderIcon(node, isExpanded())}

            <span class="truncate font-mono text-[11px]" title={node.name}>
              {node.name}
            </span>

            <Show when={node.isMetadata}>
              <Badge variant="outline" class="text-[9px] px-1 py-0 h-4 border-amber-500/30 text-amber-400 bg-amber-500/10 shrink-0">
                meta
              </Badge>
            </Show>
          </div>

          <div class="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100">
            <span class="text-[10px] text-muted-foreground font-mono">
              {formatOpfsBytes(node.sizeBytes)}
            </span>
            <Show when={props.onDeleteNode && !isDir}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDeleteNode?.(node.name, false);
                }}
                title="Delete this file"
                class="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-opacity text-muted-foreground cursor-pointer"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </Show>
          </div>
        </div>

        {/* Render Children Recursively */}
        <Show when={isDir && isExpanded()}>
          <Show
            when={visibleChildren().length > 0}
            fallback={
              <div
                style={{ "padding-left": `${(depth + 1) * 14 + 24}px` }}
                class="py-2 pr-2 text-[11px] font-mono text-muted-foreground/70 italic"
              >
                (Empty directory — click "+ Write Test File" or ingest media in Assets Vault)
              </div>
            }
          >
            <div class="flex flex-col">
              <For each={visibleChildren()}>
                {(child) => renderTree(child, depth + 1)}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    );
  };

  const filteredRoot = createMemo(() => {
    const rootNode = props.rootNode;
    if (!rootNode) return null;
    if (rootNode.kind === 'file' && isMetadataFile(rootNode)) {
      return null;
    }
    return rootNode;
  });

  return (
    <div class="flex flex-col h-full border-r border-border/50 bg-background/50">
      {/* Search & Filter Header */}
      <div class="p-3 border-b border-border/50 flex flex-col gap-2">
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
          <Input
            value={searchQuery()}
            onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search files or cache keys..."
            class="h-8 pl-8 pr-7 text-xs font-mono bg-muted/40 border-border/60"
          />
          <Show when={searchQuery()}>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              class="absolute right-2 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </Show>
        </div>

        {/* Filter Chips */}
        <div class="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px] font-mono no-scrollbar">
          <For each={['all', 'media', 'json', 'other'] as OpfsFilterType[]}>
            {(f) => (
              <button
                type="button"
                onClick={() => setFilterType(f)}
                class={`px-2 py-0.5 rounded-md uppercase font-semibold transition-colors cursor-pointer shrink-0 ${
                  filterType() === f
                    ? 'bg-accent-theme/20 text-accent-theme border border-accent-theme/40'
                    : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-transparent'
                }`}
              >
                {f}
              </button>
            )}
          </For>

          <div class="ml-auto shrink-0 flex items-center">
            <button
              type="button"
              onClick={() => {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
              }}
              title={`Sort: ${sortField()} (${sortDirection()})`}
              class="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ArrowUpDown class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Tree Content */}
      <div class="flex-1 overflow-auto p-2">
        <Show
          when={filteredRoot()}
          fallback={
            <div class="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs text-center p-4 font-mono">
              <HardDrive class="w-8 h-8 mb-2 opacity-50" />
              No OPFS directory loaded
            </div>
          }
        >
          {(root) => renderTree(root())}
        </Show>
      </div>
    </div>
  );
}
