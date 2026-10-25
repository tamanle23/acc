import React from 'react';
import { Wand2, Minimize2, Copy, Check, RotateCcw, Search } from 'lucide-react';
import { Button } from '../../ui/button';

export interface CodeEditorToolbarProps {
  onPrettify: () => void;
  onMinify: () => void;
  onCopy: () => void;
  onReset: () => void;
  copied: boolean;
  canFormat: boolean;
}

export function CodeEditorToolbar({
  onPrettify,
  onMinify,
  onCopy,
  onReset,
  copied,
  canFormat,
}: CodeEditorToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--glass-bg)]/40 border-b border-[var(--glass-border)] shrink-0 backdrop-blur-xs">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
        JSON Source Code
      </span>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrettify}
          disabled={!canFormat}
          title="Format JSON (2-space indentation)"
          className="h-6 px-2 text-[10px] font-mono flex items-center gap-1 glass-card rounded text-foreground hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          <Wand2 className="w-2.5 h-2.5 text-[var(--accent-primary)]" />
          Format
        </button>

        <button
          type="button"
          onClick={onMinify}
          disabled={!canFormat}
          title="Minify JSON (Compact single-line)"
          className="h-6 px-2 text-[10px] font-mono flex items-center gap-1 glass-card rounded text-foreground hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          <Minimize2 className="w-2.5 h-2.5" />
          Minify
        </button>

        <button
          type="button"
          onClick={onCopy}
          className="h-6 px-2 text-[10px] font-mono flex items-center gap-1 glass-card rounded text-foreground hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] cursor-pointer transition-all"
        >
          {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>

        <button
          type="button"
          onClick={onReset}
          title="Reset to live Studio state"
          className="h-6 px-2 text-[10px] font-mono flex items-center gap-1 glass-card rounded text-muted-foreground hover:text-foreground cursor-pointer transition-all"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          Reset
        </button>
      </div>
    </div>
  );
}
