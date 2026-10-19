import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Radio,
  Clock,
  User,
  Layers,
  ArrowRight,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { announceToScreenReader } from '@/hooks/use-aria-announce';
import { useApprovalTasks, useResolveApprovalTask, type ApprovalTask } from '../api/workflow-api';
import { approvalTaskMockStore } from '@/core/sandbox';

export type { ApprovalTask };

export function ApprovalsInbox() {
  const { t } = useTranslation();

  const { data: remoteTasks } = useApprovalTasks();
  const resolveMutation = useResolveApprovalTask();

  const [createdTasks, setCreatedTasks] = useState<ApprovalTask[]>([]);
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<ApprovalTask>>>({});
  const [selectedTask, setSelectedTask] = useState<ApprovalTask | null>(null);
  const [activeAction, setActiveAction] = useState<'REJECT' | 'CHANGES_REQUESTED' | null>(null);
  const [rationaleText, setRationaleText] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [sseConnected, setSseConnected] = useState(false);

  const baseTasks = React.useMemo(() => {
    return remoteTasks && remoteTasks.length > 0 ? remoteTasks : approvalTaskMockStore.getTasks();
  }, [remoteTasks]);

  const tasks = React.useMemo(() => {
    const combined = [...createdTasks, ...baseTasks];
    return combined.map((task) => {
      const override = localOverrides[task.id];
      return override ? { ...task, ...override } : task;
    });
  }, [createdTasks, baseTasks, localOverrides]);

  // Connect to real-time SSE stream with automatic reconnection resilience
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const connectSse = () => {
      try {
        if (typeof EventSource === 'undefined') return;

        eventSource = new EventSource('/api/v1/notifications/stream');
        eventSource.onopen = () => {
          if (isMounted) setSseConnected(true);
        };
        eventSource.onerror = () => {
          if (isMounted) {
            setSseConnected(false);
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            // Auto-reconnect after 5 seconds backoff
            reconnectTimeout = setTimeout(() => {
              if (isMounted) connectSse();
            }, 5000);
          }
        };

        eventSource.addEventListener('APPROVAL_REQUESTED', (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            const newTask: ApprovalTask = {
              id: `appr-${Date.now()}`,
              workflowId: 'wf-dynamic-entity',
              workflowName: `Entity Type #${data.entityTypeId} Workflow`,
              entityTypeId: data.entityTypeId,
              entityTypeName: `Entity Type #${data.entityTypeId}`,
              recordId: data.recordId,
              stepName: 'Executive Custodian Approval',
              requestedBy: data.requestedBy || 'SYSTEM',
              requestedAt: new Date().toISOString(),
              status: 'PENDING',
              currentAttributes: { status: 'PENDING' },
              proposedAttributes: { status: 'APPROVED' },
            };
            setCreatedTasks((prev) => [newTask, ...prev]);
            announceToScreenReader('New approval task received');
          } catch {
            // Ignore invalid JSON payload in SSE event
          }
        });
      } catch {
        // EventSource initialization failed or unsupported in test/offline environment
      }
    };

    connectSse();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleApprove = useCallback(
    async (task: ApprovalTask) => {
      setLocalOverrides((prev) => ({
        ...prev,
        [task.id]: { status: 'APPROVED' },
      }));
      announceToScreenReader(`Approval task ${task.id} approved successfully`);

      try {
        await resolveMutation.mutateAsync({
          taskId: task.id,
          action: 'APPROVED',
        });
      } catch {
        // fallback
      }
    },
    [resolveMutation]
  );

  const handleOpenRationaleDialog = useCallback(
    (task: ApprovalTask, action: 'REJECT' | 'CHANGES_REQUESTED') => {
      setSelectedTask(task);
      setActiveAction(action);
      setRationaleText('');
    },
    []
  );

  const handleConfirmRationaleAction = useCallback(async () => {
    if (!selectedTask || !activeAction || !rationaleText.trim()) return;

    const taskId = selectedTask.id;
    const action = activeAction;
    const rationale = rationaleText.trim();

    setLocalOverrides((prev) => ({
      ...prev,
      [taskId]: {
        status: action === 'REJECT' ? 'REJECTED' : 'CHANGES_REQUESTED',
        rationale,
      },
    }));

    announceToScreenReader(`Approval task ${taskId} marked as ${action}`);
    setSelectedTask(null);
    setActiveAction(null);
    setRationaleText('');

    try {
      await resolveMutation.mutateAsync({
        taskId,
        action,
        rationale,
      });
    } catch {
      // fallback
    }
  }, [selectedTask, activeAction, rationaleText, resolveMutation]);

  const filteredTasks = tasks.filter((t) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      t.workflowName.toLowerCase().includes(q) ||
      t.entityTypeName.toLowerCase().includes(q) ||
      t.requestedBy.toLowerCase().includes(q) ||
      String(t.recordId).includes(q) ||
      JSON.stringify(t.currentAttributes).toLowerCase().includes(q) ||
      JSON.stringify(t.proposedAttributes).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t('workflows.approvals_inbox', 'Human-in-the-Loop Approvals Inbox')}
            </h1>
            <Badge
              variant={sseConnected ? 'default' : 'outline'}
              className="flex items-center gap-1.5 text-xs py-0.5 px-2.5 backdrop-blur-md bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
            >
              <Radio className={`h-3 w-3 ${sseConnected ? 'animate-pulse text-emerald-500' : 'text-muted-foreground'}`} />
              {sseConnected ? t('common.sse_live', 'Live SSE Connected') : t('common.offline_mock', 'Offline Mode')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              'workflows.approvals_desc',
              'Authoritative review gate for DAG automated workflow steps and high-impact entity mutations.'
            )}
          </p>
        </div>

        {/* Filter Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('common.search_approvals', 'Filter approvals...')}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-white/30 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm"
          />
        </div>
      </div>

      {/* Task List Cards */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16 backdrop-blur-xl bg-white/40 dark:bg-slate-900/40 rounded-2xl border border-white/20 p-8 shadow-sm">
            <ShieldCheck className="h-10 w-10 mx-auto text-emerald-500/70 mb-3" />
            <h3 className="font-semibold text-foreground text-sm">No Pending Approvals</h3>
            <p className="text-xs text-muted-foreground mt-1">
              All workflow execution review steps have been evaluated.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="backdrop-blur-xl bg-white/65 dark:bg-slate-900/65 border border-white/30 dark:border-white/10 rounded-2xl p-5 shadow-xl shadow-black/5 dark:shadow-black/30 hover:border-primary/40 transition-all duration-200"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/40">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-base text-foreground">
                      {task.workflowName}
                    </span>
                    <Badge
                      variant={
                        task.status === 'APPROVED'
                          ? 'default'
                          : task.status === 'REJECTED'
                          ? 'destructive'
                          : task.status === 'CHANGES_REQUESTED'
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-xs"
                    >
                      {task.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      {task.entityTypeName} #{task.recordId}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {task.requestedBy}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(task.requestedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {task.status === 'PENDING' && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                      onClick={() => handleOpenRationaleDialog(task, 'CHANGES_REQUESTED')}
                    >
                      <AlertCircle className="h-3.5 w-3.5 mr-1" />
                      Request Changes
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => handleOpenRationaleDialog(task, 'REJECT')}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                      onClick={() => handleApprove(task)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      Approve Step
                    </Button>
                  </div>
                )}
              </div>

              {/* Entity Context Diff Table */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-border/40 bg-muted/20">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Current Entity State
                  </span>
                  <div className="space-y-1.5 font-mono text-xs">
                    {Object.entries(task.currentAttributes).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-0.5 border-b border-border/20">
                        <span className="text-muted-foreground">{k}:</span>
                        <span className="text-foreground font-medium">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ArrowRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      Proposed Mutated State
                    </span>
                  </div>
                  <div className="space-y-1.5 font-mono text-xs">
                    {Object.entries(task.proposedAttributes).map(([k, v]) => {
                      const changed = task.currentAttributes[k] !== v;
                      return (
                        <div
                          key={k}
                          className={`flex justify-between py-0.5 border-b border-border/20 ${
                            changed ? 'text-emerald-800 dark:text-emerald-200 font-semibold' : 'text-foreground'
                          }`}
                        >
                          <span className={changed ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}>
                            {k}:
                          </span>
                          <span>{String(v)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Rationale Display if action taken */}
              {task.rationale && (
                <div className="mt-3 p-3 rounded-xl border border-border/40 bg-muted/40 text-xs">
                  <span className="font-semibold text-foreground mr-2">Audit Rationale:</span>
                  <span className="text-muted-foreground">{task.rationale}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Rationale Dialog */}
      <Dialog
        open={Boolean(selectedTask && activeAction)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTask(null);
            setActiveAction(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md backdrop-blur-2xl bg-background/95 border border-border/40 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {activeAction === 'REJECT' ? 'Reject Workflow Step' : 'Request Changes'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              A mandatory audit rationale is required for governance compliance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="rationale" className="text-xs font-semibold">
              Reason / Instruction <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="rationale"
              placeholder="Provide specific justification or required modifications..."
              value={rationaleText}
              onChange={(e) => setRationaleText(e.target.value)}
              className="text-xs h-24"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTask(null);
                setActiveAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!rationaleText.trim()}
              variant={activeAction === 'REJECT' ? 'destructive' : 'default'}
              onClick={handleConfirmRationaleAction}
            >
              Confirm {activeAction === 'REJECT' ? 'Rejection' : 'Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
