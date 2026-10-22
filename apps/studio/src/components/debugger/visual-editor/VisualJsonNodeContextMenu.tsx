import React from 'react';
import { Copy, Plus, Trash2, Layers, Check } from 'lucide-react';
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

export function VisualJsonNodeContextMenu({
  path,
  isArray,
  isObject,
  onInsertChild,
  onDuplicate,
  onDelete,
  onCopyPath,
}: VisualJsonNodeContextMenuProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const str = formatJsonPath(path);
    navigator.clipboard.writeText(str);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    onCopyPath?.(path);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="opacity-0 group-hover/node:opacity-100 transition-opacity flex items-center gap-0.5 ml-2 bg-slate-900/90 border border-slate-800 rounded-md px-1 py-0.5 shadow-xs shrink-0"
    >
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
        title="Copy JSON path pointer"
      >
        {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
      </button>

      {isArray && onInsertChild && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInsertChild(path);
          }}
          className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors"
          title="Add element to array"
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
      )}

      {path.length > 0 && onDuplicate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(path);
          }}
          className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
          title="Duplicate this node"
        >
          <Layers className="w-2.5 h-2.5" />
        </button>
      )}

      {path.length > 0 && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(path);
          }}
          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          title="Delete this node"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}
