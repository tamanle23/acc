import React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Play,
  Trash2,
  Eye,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Archive,
  Loader2,
} from 'lucide-react';
import { DataTableColumnHeader } from '@/components/data-table';
import type { TaskDlqRecordDto } from '@acc/client';

interface CreateDlqColumnsProps {
  onInspect: (record: TaskDlqRecordDto) => void;
  onReplay: (record: TaskDlqRecordDto) => void;
  onDiscard: (record: TaskDlqRecordDto) => void;
  replayingDlqId?: string | null;
}

export const createDlqColumns = ({
  onInspect,
  onReplay,
  onDiscard,
  replayingDlqId,
}: CreateDlqColumnsProps): ColumnDef<TaskDlqRecordDto>[] => [
  {
    accessorKey: 'taskId',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Task & Execution" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs font-semibold text-foreground">
            {item.taskId}
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>WF:</span>
            <Link
              to={'/workflow-executions' as any}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-primary/80 hover:text-primary hover:underline"
              title={`View workflow execution ${item.workflowId}`}
            >
              {item.workflowId}
            </Link>
            <span>•</span>
            <span className="font-mono text-muted-foreground/70">{item.dlqId}</span>
          </div>
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: 'taskType',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type & Domain" className="w-[140px]" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="font-mono text-[10px] w-fit border-primary/20 bg-primary/5">
            {item.taskType}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {item.domain || 'default'}
          </span>
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: 'errorMessage',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Error Details" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="flex items-start gap-1.5 max-w-[340px]">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span
            className="text-xs text-foreground/90 font-mono line-clamp-2"
            title={item.errorMessage}
          >
            {item.errorMessage || 'Unknown error occurred'}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'retryCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Retries" className="w-[90px]" />
    ),
    cell: ({ row }) => {
      const count = row.original.retryCount;
      return (
        <Badge variant="secondary" className="font-mono text-xs">
          {count} {count === 1 ? 'retry' : 'retries'}
        </Badge>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" className="w-[120px]" />
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      if (status === 'ISOLATED') {
        return (
          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
            <AlertTriangle className="h-3 w-3" />
            ISOLATED
          </Badge>
        );
      }
      if (status === 'REPLAYED') {
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
            <CheckCircle2 className="h-3 w-3" />
            REPLAYED
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground w-fit">
          <Archive className="h-3 w-3" />
          DISCARDED
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
    enableSorting: true,
  },
  {
    accessorKey: 'isolatedAtMs',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Isolated At" className="w-[150px]" />
    ),
    cell: ({ row }) => {
      const ms = row.original.isolatedAtMs;
      const formatted = new Date(ms).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      return <span className="text-xs text-muted-foreground">{formatted}</span>;
    },
    enableSorting: true,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const item = row.original;
      const isReplaying = replayingDlqId === item.dlqId;
      return (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(item);
            }}
            title="Inspect Error & Payload"
            aria-label={`Inspect DLQ task ${item.taskId}`}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Inspect
          </Button>
          {item.status === 'ISOLATED' && (
            <Button
              variant="outline"
              size="sm"
              disabled={isReplaying}
              className="h-8 px-2 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 min-w-[76px]"
              onClick={(e) => {
                e.stopPropagation();
                onReplay(item);
              }}
              title="Replay Quarantined Task"
              aria-label={`Replay DLQ task ${item.taskId}`}
            >
              {isReplaying ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin text-emerald-500" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
              )}
              {isReplaying ? 'Replaying...' : 'Replay'}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                aria-label={`Actions for DLQ task ${item.taskId}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[160px]">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onInspect(item)}>
                <Eye className="mr-2 h-3.5 w-3.5" />
                View Details
              </DropdownMenuItem>
              {item.status === 'ISOLATED' && (
                <DropdownMenuItem onClick={() => onReplay(item)}>
                  <Play className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                  Replay Task
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDiscard(item)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Discard Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
