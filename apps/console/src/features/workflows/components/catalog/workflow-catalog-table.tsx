import React, { useMemo, useState } from 'react';
import {
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Plus, Workflow } from 'lucide-react';
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
} from '@/components/data-table';
import {
  type WorkflowDefinitionSummary,
  useToggleWorkflowStatus,
  useDeleteWorkflowDefinition,
} from '@/features/workflows/api/workflow-api';
import { createWorkflowCatalogColumns } from './workflow-catalog-columns';
import { cn } from '@/lib/utils';

interface WorkflowCatalogTableProps {
  data: WorkflowDefinitionSummary[];
  search?: Record<string, unknown>;
  isLoading: boolean;
  onDesignWorkflow: (workflowKey: string) => void;
  onCreateNew: () => void;
  onFleetMigrate?: (workflow: WorkflowDefinitionSummary) => void;
}

export const WorkflowCatalogTable: React.FC<WorkflowCatalogTableProps> = ({
  data: definitions,
  isLoading,
  onDesignWorkflow,
  onCreateNew,
  onFleetMigrate,
}) => {
  const toggleMutation = useToggleWorkflowStatus();
  const deleteMutation = useDeleteWorkflowDefinition();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const columns = useMemo(
    () =>
      createWorkflowCatalogColumns({
        onDesignWorkflow,
        onToggleStatus: (workflowKey, status) =>
          toggleMutation.mutate({ workflowKey, status }),
        onDeleteWorkflow: (workflowKey) => deleteMutation.mutate(workflowKey),
        onFleetMigrate,
      }),
    [onDesignWorkflow, toggleMutation, deleteMutation, onFleetMigrate]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: definitions,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16', // Add margin bottom to the table on mobile when the toolbar is visible
        'flex flex-1 flex-col gap-4'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          onClick={onCreateNew}
          size="sm"
          className="h-8 gap-1 shadow-md shadow-primary/20 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Workflow
        </Button>
      </div>
      {/* Header Toolbar & Action Bar */}
      <DataTableToolbar
        table={table}
        searchPlaceholder="Search workflows by key or name..."
        filters={[
          {
            columnId: 'status',
            title: 'Status',
            options: [
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Disabled', value: 'DISABLED' },
            ],
          },
        ]}
      />


      {/* Shared DataTable Component */}
      <DataTable
        showRowIndex
        table={table}
        noResultsMessage={
          isLoading ? (
            <span className="italic text-muted-foreground">Loading workflow definitions...</span>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 gap-2 text-muted-foreground">
              <Workflow className="h-8 w-8 text-muted-foreground/40" />
              <span className="text-sm font-medium">No workflow definitions found</span>
              <Button variant="outline" size="sm" onClick={onCreateNew} className="text-xs">
                Create your first workflow
              </Button>
            </div>
          )
        }
      />

      {/* Pagination */}
      <DataTablePagination table={table} className='mt-auto' />
    </div>
  );
};
