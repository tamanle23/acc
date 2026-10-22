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
    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/60 border-b border-slate-800 shrink-0">
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
        JSON Source Code
      </span>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrettify}
          disabled={!canFormat}
          title="Format JSON (2-space indentation)"
          className="h-6 text-[10px] font-mono gap-1 border-slate-700 bg-slate-900/80 px-2"
        >
          <Wand2 className="w-2.5 h-2.5 text-[var(--accent-primary)]" />
          Format
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onMinify}
          disabled={!canFormat}
          title="Minify JSON (Compact single-line)"
          className="h-6 text-[10px] font-mono gap-1 border-slate-700 bg-slate-900/80 px-2"
        >
          <Minimize2 className="w-2.5 h-2.5" />
          Minify
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopy}
          className="h-6 text-[10px] font-mono gap-1 border-slate-700 bg-slate-900/80 px-2"
        >
          {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          title="Reset to live Studio state"
          className="h-6 text-[10px] font-mono gap-1 border-slate-700 bg-slate-900/80 px-2 text-slate-300"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
