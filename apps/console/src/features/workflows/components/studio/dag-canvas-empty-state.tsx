import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Globe, Plus, Sparkles, Layers } from 'lucide-react';
import type { DagNodeType, DagNodeData } from './dag-node';

export interface DagCanvasEmptyStateProps {
  onInsertNode: (taskType: DagNodeType, defaultData?: Partial<DagNodeData>) => void;
  onOpenPalette: () => void;
  onDismiss: () => void;
}

export function DagCanvasEmptyState({
  onInsertNode,
  onOpenPalette,
  onDismiss,
}: DagCanvasEmptyStateProps) {
  return (
    <div
      data-testid="dag-canvas-empty-state"
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-[360px] max-w-[calc(100%-2rem)] p-4 sm:p-5 rounded-2xl backdrop-blur-2xl bg-white/85 dark:bg-slate-900/85 border border-white/40 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/40 text-center animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
    >
      <div className="mx-auto w-10 h-10 mb-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
        <Sparkles className="w-5 h-5 animate-pulse" />
      </div>

      <h3 className="text-sm font-bold text-foreground mb-1">
        Start Building Your Workflow
      </h3>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        Your canvas currently has pure START and END boundary nodes. Pick a starter task or drag from the palette to connect your pipeline.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 bg-background/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 justify-start"
          onClick={() =>
            onInsertNode('SIMPLE', {
              taskType: 'SIMPLE',
              label: 'Process Step',
              timeoutSeconds: 30,
              retryCount: 3,
            })
          }
          data-testid="empty-state-add-simple-btn"
        >
          <Play className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">Simple Task</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 bg-background/60 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 justify-start"
          onClick={() =>
            onInsertNode('HTTP', {
              taskType: 'HTTP',
              label: 'Call API Endpoint',
              httpMethod: 'POST',
              httpUri: 'https://api.example.com/v1/resource',
            })
          }
          data-testid="empty-state-add-http-btn"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="truncate">HTTP Request</span>
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
        >
          Dismiss
        </Button>

        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs gap-1 shadow-sm"
          onClick={onOpenPalette}
          data-testid="empty-state-open-palette-btn"
        >
          <Layers className="w-3 h-3" />
          Open Node Palette
        </Button>
      </div>
    </div>
  );
}
