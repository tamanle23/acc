import React from 'react';
import { ChevronRight, Home, Copy, Check } from 'lucide-react';
import { type JsonPath, formatJsonPath } from '../types';

export interface VisualJsonPathBreadcrumbProps {
  path: JsonPath;
  onNavigate?: (slicePath: JsonPath) => void;
}

export function VisualJsonPathBreadcrumb({ path, onNavigate }: VisualJsonPathBreadcrumbProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const str = formatJsonPath(path);
    navigator.clipboard.writeText(str);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/60 border-b border-slate-800 text-xs font-mono text-slate-400 shrink-0">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => onNavigate?.([])}
          className="flex items-center gap-1 hover:text-cyan-300 text-slate-400 transition-colors"
          title="Root Document"
        >
          <Home className="w-3 h-3 text-[var(--accent-primary)]" />
          <span>doc</span>
        </button>

        {path.map((segment, idx) => {
          const slice = path.slice(0, idx + 1);
          const isLast = idx === path.length - 1;
          return (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
              <button
                type="button"
                onClick={() => onNavigate?.(slice)}
                className={`transition-colors truncate max-w-[120px] ${
                  isLast ? 'text-cyan-300 font-bold' : 'hover:text-slate-200'
                }`}
              >
                {typeof segment === 'number' ? `[${segment}]` : segment}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-300 ml-2 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0"
        title="Copy path pointer to clipboard"
      >
        {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
        <span>{copied ? 'Copied' : 'Copy Pointer'}</span>
      </button>
    </div>
  );
}
