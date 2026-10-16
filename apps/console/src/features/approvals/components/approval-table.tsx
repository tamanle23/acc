import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  AlertTriangle,
  UserCheck,
  Lock,
  Unlock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { ApprovalTask } from '@unipost/client';
import { useClaimApprovalMutation, useUnclaimApprovalMutation } from '../hooks/use-approvals';

interface ApprovalTableProps {
  tasks: ApprovalTask[];
  onReviewTask: (task: ApprovalTask) => void;
  currentUserId?: string;
}

export const ApprovalTable: React.FC<ApprovalTableProps> = ({
  tasks,
  onReviewTask,
  currentUserId = 'satnaing',
}) => {
  const claimMutation = useClaimApprovalMutation();
  const unclaimMutation = useUnclaimApprovalMutation();

  const formatTimeRemaining = (createdAt: string, slaMinutes: number = 120, slaBreached?: boolean) => {
    if (slaBreached) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 text-[10px] font-semibold animate-pulse">
          <AlertTriangle className="w-3 h-3" />
          SLA Breached
        </Badge>
      );
    }
    const createdTime = new Date(createdAt).getTime();
    const deadline = createdTime + slaMinutes * 60 * 1000;
    const diffMs = deadline - Date.now();

    if (diffMs <= 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 text-[10px] font-semibold">
          <AlertTriangle className="w-3 h-3" />
          Breached
        </Badge>
      );
    }

    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    const isUrgent = diffMins < 30;

    return (
      <Badge
        variant="secondary"
        className={`flex items-center gap-1 text-[10px] font-medium ${
          isUrgent
            ? 'text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/30 animate-pulse'
            : 'text-slate-600 dark:text-slate-400 bg-slate-500/10'
        }`}
      >
        <Clock className="w-3 h-3" />
        {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`} left
      </Badge>
    );
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/10">
        <ShieldCheck className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <h4 className="text-sm font-semibold text-foreground">No Pending Approvals</h4>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">
          All workflow review gates have been cleared or there are no human tasks assigned to this queue.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 shadow-lg shadow-black/5">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[180px] text-xs font-semibold">Workflow & Step</TableHead>
            <TableHead className="text-xs font-semibold">Instructions</TableHead>
            <TableHead className="w-[140px] text-xs font-semibold">Required Role</TableHead>
            <TableHead className="w-[130px] text-xs font-semibold">SLA Countdown</TableHead>
            <TableHead className="w-[130px] text-xs font-semibold">Claim Status</TableHead>
            <TableHead className="w-[140px] text-right text-xs font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const isClaimedByMe = task.claimedBy === currentUserId;
            const isClaimedByOther = task.claimedBy && !isClaimedByMe;

            return (
              <TableRow key={task.id} className="hover:bg-muted/20 transition-colors">
                {/* Workflow & Step */}
                <TableCell className="align-top py-3.5">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-foreground block truncate">
                      {task.workflowName || task.workflowKey}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                      {task.taskReferenceName}
                    </Badge>
                  </div>
                </TableCell>

                {/* Instructions & Context */}
                <TableCell className="align-top py-3.5">
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {task.instructions || 'Review upstream execution parameters.'}
                  </p>
                  <span className="text-[10px] text-muted-foreground/70 font-mono mt-1 block">
                    Execution: {task.workflowId}
                  </span>
                </TableCell>

                {/* Role */}
                <TableCell className="align-top py-3.5">
                  <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">
                    {task.role || 'ROLE_WORKFLOW_APPROVER'}
                  </Badge>
                </TableCell>

                {/* SLA Countdown */}
                <TableCell className="align-top py-3.5">
                  {formatTimeRemaining(task.createdAt, task.slaMinutes, task.slaBreached)}
                </TableCell>

                {/* Claim Status */}
                <TableCell className="align-top py-3.5">
                  {task.status === 'COMPLETED' ? (
                    <Badge variant="secondary" className="text-emerald-600 bg-emerald-500/10 text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
                    </Badge>
                  ) : task.status === 'FAILED' ? (
                    <Badge variant="destructive" className="text-[10px]">
                      <XCircle className="w-3 h-3 mr-1" /> Rejected
                    </Badge>
                  ) : task.claimedBy ? (
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-mono font-medium text-foreground">
                        {isClaimedByMe ? 'You' : task.claimedBy}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                      <Unlock className="w-3 h-3" /> Unclaimed
                    </span>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell className="align-top py-3.5 text-right">
                  {task.status === 'WAITING_FOR_APPROVAL' ? (
                    <div className="flex items-center justify-end gap-1.5">
                      {task.claimedBy ? (
                        isClaimedByMe ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => unclaimMutation.mutate(task.taskId || task.id)}
                              disabled={unclaimMutation.isPending}
                            >
                              Release
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-2.5 text-[11px] gap-1 bg-primary text-primary-foreground shadow-sm"
                              onClick={() => onReviewTask(task)}
                            >
                              Review <ChevronRight className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Locked</span>
                        )
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() =>
                              claimMutation.mutate({ taskId: task.taskId || task.id, userId: currentUserId })
                            }
                            disabled={claimMutation.isPending}
                          >
                            Claim
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-[11px] gap-1"
                            onClick={() => {
                              claimMutation.mutate({ taskId: task.taskId || task.id, userId: currentUserId });
                              onReviewTask(task);
                            }}
                          >
                            Claim & Review <ChevronRight className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground font-mono">
                      {task.decision || 'RESOLVED'}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
