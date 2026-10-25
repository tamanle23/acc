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
    <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--glass-bg)]/20 border-b border-[var(--glass-border)] text-xs font-mono text-muted-foreground shrink-0 backdrop-blur-xs">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => onNavigate?.([])}
          className="flex items-center gap-1 hover:text-[var(--accent-primary)] text-muted-foreground transition-colors cursor-pointer"
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
              <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
              <button
                type="button"
                onClick={() => onNavigate?.(slice)}
                className={`transition-colors truncate max-w-[120px] cursor-pointer ${
                  isLast ? 'text-[var(--accent-primary)] font-bold' : 'text-muted-foreground hover:text-foreground'
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
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground ml-2 px-1.5 py-0.5 rounded-md glass-card shrink-0 cursor-pointer"
        title="Copy path pointer to clipboard"
      >
        {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
        <span>{copied ? 'Copied' : 'Copy Pointer'}</span>
      </button>
    </div>
  );
}
