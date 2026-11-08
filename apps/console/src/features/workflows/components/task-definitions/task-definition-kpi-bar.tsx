import React from 'react';
import { PlaySquare, CheckCircle2, FileEdit, Braces } from 'lucide-react';
import { type TaskDefinitionRecord } from '@/features/workflows/api/task-definition-api';

interface TaskDefinitionKpiBarProps {
  definitions: TaskDefinitionRecord[];
}

export const TaskDefinitionKpiBar: React.FC<TaskDefinitionKpiBarProps> = ({ definitions }) => {
  const totalCount = definitions.length;
  const activeCount = definitions.filter((d) => d.status === 'ACTIVE').length;
  const draftCount = definitions.filter((d) => d.status === 'DRAFT').length;
  const deprecatedCount = definitions.filter((d) => d.status === 'DEPRECATED').length;

  // Calculate average properties defined per task schema
  const totalParams = definitions.reduce((acc, d) => {
    const inCount = d.inputSchema && typeof d.inputSchema === 'object' && d.inputSchema.properties
      ? Object.keys(d.inputSchema.properties as Record<string, unknown>).length
      : 0;
    const outCount = d.outputSchema && typeof d.outputSchema === 'object' && d.outputSchema.properties
      ? Object.keys(d.outputSchema.properties as Record<string, unknown>).length
      : 0;
    return acc + inCount + outCount;
  }, 0);

  const avgParams = totalCount > 0 ? (totalParams / totalCount).toFixed(1) : '0';

  return (
    <div
      data-testid="task-definition-kpi-bar"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
    >
      {/* 1. Total Catalog Definitions */}
      <div className="p-3 sm:p-4 rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Total Definitions
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{totalCount}</span>
            <span className="text-xs text-muted-foreground font-medium">
              registered
            </span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
          <PlaySquare className="size-5" />
        </div>
      </div>

      {/* 2. Active in Production */}
      <div className="p-3 sm:p-4 rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Active in Production
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {activeCount}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              immutable
            </span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-5" />
        </div>
      </div>

      {/* 3. Draft & In-Review */}
      <div className="p-3 sm:p-4 rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Drafts & Evolutions
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{draftCount}</span>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">
              {deprecatedCount > 0 ? `+${deprecatedCount} deprecated` : 'in-flight'}
            </span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400">
          <FileEdit className="size-5" />
        </div>
      </div>

      {/* 4. Average Schema Complexity */}
      <div className="p-3 sm:p-4 rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Schema Complexity
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {avgParams}
            </span>
            <span className="text-xs text-muted-foreground font-medium">avg fields</span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
          <Braces className="size-5" />
        </div>
      </div>
    </div>
  );
};
