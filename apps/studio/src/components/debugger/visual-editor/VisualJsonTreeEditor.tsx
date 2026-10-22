import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, Plus, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
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
  className?: string;
}

export function VisualJsonTreeEditor({
  data,
  onChange,
  onSelectSequence,
  className = '',
}: VisualJsonTreeEditorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFocusedPath, setActiveFocusedPath] = useState<JsonPath>([]);

  // Mutator Callbacks
  const handleUpdateValue = (path: JsonPath, newValue: unknown) => {
    const updated = setJsonValueAtPath(data, path, newValue);
    onChange(updated);
  };

  const handleDelete = (path: JsonPath) => {
    const updated = deleteJsonValueAtPath(data, path);
    onChange(updated);
    if (activeFocusedPath.length >= path.length) {
      setActiveFocusedPath(path.slice(0, -1));
    }
  };

  const handleDuplicate = (path: JsonPath) => {
    const target = getJsonValueAtPath(data, path);
    if (target === undefined) return;
    const parentPath = path.slice(0, -1);
    const parentVal = getJsonValueAtPath(data, parentPath);

    if (Array.isArray(parentVal)) {
      const idx = Number(path[path.length - 1]);
      const deepCopied = JSON.parse(JSON.stringify(target));
      if (deepCopied && typeof deepCopied === 'object' && typeof deepCopied.id === 'string') {
        deepCopied.id = `${deepCopied.id}-copy-${Date.now().toString(36).slice(-4)}`;
      }
      const updated = insertJsonArrayItem(data, parentPath, deepCopied, idx + 1);
      onChange(updated);
    } else {
      // In object: duplicate with appended key
      const key = String(path[path.length - 1]);
      const newKey = `${key}_copy`;
      const deepCopied = JSON.parse(JSON.stringify(target));
      const updated = setJsonValueAtPath(data, [...parentPath, newKey], deepCopied);
      onChange(updated);
    }
  };

  const handleInsertChild = (path: JsonPath) => {
    const target = getJsonValueAtPath(data, path);
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

    const updated = insertJsonArrayItem(data, path, newItem);
    onChange(updated);
  };

  if (data === null || typeof data !== 'object') {
    return (
      <div className="p-8 text-center text-muted-foreground font-mono text-xs">
        No valid JSON object loaded to edit visually.
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-slate-950/40 border-r border-slate-800 ${className}`}>
      {/* Search & Tree Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/50 gap-2 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Search keys, values, sequence IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-8 text-xs font-mono bg-slate-950 border-slate-800 text-foreground"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1 text-[10px] bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/50 text-indigo-300">
            <Sparkles className="w-3 h-3 text-[var(--accent-primary)]" />
            Visual In-Place Mode
          </span>
        </div>
      </div>

      {/* Path Breadcrumb Tracker */}
      <VisualJsonPathBreadcrumb
        path={activeFocusedPath}
        onNavigate={(slice) => setActiveFocusedPath(slice)}
      />

      {/* Tree View Canvas */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono">
        <VisualJsonTreeNode
          label="root"
          value={data}
          path={[]}
          depth={0}
          searchQuery={searchQuery}
          onUpdateValue={handleUpdateValue}
          onInsertChild={handleInsertChild}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onSelectSequence={onSelectSequence}
          onFocusPath={(p) => setActiveFocusedPath(p)}
        />
      </div>
    </div>
  );
}
