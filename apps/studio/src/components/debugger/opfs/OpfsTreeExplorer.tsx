import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Filter,
  ArrowUpDown,
  HardDrive,
  Trash2,
} from 'lucide-react';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { formatOpfsBytes, type OpfsTreeNode } from '@acc/core-web';
import type { OpfsFilterType, OpfsSortField, OpfsSortDirection } from './types';

interface OpfsTreeExplorerProps {
  rootNode: OpfsTreeNode | null;
  selectedPath: string | null;
  onSelectNode: (node: OpfsTreeNode) => void;
  onDeleteNode?: (name: string, isDirectory?: boolean) => void;
}

export function OpfsTreeExplorer({
  rootNode,
  selectedPath,
  onSelectNode,
  onDeleteNode,
}: OpfsTreeExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<OpfsFilterType>('all');
  const [sortField, setSortField] = useState<OpfsSortField>('name');
  const [sortDirection, setSortDirection] = useState<OpfsSortDirection>('asc');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    acc_content_cache: true,
  });

  const toggleFolder = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  // Filter and sort predicate
  const filterNode = (node: OpfsTreeNode): boolean => {
    if (node.kind === 'directory') {
      // Directory matches if any of its children matches
      return node.children ? node.children.some(filterNode) : true;
    }

    // Check search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = node.name.toLowerCase().includes(q);
      const matchKey = node.decodedKey?.toLowerCase().includes(q) || false;
      if (!matchName && !matchKey) return false;
    }

    // Check filter category
    if (filterType === 'all') return true;
    if (filterType === 'meta') return node.isMetadata;
    if (filterType === 'json') return node.mimeType === 'application/json' || node.name.endsWith('.json');
    if (filterType === 'media') {
      const m = node.mimeType.toLowerCase();
      return m.startsWith('image/') || m.startsWith('audio/') || m.startsWith('video/');
    }
    if (filterType === 'other') {
      const m = node.mimeType.toLowerCase();
      return !node.isMetadata && !node.name.endsWith('.json') && !m.startsWith('image/') && !m.startsWith('audio/') && !m.startsWith('video/');
    }

    return true;
  };

  const sortNodes = (nodes: OpfsTreeNode[]): OpfsTreeNode[] => {
    return [...nodes].sort((a, b) => {
      // Always put directories first
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }

      let diff = 0;
      if (sortField === 'name') {
        diff = a.name.localeCompare(b.name);
      } else if (sortField === 'size') {
        diff = a.sizeBytes - b.sizeBytes;
      } else if (sortField === 'date') {
        diff = a.lastModified - b.lastModified;
      }

      return sortDirection === 'asc' ? diff : -diff;
    });
  };

  const renderIcon = (node: OpfsTreeNode, isOpen: boolean) => {
    if (node.kind === 'directory') {
      return isOpen ? (
        <FolderOpen className="w-4 h-4 text-accent-theme shrink-0" />
      ) : (
        <Folder className="w-4 h-4 text-accent-theme shrink-0" />
      );
    }

    const mime = node.mimeType || '';
    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(node.name)) {
      return <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (mime.startsWith('audio/') || /\.(wav|mp3|aac|ogg)$/i.test(node.name)) {
      return <FileAudio className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
    if (mime.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(node.name)) {
      return <FileVideo className="w-4 h-4 text-violet-400 shrink-0" />;
    }
    if (node.isMetadata) {
      return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;
    }
    if (mime === 'application/json' || node.name.endsWith('.json')) {
      return <FileCode className="w-4 h-4 text-amber-300 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const renderTree = (node: OpfsTreeNode, depth: number = 0): React.ReactNode => {
    const isDir = node.kind === 'directory';
    const isExpanded = expandedFolders[node.path] !== false; // default open
    const isSelected = selectedPath === node.path;
    const paddingLeft = `${depth * 14 + 10}px`;

    // Filter children
    const visibleChildren = isDir && node.children ? sortNodes(node.children.filter(filterNode)) : [];

    return (
      <div key={node.path} className="select-none text-xs">
        <div
          onClick={() => {
            if (isDir) {
              setExpandedFolders((prev) => ({ ...prev, [node.path]: !prev[node.path] }));
            }
            onSelectNode(node);
          }}
          style={{ paddingLeft }}
          className={`flex items-center justify-between py-1.5 pr-2.5 rounded-lg cursor-pointer transition-colors group ${
            isSelected
              ? 'bg-accent-theme/20 text-accent-theme font-medium border-l-2 border-accent-theme shadow-xs'
              : 'text-foreground/90 hover:bg-muted/60'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {isDir ? (
              <button
                type="button"
                onClick={(e) => toggleFolder(node.path, e)}
                className="p-0.5 hover:text-foreground text-muted-foreground"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}

            {renderIcon(node, isExpanded)}

            <span className="truncate font-mono text-[11px]" title={node.name}>
              {node.name}
            </span>

            {node.isMetadata && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/30 text-amber-400 bg-amber-500/10 shrink-0">
                meta
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100">
            <span className="text-[10px] text-muted-foreground font-mono">
              {formatOpfsBytes(node.sizeBytes)}
            </span>
            {onDeleteNode && !isDir && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNode(node.name, false);
                }}
                title="Delete this file"
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-opacity text-muted-foreground cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Render Children Recursively */}
        {isDir && isExpanded && visibleChildren.length > 0 && (
          <div className="flex flex-col">
            {visibleChildren.map((child) => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredRoot = useMemo(() => {
    if (!rootNode) return null;
    return rootNode;
  }, [rootNode]);

  return (
    <div className="flex flex-col h-full border-r border-border/50 bg-background/50">
      {/* Search & Filter Header */}
      <div className="p-3 border-b border-border/50 flex flex-col gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files or cache keys..."
            className="h-8 pl-8 pr-7 text-xs font-mono bg-muted/40 border-border/60"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px] font-mono no-scrollbar">
          {(['all', 'media', 'json', 'meta', 'other'] as OpfsFilterType[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterType(f)}
              className={`px-2 py-0.5 rounded-md uppercase font-semibold transition-colors cursor-pointer shrink-0 ${
                filterType === f
                  ? 'bg-accent-theme/20 text-accent-theme border border-accent-theme/40'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              {f}
            </button>
          ))}

          <div className="ml-auto shrink-0 flex items-center">
            <button
              type="button"
              onClick={() => {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
              }}
              title={`Sort: ${sortField} (${sortDirection})`}
              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-auto p-2">
        {filteredRoot ? (
          renderTree(filteredRoot)
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs text-center p-4 font-mono">
            <HardDrive className="w-8 h-8 mb-2 opacity-50" />
            No OPFS directory loaded
          </div>
        )}
      </div>
    </div>
  );
}
