import React from 'react';
import { Play, Split, GitMerge, Clock, Repeat, GitFork, GripVertical } from 'lucide-react';
import { type DagNodeType } from './dag-node';
import { Badge } from '@/components/ui/badge';

interface PaletteItem {
  type: DagNodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultData: {
    taskType: DagNodeType;
    label: string;
    timeoutSeconds?: number;
    retryCount?: number;
    condition?: string;
  };
}

export const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'SIMPLE',
    label: 'Simple Task',
    description: 'Executes a discrete worker job',
    icon: <Play className="w-4 h-4 text-primary" />,
    defaultData: {
      taskType: 'SIMPLE',
      label: 'New Task',
      timeoutSeconds: 30,
      retryCount: 3,
    },
  },
  {
    type: 'SWITCH',
    label: 'Switch Node',
    description: 'Conditional branch evaluator',
    icon: <Split className="w-4 h-4 text-amber-500" />,
    defaultData: {
      taskType: 'SWITCH',
      label: 'Switch Condition',
      condition: '${workflow.input.case}',
    },
  },
  {
    type: 'FORK_JOIN',
    label: 'Fork / Join',
    description: 'Parallel static branch execution',
    icon: <GitMerge className="w-4 h-4 text-indigo-500" />,
    defaultData: {
      taskType: 'FORK_JOIN',
      label: 'Parallel Fork',
    },
  },
  {
    type: 'DYNAMIC_FORK',
    label: 'Dynamic Fork',
    description: 'Dynamic parallel branch generation',
    icon: <GitFork className="w-4 h-4 text-purple-500" />,
    defaultData: {
      taskType: 'DYNAMIC_FORK',
      label: 'Dynamic Fork',
    },
  },
  {
    type: 'WAIT',
    label: 'Wait / Timer',
    description: 'Pause execution for duration or event',
    icon: <Clock className="w-4 h-4 text-sky-500" />,
    defaultData: {
      taskType: 'WAIT',
      label: 'Wait Period',
      timeoutSeconds: 60,
    },
  },
  {
    type: 'DO_WHILE',
    label: 'Do-While Loop',
    description: 'Iterative loop until condition met',
    icon: <Repeat className="w-4 h-4 text-emerald-500" />,
    defaultData: {
      taskType: 'DO_WHILE',
      label: 'Loop Node',
      condition: '${workflow.iteration < 5}',
    },
  },
];

export function DagPalette() {
  const onDragStart = (event: React.DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData('application/dag-node-type', item.type);
    event.dataTransfer.setData('application/dag-node-data', JSON.stringify(item.defaultData));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex flex-col gap-2 p-3 w-56 rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/30 dark:border-white/10 shadow-lg">
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Node Palette</span>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-muted/40">Drag & Drop</Badge>
      </div>
      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[380px] pr-0.5">
        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => onDragStart(e, item)}
            className="group flex items-center gap-2 p-2 rounded-xl border border-white/40 dark:border-white/5 bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 hover:border-primary/40 hover:shadow-md transition-all cursor-grab active:cursor-grabbing select-none"
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground" />
            <div className="p-1 rounded-lg bg-background/80 border border-border/50">
              {item.icon}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
              <span className="text-[10px] text-muted-foreground truncate">{item.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
