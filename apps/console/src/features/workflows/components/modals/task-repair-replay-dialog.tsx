import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, AlertTriangle, Play, Sparkles } from 'lucide-react';
import { VisualJsonEditor } from '@/components/ui/json-editor';
import { useReplayWorkflowTask } from '@/features/workflows/api/workflow-api';

export interface TaskRepairReplayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  executionId: string;
  taskReferenceName: string;
  taskId?: string;
  initialInput?: Record<string, unknown>;
  onSuccess?: () => void;
}

export const TaskRepairReplayDialog: React.FC<TaskRepairReplayDialogProps> = ({
  open,
  onOpenChange,
  executionId,
  taskReferenceName,
  taskId,
  initialInput,
  onSuccess,
}) => {
  const [editedInput, setEditedInput] = useState<Record<string, unknown>>(() => initialInput || {});
  const replayMutation = useReplayWorkflowTask();

  useEffect(() => {
    if (open) {
      setEditedInput(initialInput || {});
    }
  }, [open]);

  const handleReplay = async () => {
    await replayMutation.mutateAsync({
      executionId,
      taskId: taskId || taskReferenceName,
      overrideInput: editedInput,
    });
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-white/20 dark:border-white/10 shadow-2xl"
        data-testid="task-repair-replay-dialog"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-500" />
              <span>Repair & Replay Failed Task</span>
            </DialogTitle>
            <Badge variant="destructive" className="text-xs uppercase">
              DLQ Interactive Replay
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Target Task: <span className="font-mono font-bold text-foreground">{taskReferenceName}</span>
            {' • '}Execution ID: <span className="font-mono">{executionId}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <span className="font-semibold block">In-Place Virtual Thread Worker Re-enqueue</span>
            <p className="text-[11px] leading-relaxed">
              Modifying payload values will clear the task from the Dead Letter Queue (DLQ), reset its state to{' '}
              <code className="font-mono font-bold">SCHEDULED</code>, and dispatch it to the Loom System Worker fleet while strictly preserving execution context.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Repair Input Parameters
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              JSON Schema Validation Active
            </span>
          </div>
          <VisualJsonEditor
            value={editedInput}
            onChange={(nextVal) => {
              if (nextVal && typeof nextVal === 'object' && !Array.isArray(nextVal)) {
                setEditedInput(nextVal as Record<string, unknown>);
              }
            }}
            defaultMode="tree"
            height="260px"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={replayMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleReplay}
            disabled={replayMutation.isPending}
            className="gap-1.5 bg-gradient-to-r from-amber-600 to-rose-600 text-white hover:from-amber-700 hover:to-rose-700 shadow-md"
            data-testid="submit-repair-replay-btn"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{replayMutation.isPending ? 'Replaying...' : 'Re-enqueue & Replay Task'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
