import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
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

export function VisualJsonTreeNode({
  label,
  value,
  path,
  depth = 0,
  searchQuery = '',
  onUpdateValue,
  onInsertChild,
  onDuplicate,
  onDelete,
  onSelectSequence,
  onFocusPath,
}: VisualJsonTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  // Search match logic
  const matchesSearch =
    searchQuery.trim().length > 0 &&
    (label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (!isObject && String(value).toLowerCase().includes(searchQuery.toLowerCase())));

  // Auto-expand if child or node matches search
  React.useEffect(() => {
    if (matchesSearch) {
      setExpanded(true);
    }
  }, [matchesSearch]);

  const handleNodeClick = () => {
    onFocusPath?.(path);
    if (isObject) {
      setExpanded(!expanded);
    }
  };

  // 1. Primitive leaf node
  if (!isObject) {
    return (
      <div
        className={`group/node flex items-center justify-between py-1 px-2 rounded text-[11px] font-mono transition-colors ${
          matchesSearch ? 'bg-indigo-500/20 ring-1 ring-indigo-500' : 'hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        onClick={() => onFocusPath?.(path)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-400 select-none">{label}:</span>
          <VisualJsonFieldEditor
            fieldKey={label}
            value={value}
            path={path}
            onUpdate={onUpdateValue}
          />
        </div>

        <VisualJsonNodeContextMenu
          path={path}
          isArray={false}
          isObject={false}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>
    );
  }

  // 2. Object or Array composite node
  const entries = isArray
    ? (value as unknown[]).map((v, idx) => [String(idx), v] as const)
    : Object.entries(value as Record<string, unknown>);

  const objId =
    !isArray && value && typeof (value as any).id === 'string' ? ((value as any).id as string) : null;
  const objType =
    !isArray && value && typeof (value as any).type === 'string' ? ((value as any).type as string) : null;
  const objName =
    !isArray && value && typeof (value as any).name === 'string' ? ((value as any).name as string) : null;

  return (
    <div className="select-none">
      <div
        onClick={handleNodeClick}
        className={`group/node flex items-center justify-between py-1 px-2 rounded cursor-pointer text-[11px] font-mono transition-colors ${
          matchesSearch ? 'bg-indigo-500/20 ring-1 ring-indigo-500' : 'hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            className="p-0.5 text-slate-400 hover:text-foreground shrink-0 focus:outline-hidden"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          <span className="text-indigo-300 font-semibold tracking-wide">{label}</span>

          {objName && (
            <span className="text-foreground/80 font-sans text-[10px] truncate max-w-[120px] bg-[var(--glass-bg)] border border-[var(--glass-border)] px-1.5 py-0.2 rounded-md">
              "{objName}"
            </span>
          )}

          {objId && (
            <Badge
              variant="outline"
              className="text-[9px] py-0 px-1 font-mono border-[var(--accent-primary)]/40 text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 shrink-0"
            >
              #{objId}
            </Badge>
          )}

          {objType && (
            <Badge
              variant="outline"
              className="text-[9px] py-0 px-1 font-mono border-purple-500/40 text-purple-300 bg-purple-500/10 shrink-0"
            >
              {objType}
            </Badge>
          )}

          <span className="text-[10px] text-muted-foreground font-mono">
            {isArray ? `[${entries.length}]` : `{${entries.length}}`}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {objId && objId.startsWith('seq-') && onSelectSequence && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSequence(objId);
              }}
              className="h-5 px-1.5 text-[9px] font-mono rounded glass-pill text-[var(--accent-primary)] hover:text-foreground cursor-pointer"
            >
              Inspect Clip
            </button>
          )}

          <VisualJsonNodeContextMenu
            path={path}
            isArray={isArray}
            isObject={true}
            onInsertChild={onInsertChild}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-l border-[var(--glass-border)] ml-3">
          {entries.map(([k, v]) => (
            <VisualJsonTreeNode
              key={k}
              label={k}
              value={v}
              path={[...path, isArray ? Number(k) : k]}
              depth={depth + 1}
              searchQuery={searchQuery}
              onUpdateValue={onUpdateValue}
              onInsertChild={onInsertChild}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onSelectSequence={onSelectSequence}
              onFocusPath={onFocusPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}
