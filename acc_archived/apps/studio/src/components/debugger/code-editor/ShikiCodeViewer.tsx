import React, { useRef, useEffect, useState } from 'react';
import { highlightCode } from '../../../lib/highlighter';

export interface ShikiCodeViewerProps {
  code: string;
  onChange: (newCode: string) => void;
  errorLines?: number[];
  className?: string;
  readOnly?: boolean;
}

export function ShikiCodeViewer({
  code,
  onChange,
  errorLines = [],
  className = '',
  readOnly = false,
}: ShikiCodeViewerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const [highlightedLines, setHighlightedLines] = useState<React.ReactNode[][] | null>(null);

  const lines = code.split('\n');
  const lineCount = lines.length;

  // Background tokenization with Shiki
  useEffect(() => {
    let active = true;
    highlightCode(code, 'json').then((res) => {
      if (active && res) {
        setHighlightedLines(res);
      }
    }).catch(() => {
      // Shiki parse fallback
    });
    return () => {
      active = false;
    };
  }, [code]);

  // Sync scrolling between textarea and overlay
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div className={`relative flex flex-1 h-full overflow-hidden font-mono bg-transparent text-xs ${className}`}>
      {/* Line Numbers with Gutter Indicators */}
      <div
        aria-hidden="true"
        className="select-none py-3 px-2 text-right border-r border-glass-border bg-glass-surface/50 font-mono text-[11px] leading-[1.4rem] shrink-0 text-muted-foreground/60 w-12 backdrop-blur-xs"
      >
        {Array.from({ length: Math.max(1, lineCount) }).map((_, i) => {
          const lineNum = i + 1;
          const isError = errorLines.includes(lineNum);
          return (
            <div
              key={i}
              className={`flex items-center justify-end gap-1 ${
                isError ? 'text-rose-400 font-bold bg-rose-500/20 -mx-2 px-2' : ''
              }`}
            >
              {isError && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
              <span>{lineNum}</span>
            </div>
          );
        })}
      </div>

      {/* Editor Body */}
      <div className="relative flex-1 h-full overflow-hidden">
        {/* Shiki Highlighted Overlay behind textarea */}
        <pre
          ref={preRef}
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none p-3 m-0 font-mono text-[11px] leading-[1.4rem] overflow-hidden whitespace-pre tab-4 select-none opacity-90 z-0 text-foreground"
        >
          {highlightedLines ? (
            highlightedLines.map((lineTokens, i) => (
              <div key={i} className="min-h-[1.4rem]">
                {lineTokens.length === 0 ? '\n' : lineTokens}
              </div>
            ))
          ) : (
            <code>{code}</code>
          )}
        </pre>

        {/* Interactive Textarea (Caret & Typing) */}
        <textarea
          ref={textareaRef}
          value={code}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="absolute inset-0 w-full h-full p-3 font-mono text-[11px] leading-[1.4rem] bg-transparent text-transparent caret-foreground focus:outline-hidden resize-none whitespace-pre overflow-auto tab-4 z-10 selection:bg-accent-theme/30 selection:text-foreground"
        />
      </div>
    </div>
  );
}
