import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisualDagStudio } from '@/features/metadata/components/studio';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import { type WorkflowExecution } from '../schema';

interface WorkflowExecutionStreamModalProps {
  workflowExecution: WorkflowExecution | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkflowExecutionStreamModal: React.FC<WorkflowExecutionStreamModalProps> = ({
  workflowExecution,
  open,
  onOpenChange,
}) => {
  if (!workflowExecution) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl flex flex-col">
        <DialogHeader className="p-4 border-b border-white/20 dark:border-white/10 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary animate-pulse" />
            <DialogTitle className="text-base font-bold">
              Live Execution Stream Visualizer
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">
              {workflowExecution.id}
            </Badge>
          </div>
          <Badge
            className={
              workflowExecution.status === 'COMPLETED' || workflowExecution.status === 'done'
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 animate-pulse'
            }
          >
            {workflowExecution.status}
          </Badge>
        </DialogHeader>

        <div className="flex-1 w-full min-h-0 overflow-hidden relative">
          <VisualDagStudio
            mode="execution"
            workflowKey={workflowExecution.workflowId || 'order-pipeline'}
            executionId={workflowExecution.id}
            onCloseExecution={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
