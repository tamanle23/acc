import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Server,
  Activity,
  FileCode,
  Terminal,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';
import type { DagNodeData } from '../canvas/dag-node';
import { VisualJsonEditor } from '@/components/ui/json-editor';
import { useRerunWorkflowTask, useReplayWorkflowTask } from '@/features/workflows/api/workflow-api';

export interface TaskTelemetryInspectorProps {
  nodeId: string | null;
  nodeData: DagNodeData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  executionId?: string | null;
  onRerunTask?: (taskReferenceName: string, overrideInput: Record<string, unknown>) => void;
  logs?: Array<{
    id: string;
    time: string;
    level: string;
    message: string;
    raw?: unknown;
  }>;
}

export const TaskTelemetryInspector: React.FC<TaskTelemetryInspectorProps> = ({
  nodeId,
  nodeData,
  open,
  onOpenChange,
  executionId,
  onRerunTask,
  logs = [],
}) => {
  const [overrideInput, setOverrideInput] = useState<Record<string, unknown>>(
    nodeData?.inputParameters || {}
  );
  const rerunMutation = useRerunWorkflowTask();
  const replayMutation = useReplayWorkflowTask();

  useEffect(() => {
    setOverrideInput(nodeData?.inputParameters || {});
  }, [nodeData]);

  if (!nodeId || !nodeData) return null;

  const nodeLogs = logs.filter(
    (l) =>
      l.message.includes(nodeData.taskReferenceName) ||
      (l.raw && typeof l.raw === 'object' && (l.raw as any).taskReferenceName === nodeData.taskReferenceName)
  );

  const formatTimestamp = (ts?: number) => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleString();
  };

  const getStatusBadge = () => {
    switch (nodeData.executionState) {
      case 'COMPLETED':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge className="bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30 flex items-center gap-1 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            IN_PROGRESS
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            FAILED
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {nodeData.executionState || 'PENDING'}
          </Badge>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border-l border-white/20 dark:border-white/10 shadow-2xl z-50 overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base font-bold flex items-center gap-2">
                <span>{nodeData.label || nodeData.taskReferenceName}</span>
              </SheetTitle>
              <Badge variant="outline" className="text-xs font-mono">
                {nodeData.taskType}
              </Badge>
            </div>
            {getStatusBadge()}
          </div>
          <SheetDescription className="text-xs font-mono text-muted-foreground">
            Ref: {nodeData.taskReferenceName}
          </SheetDescription>
        </SheetHeader>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-2 shrink-0">
            <TabsList className="grid grid-cols-3 w-full h-9">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="payloads" className="text-xs">Payloads</TabsTrigger>
              <TabsTrigger value="logs" className="text-xs">Logs ({nodeLogs.length})</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-background/50 border border-border/40">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Duration</span>
                  <div className="text-sm font-mono font-bold text-foreground">
                    {nodeData.durationMs !== undefined ? `${nodeData.durationMs}ms` : 'Pending'}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Attempt</span>
                  <div className="text-sm font-mono font-bold text-foreground">
                    #{nodeData.attemptNumber || 1}
                  </div>
                </div>
                <div className="space-y-1 col-span-2 pt-2 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Started At</span>
                  <div className="text-xs font-mono text-foreground">
                    {formatTimestamp(nodeData.startedAt)}
                  </div>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Ended At</span>
                  <div className="text-xs font-mono text-foreground">
                    {formatTimestamp(nodeData.endedAt)}
                  </div>
                </div>
              </div>

              {/* Worker & Lease Details */}
              <div className="p-3 rounded-xl bg-background/50 border border-border/40 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Server className="w-3.5 h-3.5 text-primary" />
                  <span>Execution Lease & Dispatch</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Domain Pool:</span>
                    <span className="font-mono">{nodeData.domain || 'default'}</span>
                  </div>
                  {nodeData.workerId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Worker ID:</span>
                      <span className="font-mono text-foreground">{nodeData.workerId}</span>
                    </div>
                  )}
                  {nodeData.leaseId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lease ID:</span>
                      <span className="font-mono text-[11px] text-foreground">{nodeData.leaseId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Compensation info if configured */}
              {nodeData.compensateHandlerRef && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Saga Compensation Handler Configured</span>
                  </div>
                  <p className="text-[11px]">
                    Handler: <span className="font-mono font-bold">{nodeData.compensateHandlerRef}</span>
                  </p>
                </div>
              )}

              {/* Failure Error Banner */}
              {nodeData.error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                      <span>Execution Failure</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={replayMutation.isPending}
                      onClick={() => {
                        if (executionId) {
                          replayMutation.mutate({
                            executionId,
                            taskId: nodeData.taskId || nodeData.taskReferenceName,
                            overrideInput,
                          });
                        }
                        if (onRerunTask) {
                          onRerunTask(nodeData.taskReferenceName, overrideInput);
                        }
                      }}
                      className="h-6 text-[10px] gap-1 px-2 shadow-sm"
                      data-testid="inspector-dlq-replay-btn"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Repair & Replay (DLQ)</span>
                    </Button>
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap overflow-x-auto bg-black/20 p-2 rounded">
                    {nodeData.error}
                  </pre>
                </div>
              )}
            </TabsContent>

            {/* Payloads Tab */}
            <TabsContent value="payloads" className="mt-0 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-primary" />
                    Input Parameters (Editable for Re-Run)
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={rerunMutation.isPending}
                    onClick={() => {
                      if (executionId) {
                        rerunMutation.mutate({
                          executionId,
                          taskReferenceName: nodeData.taskReferenceName,
                          overrideInput,
                        });
                      }
                      if (onRerunTask) {
                        onRerunTask(nodeData.taskReferenceName, overrideInput);
                      }
                    }}
                    className="h-7 text-xs gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                    data-testid="debugger-rerun-node-btn"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Edit Input & Re-Run From Node</span>
                  </Button>
                </div>
                <VisualJsonEditor
                  value={overrideInput}
                  onChange={(nextVal) => {
                    if (nextVal && typeof nextVal === 'object' && !Array.isArray(nextVal)) {
                      setOverrideInput(nextVal as Record<string, unknown>);
                    }
                  }}
                  defaultMode="tree"
                  height="200px"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  Task Output Data
                </span>
                <VisualJsonEditor
                  value={nodeData.outputParameters || {}}
                  onChange={() => {}}
                  readOnly
                  defaultMode="tree"
                  height="180px"
                />
              </div>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="mt-0 space-y-2">
              {nodeLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-4 text-center">
                  No telemetry logs captured specifically for this task step.
                </p>
              ) : (
                <div className="space-y-2 font-mono text-[11px]">
                  {nodeLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded-lg bg-background/50 border border-border/30 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{log.time}</span>
                        <Badge
                          variant="outline"
                          className={
                            log.level === 'SUCCESS'
                              ? 'text-emerald-500 border-emerald-500/30'
                              : log.level === 'ERROR'
                              ? 'text-rose-500 border-rose-500/30'
                              : 'text-muted-foreground'
                          }
                        >
                          {log.level}
                        </Badge>
                      </div>
                      <p className="text-foreground whitespace-pre-wrap">{log.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
