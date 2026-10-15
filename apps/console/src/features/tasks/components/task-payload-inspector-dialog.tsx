import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type Task } from '../data/schema';
import { ExternalLink, Terminal, Cpu, Clock, RefreshCw } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

interface TaskPayloadInspectorDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskPayloadInspectorDialog({
  task,
  open,
  onOpenChange,
}: TaskPayloadInspectorDialogProps) {
  const navigate = useNavigate();

  if (!task) return null;

  const handleOpenInStudio = () => {
    onOpenChange(false);
    navigate({
      to: '/workflows' as any,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 rounded-2xl backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-white/10 shadow-2xl">
        <DialogHeader className="pb-2 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              <DialogTitle className="text-base font-bold">
                Workflow Execution Instance Details: {task.id}
              </DialogTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {task.taskType || 'SIMPLE'}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Execution Unit: <span className="font-mono text-foreground font-semibold">{task.taskReferenceName || task.id}</span>
            {task.workflowId && (
              <> · Workflow Definition: <span className="font-mono text-foreground">{task.workflowName || task.workflowId}</span></>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Telemetry Bar */}
        <div className="grid grid-cols-3 gap-2 py-2 text-xs">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/40 border border-border/40">
            <Cpu className="w-4 h-4 text-primary" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Lease Owner</p>
              <p className="font-mono truncate">{task.leaseOwner || 'Unassigned / Decider'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/40 border border-border/40">
            <RefreshCw className="w-4 h-4 text-amber-500" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Attempt</p>
              <p className="font-mono">{task.attempt || 1} of {task.maxRetries || 3}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/40 border border-border/40">
            <Clock className="w-4 h-4 text-sky-500" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Duration</p>
              <p className="font-mono">{task.durationMs ? `${task.durationMs}ms` : 'In flight'}</p>
            </div>
          </div>
        </div>

        {/* Payload Tabs */}
        <Tabs defaultValue="input" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="input">Input Data</TabsTrigger>
            <TabsTrigger value="output">Output Data</TabsTrigger>
            <TabsTrigger value="error" disabled={!task.errorMessage}>Error Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="flex-1 overflow-auto mt-2 p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs border border-white/10">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(task.inputData || { simulated: true, taskId: task.id }, null, 2)}
            </pre>
          </TabsContent>

          <TabsContent value="output" className="flex-1 overflow-auto mt-2 p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs border border-white/10">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(task.outputData || { status: task.status, executionState: 'COMPLETED' }, null, 2)}
            </pre>
          </TabsContent>

          {task.errorMessage && (
            <TabsContent value="error" className="flex-1 overflow-auto mt-2 p-3 rounded-xl bg-rose-950/40 text-rose-200 font-mono text-xs border border-rose-500/20">
              <pre className="whitespace-pre-wrap">{task.errorMessage}</pre>
            </TabsContent>
          )}
        </Tabs>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/40 mt-auto">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={handleOpenInStudio}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Inspect in Visual DAG Studio
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
