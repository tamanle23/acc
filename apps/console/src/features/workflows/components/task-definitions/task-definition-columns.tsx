import React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
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
  SlidersHorizontal,
  History,
  UploadCloud,
  Trash2,
  Clock,
  RotateCw,
  Eye,
  GitBranch,
} from 'lucide-react';
import { DataTableColumnHeader } from '@/components/data-table';
import { type TaskDefinitionRecord, resolveTaskCategory } from '@/features/workflows/api/task-definition-api';
import { taskContractRegistry } from '../studio/utils/contracts/task-contract-registry';

interface CreateTaskDefinitionColumnsProps {
  onEditTaskDef: (taskDef: TaskDefinitionRecord) => void;
  onViewHistory: (taskName: string) => void;
  onPublishTaskDef: (name: string, version: number) => void;
  onDeleteDraft: (name: string, version: number) => void;
  onForkDraft?: (taskDef: TaskDefinitionRecord) => void;
}

export const createTaskDefinitionColumns = ({
  onEditTaskDef,
  onViewHistory,
  onPublishTaskDef,
  onDeleteDraft,
  onForkDraft,
}: CreateTaskDefinitionColumnsProps): ColumnDef<TaskDefinitionRecord>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Task Definition" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      const isBuiltIn = taskContractRegistry.isBuiltIn(item.name);
      const category = resolveTaskCategory(item.name);
      return (
        <div className="flex flex-col min-w-[200px]">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground font-mono text-sm">
              {item.name}
            </span>
            {isBuiltIn ? (
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-medium tracking-wide"
              >
                BUILT-IN
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={
                  category === 'COMMERCE'
                    ? 'text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : category === 'AI'
                    ? 'text-[9px] px-1 py-0 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                    : category === 'CONTENT'
                    ? 'text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : category === 'SYSTEM'
                    ? 'text-[9px] px-1 py-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    : 'text-[9px] px-1 py-0 bg-muted/60 text-muted-foreground'
                }
              >
                {category}
              </Badge>
            )}
          </div>
          {item.description && (
            <span className="text-xs text-muted-foreground truncate max-w-[320px] mt-0.5">
              {item.description}
            </span>
          )}
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: 'version',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Version" className="w-[100px]" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-mono text-xs bg-muted/30">
        v{row.original.version}
      </Badge>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" className="w-[110px]" />
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge
          variant="outline"
          className={
            status === 'ACTIVE'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : status === 'DRAFT'
              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
              : status === 'DEPRECATED'
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
          }
        >
          {status}
        </Badge>
      );
    },
    enableSorting: true,
  },
  {
    id: 'complexity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contract Schema" className="w-[140px]" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      const inProps = item.inputSchema && typeof item.inputSchema === 'object' && item.inputSchema.properties
        ? Object.keys(item.inputSchema.properties as Record<string, unknown>).length
        : 0;
      const outProps = item.outputSchema && typeof item.outputSchema === 'object' && item.outputSchema.properties
        ? Object.keys(item.outputSchema.properties as Record<string, unknown>).length
        : 0;
      return (
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            {inProps} in
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {outProps} out
          </span>
        </div>
      );
    },
  },
  {
    id: 'policy',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Execution Policy" className="w-[170px]" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title="Timeout">
            <Clock className="w-3 h-3 text-muted-foreground/70" />
            {item.timeoutSeconds || 30}s
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1" title="Retry Count & Backoff">
            <RotateCw className="w-3 h-3 text-muted-foreground/70" />
            {item.retryCount || 3}x ({item.backoffRate || 2}x)
          </span>
        </div>
      );
    },
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const item = row.original;
      const isBuiltIn = taskContractRegistry.isBuiltIn(item.name);
      const isDraft = item.status === 'DRAFT';

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0"
              data-testid={`task-def-actions-${item.name}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs font-semibold flex items-center justify-between">
              <span className="truncate">{item.name}</span>
              {isBuiltIn && (
                <span className="text-[10px] font-normal text-muted-foreground uppercase">System</span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {isBuiltIn ? (
              <>
                <DropdownMenuItem
                  onClick={() => onEditTaskDef(item)}
                  className="gap-2 cursor-pointer text-xs"
                >
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  Inspect Contract
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onForkDraft ? onForkDraft(item) : onEditTaskDef(item)}
                  className="gap-2 cursor-pointer text-xs"
                >
                  <GitBranch className="h-3.5 w-3.5 text-indigo-500" />
                  Fork as Custom Draft
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem
                onClick={() => onEditTaskDef(item)}
                className="gap-2 cursor-pointer text-xs"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {isDraft ? 'Edit Draft' : 'Fork Next Version'}
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => onViewHistory(item.name)}
              className="gap-2 cursor-pointer text-xs"
            >
              <History className="h-3.5 w-3.5" />
              Version History
            </DropdownMenuItem>

            {!isBuiltIn && isDraft && (
              <DropdownMenuItem
                onClick={() => onPublishTaskDef(item.name, item.version)}
                className="gap-2 cursor-pointer text-xs text-emerald-600 dark:text-emerald-400 font-medium"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Publish to Active
              </DropdownMenuItem>
            )}

            {!isBuiltIn && isDraft && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDeleteDraft(item.name, item.version)}
                  className="gap-2 cursor-pointer text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Draft
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
];
