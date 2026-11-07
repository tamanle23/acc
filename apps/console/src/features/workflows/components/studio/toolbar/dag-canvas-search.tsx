import React, { useState, useEffect, useRef, useMemo } from 'react';
import { type Node } from '@xyflow/react';
import { type DagNodeData } from '../canvas/dag-node';
import { Input } from '@/components/ui/input';
import { Search, X, ArrowDown, ArrowUp, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DagCanvasSearchProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<DagNodeData>[];
  onFocusNode: (node: Node<DagNodeData>) => void;
}

export const DagCanvasSearch: React.FC<DagCanvasSearchProps> = ({
  isOpen,
  onClose,
  nodes,
  onFocusNode,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return nodes.filter((n) => {
      const ref = n.data?.taskReferenceName?.toLowerCase() || '';
      const label = n.data?.label?.toLowerCase() || '';
      const type = n.data?.taskType?.toLowerCase() || '';
      const params = Object.keys(n.data?.inputParameters || {}).join(' ').toLowerCase();

      return (
        ref.includes(q) ||
        label.includes(q) ||
        type.includes(q) ||
        params.includes(q)
      );
    });
  }, [nodes, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredNodes.length]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredNodes.length > 0 ? (prev + 1) % filteredNodes.length : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredNodes.length > 0 ? (prev - 1 + filteredNodes.length) % filteredNodes.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredNodes[selectedIndex]) {
        onFocusNode(filteredNodes[selectedIndex]);
        onClose();
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Quick Canvas Search"
      data-testid="dag-canvas-search-dialog"
      className="absolute top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-md p-2 rounded-2xl backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-white/40 dark:border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search nodes by ref, label, type, or parameter... (Esc to exit)"
          className="pl-9 pr-8 h-10 text-xs bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
          data-testid="dag-canvas-search-input"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="absolute right-2.5 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {query.trim() && (
        <div className="mt-2 pt-2 border-t border-border/30 max-h-60 overflow-y-auto space-y-1">
          {filteredNodes.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No matching nodes found for "{query}"
            </div>
          ) : (
            filteredNodes.map((node, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onFocusNode(node);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  data-testid={`dag-search-result-${node.data.taskReferenceName}`}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all',
                    isSelected
                      ? 'bg-primary/10 border border-primary/20 text-primary font-semibold'
                      : 'hover:bg-muted/50 text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-muted text-muted-foreground uppercase">
                      {node.data.taskType}
                    </span>
                    <span className="truncate">{node.data.label || node.data.taskReferenceName}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ({node.data.taskReferenceName})
                    </span>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 text-[9px] text-primary/80 font-mono">
                      <span>Enter</span>
                      <CornerDownLeft className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Footer shortcut hints */}
      <div className="mt-2 pt-1.5 border-t border-border/20 flex items-center justify-between px-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-0.5">
            <ArrowUp className="w-2.5 h-2.5" />
            <ArrowDown className="w-2.5 h-2.5" /> Navigate
          </span>
          <span>↵ Jump</span>
        </div>
        <span>ESC Close</span>
      </div>
    </div>
  );
};
