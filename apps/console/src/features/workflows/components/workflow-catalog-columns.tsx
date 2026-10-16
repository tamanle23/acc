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
  Trash2,
  Power,
} from 'lucide-react';
import { DataTableColumnHeader } from '@/components/data-table';
import { type WorkflowDefinitionSummary } from '../api/workflow-api';

interface CreateColumnsProps {
  onDesignWorkflow: (workflowKey: string) => void;
  onToggleStatus: (workflowKey: string, status: 'ACTIVE' | 'DISABLED') => void;
  onDeleteWorkflow: (workflowKey: string) => void;
}

export const createWorkflowCatalogColumns = ({
  onDesignWorkflow,
  onToggleStatus,
  onDeleteWorkflow,
}: CreateColumnsProps): ColumnDef<WorkflowDefinitionSummary>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Workflow" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            {item.name}
          </span>
          <span className="text-xs font-mono text-muted-foreground">{item.workflowKey}</span>
          {item.description && (
            <span className="text-xs text-muted-foreground truncate max-w-[260px]">
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
      <DataTableColumnHeader column={column} title="Version" className="w-[120px]" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-mono text-xs">
        v{row.original.version || 1}
      </Badge>
    ),
    enableSorting: true,
  },
  {
    id: 'nodes',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nodes" className="w-[120px]" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      const nodeCount = item.tasks ? item.tasks.length : Object.keys(item.layoutMetadata || {}).length;
      return <span className="text-xs font-medium text-foreground">{nodeCount} nodes</span>;
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" className="w-[120px]" />
    ),
    cell: ({ row }) => {
      const isActive = row.original.status !== 'DISABLED';
      return (
        <Badge
          variant="outline"
          className={
            isActive
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
              : 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20'
          }
        >
          {isActive ? 'Active' : 'Disabled'}
        </Badge>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: 'updatedAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Updated" className="w-[160px]" />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.updatedAt || 'Recently'}
      </span>
    ),
    enableSorting: true,
  },
  {
    id: 'actions',
    header: () => <div className="text-right w-[100px]">Actions</div>,
    cell: ({ row }) => {
      const item = row.original;
      const isActive = item.status !== 'DISABLED';

      return (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 text-primary hover:text-primary"
            onClick={() => onDesignWorkflow(item.workflowKey)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Design
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onDesignWorkflow(item.workflowKey)}>
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Open in Studio
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onToggleStatus(item.workflowKey, isActive ? 'DISABLED' : 'ACTIVE')
                }
              >
                <Power className="h-4 w-4 mr-2" />
                {isActive ? 'Disable Workflow' : 'Enable Workflow'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteWorkflow(item.workflowKey)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
