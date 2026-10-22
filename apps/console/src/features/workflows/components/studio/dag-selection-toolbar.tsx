import React from 'react';
import type { Node } from '@xyflow/react';
import { type DagNodeData } from './dag-node';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlignLeft,
  AlignCenter,
  AlignVerticalSpaceBetween,
  AlignHorizontalSpaceBetween,
  Copy,
  Trash2,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DagSelectionToolbarProps {
  selectedNodes: Node<DagNodeData>[];
  onAlignLeft: () => void;
  onAlignCenterX: () => void;
  onAlignTop: () => void;
  onAlignMiddleY: () => void;
  onDistributeHorizontal: () => void;
  onDistributeVertical: () => void;
  onDuplicate: () => void;
  onBulkDelete: () => void;
}

export const DagSelectionToolbar: React.FC<DagSelectionToolbarProps> = ({
  selectedNodes,
  onAlignLeft,
  onAlignCenterX,
  onAlignTop,
  onAlignMiddleY,
  onDistributeHorizontal,
  onDistributeVertical,
  onDuplicate,
  onBulkDelete,
}) => {
  if (selectedNodes.length < 2) return null;

  const hasDeletableNodes = selectedNodes.some((n) => !n.data.isPermanent);
  const canDistribute = selectedNodes.length >= 3;

  return (
    <div
      className={cn(
        'absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 px-3 rounded-2xl',
        'backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-white/40 dark:border-white/10 shadow-2xl',
        'max-w-[calc(100%-1.5rem)] overflow-x-auto scrollbar-none',
        'animate-in fade-in-0 slide-in-from-top-2 duration-150'
      )}
      data-testid="dag-selection-toolbar"
      role="toolbar"
      aria-label="Multi-node selection alignment and actions"
    >
      <div className="flex items-center gap-1.5 mr-1 border-r border-border/50 pr-2">
        <Layers className="w-3.5 h-3.5 text-primary" />
        <Badge
          variant="outline"
          className="text-[10px] font-mono px-1.5 py-0 bg-primary/10 text-primary border-primary/20"
        >
          {selectedNodes.length} selected
        </Badge>
      </div>

      {/* Horizontal Alignment Group */}
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 rounded-lg hover:bg-muted/80 text-foreground"
          onClick={onAlignLeft}
          title="Align Left (align X coordinates to leftmost node)"
          data-testid="dag-align-left-btn"
          aria-label="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 rounded-lg hover:bg-muted/80 text-foreground"
          onClick={onAlignCenterX}
          title="Align Center X (center horizontal coordinates)"
          data-testid="dag-align-center-x-btn"
          aria-label="Align Center X"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="h-4 w-[1px] bg-border/40 mx-0.5" />

      {/* Vertical Alignment Group */}
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-1.5 text-[10px] gap-1 rounded-lg hover:bg-muted/80 text-foreground"
          onClick={onAlignTop}
          title="Align Top (align Y coordinates to topmost node)"
          data-testid="dag-align-top-btn"
          aria-label="Align Top"
        >
          <span className="font-mono text-[9px] font-bold">Top</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-1.5 text-[10px] gap-1 rounded-lg hover:bg-muted/80 text-foreground"
          onClick={onAlignMiddleY}
          title="Align Middle Y (center vertical coordinates)"
          data-testid="dag-align-middle-y-btn"
          aria-label="Align Middle Y"
        >
          <span className="font-mono text-[9px] font-bold">Mid</span>
        </Button>
      </div>

      <div className="h-4 w-[1px] bg-border/40 mx-0.5" />

      {/* Distribution Group */}
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!canDistribute}
          className="h-7 w-7 p-0 rounded-lg hover:bg-muted/80 text-foreground disabled:opacity-40"
          onClick={onDistributeHorizontal}
          title={canDistribute ? "Distribute Evenly (Horizontal)" : "Select 3+ nodes to distribute"}
          data-testid="dag-distribute-h-btn"
          aria-label="Distribute Horizontal"
        >
          <AlignHorizontalSpaceBetween className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!canDistribute}
          className="h-7 w-7 p-0 rounded-lg hover:bg-muted/80 text-foreground disabled:opacity-40"
          onClick={onDistributeVertical}
          title={canDistribute ? "Distribute Evenly (Vertical)" : "Select 3+ nodes to distribute"}
          data-testid="dag-distribute-v-btn"
          aria-label="Distribute Vertical"
        >
          <AlignVerticalSpaceBetween className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="h-4 w-[1px] bg-border/40 mx-0.5" />

      {/* Clone / Duplicate Group */}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-[11px] gap-1 rounded-lg hover:bg-muted/80 text-foreground"
        onClick={onDuplicate}
        title="Duplicate selected tasks (Cmd+D)"
        data-testid="dag-duplicate-btn"
        aria-label="Duplicate Selected Tasks"
      >
        <Copy className="w-3 h-3 text-sky-500" />
        <span className="font-medium">Clone</span>
      </Button>

      {/* Bulk Delete */}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!hasDeletableNodes}
        className="h-7 px-2 text-[11px] gap-1 rounded-lg hover:bg-destructive/10 text-destructive disabled:opacity-40"
        onClick={onBulkDelete}
        title="Delete selected tasks (Delete / Backspace)"
        data-testid="dag-bulk-delete-btn"
        aria-label="Delete Selected Tasks"
      >
        <Trash2 className="w-3 h-3" />
        <span className="font-medium">Delete</span>
      </Button>
    </div>
  );
};
