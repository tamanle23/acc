import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { VisualDagStudio } from '@/features/workflows/components/studio';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, Cpu, AlertCircle, CheckCircle2, Play } from 'lucide-react';
import { type WorkflowExecution } from '../schema';

interface WorkflowExecutionDetailDrawerProps {
  workflowExecution: WorkflowExecution | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkflowExecutionDetailDrawer: React.FC<WorkflowExecutionDetailDrawerProps> = ({
  workflowExecution,
  open,
  onOpenChange,
}) => {
  if (!workflowExecution) return null;

  const isCompleted = workflowExecution.status === 'COMPLETED' || workflowExecution.status === 'done';
  const isFailed = workflowExecution.status === 'FAILED' || workflowExecution.status === 'TIMED_OUT';
  const isInProgress = workflowExecution.status === 'IN_PROGRESS' || workflowExecution.status === 'RUNNING';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl p-0 flex flex-col gap-0 border-s border-white/20 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
        data-testid="workflow-execution-detail-drawer"
      >
        <SheetHeader className="p-4 border-b border-white/20 dark:border-white/10 flex flex-row items-center justify-between space-y-0 shrink-0 bg-muted/20">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary animate-pulse" />
              <SheetTitle className="text-base font-bold">
                Workflow Execution Inspection
              </SheetTitle>
              <Badge variant="outline" className="font-mono text-xs font-semibold">
                {workflowExecution.id}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {workflowExecution.workflowName && (
                <span className="font-medium text-foreground">
                  {workflowExecution.workflowName}
                </span>
              )}
              {workflowExecution.leaseOwner && (
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Cpu className="w-3 h-3 text-primary/70" />
                  {workflowExecution.leaseOwner}
                </span>
              )}
              {workflowExecution.durationMs ? (
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Clock className="w-3 h-3" />
                  {workflowExecution.durationMs}ms
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className={
                isCompleted
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : isFailed
                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 animate-pulse'
              }
            >
              {isCompleted ? (
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
              ) : isFailed ? (
                <AlertCircle className="w-3 h-3 mr-1 text-rose-600" />
              ) : (
                <Play className="w-3 h-3 mr-1 text-amber-600 animate-spin" />
              )}
              {workflowExecution.status}
            </Badge>
          </div>
        </SheetHeader>

        {/* Embedded Visual DAG Studio in Execution Mode with SSE */}
        <div className="flex-1 w-full min-h-0 overflow-hidden relative">
          <VisualDagStudio
            mode="execution"
            workflowKey={workflowExecution.workflowId || 'order-pipeline'}
            executionId={workflowExecution.id}
            onCloseExecution={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
