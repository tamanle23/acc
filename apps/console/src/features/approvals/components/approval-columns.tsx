import React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  AlertTriangle,
  Lock,
  Unlock,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { DataTableColumnHeader } from '@/components/data-table';
import type { ApprovalTask } from '@unipost/client';

interface CreateColumnsProps {
  onReviewTask: (task: ApprovalTask) => void;
  onClaimTask: (taskId: string) => void;
  onUnclaimTask: (taskId: string) => void;
  currentUserId?: string;
  isClaimPending?: boolean;
  isUnclaimPending?: boolean;
}

export const createApprovalColumns = ({
  onReviewTask,
  onClaimTask,
  onUnclaimTask,
  currentUserId = 'satnaing',
  isClaimPending = false,
  isUnclaimPending = false,
}: CreateColumnsProps): ColumnDef<ApprovalTask>[] => [
  {
    accessorKey: 'workflowName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Workflow & Step" className="w-[180px]" />
    ),
    cell: ({ row }) => {
      const task = row.original;
      return (
        <div className="space-y-1">
          <span className="text-xs font-semibold text-foreground block truncate">
            {task.workflowName || task.workflowKey}
          </span>
          <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
            {task.taskReferenceName}
          </Badge>
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: 'instructions',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Instructions" />
    ),
    cell: ({ row }) => {
      const task = row.original;
      return (
        <div>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {task.instructions || 'Review upstream execution parameters.'}
          </p>
          <span className="text-[10px] text-muted-foreground/70 font-mono mt-1 block">
            Execution: {task.workflowId}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'role',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Required Role" className="w-[140px]" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">
        {row.original.role || 'ROLE_WORKFLOW_APPROVER'}
      </Badge>
    ),
    enableSorting: true,
  },
  {
    id: 'slaCountdown',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="SLA Countdown" className="w-[130px]" />
    ),
    cell: ({ row }) => {
      const task = row.original;
      if (task.slaBreached) {
        return (
          <Badge variant="destructive" className="flex items-center gap-1 text-[10px] font-semibold animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            SLA Breached
          </Badge>
        );
      }
      const createdTime = new Date(task.createdAt).getTime();
      const deadline = createdTime + (task.slaMinutes || 120) * 60 * 1000;
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
    },
  },
  {
    accessorKey: 'claimedBy',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Claim Status" className="w-[130px]" />
    ),
    cell: ({ row }) => {
      const task = row.original;
      const isClaimedByMe = task.claimedBy === currentUserId;

      if (task.status === 'COMPLETED') {
        return (
          <Badge variant="secondary" className="text-emerald-600 bg-emerald-500/10 text-[10px]">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
          </Badge>
        );
      }
      if (task.status === 'FAILED') {
        return (
          <Badge variant="destructive" className="text-[10px]">
            <XCircle className="w-3 h-3 mr-1" /> Rejected
          </Badge>
        );
      }
      if (task.claimedBy) {
        return (
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-mono font-medium text-foreground">
              {isClaimedByMe ? 'You' : task.claimedBy}
            </span>
          </div>
        );
      }
      return (
        <span className="text-xs text-muted-foreground italic flex items-center gap-1">
          <Unlock className="w-3 h-3" /> Unclaimed
        </span>
      );
    },
    enableSorting: true,
  },
  {
    id: 'actions',
    header: () => <div className="text-right w-[140px]">Actions</div>,
    cell: ({ row }) => {
      const task = row.original;
      const isClaimedByMe = task.claimedBy === currentUserId;
      const taskId = task.taskId || task.id;

      if (task.status !== 'WAITING_FOR_APPROVAL') {
        return (
          <div className="text-right">
            <span className="text-xs text-muted-foreground font-mono">
              {task.decision || 'RESOLVED'}
            </span>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-end gap-1.5">
          {task.claimedBy ? (
            isClaimedByMe ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onUnclaimTask(taskId)}
                  disabled={isUnclaimPending}
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
                onClick={() => onClaimTask(taskId)}
                disabled={isClaimPending}
              >
                Claim
              </Button>
              <Button
                size="sm"
                className="h-7 px-2.5 text-[11px] gap-1"
                onClick={() => {
                  onClaimTask(taskId);
                  onReviewTask(task);
                }}
              >
                Claim & Review <ChevronRight className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      );
    },
  },
];
