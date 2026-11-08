import React, { useMemo, useState } from 'react';
import {
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AuthorizedButton } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Plus, SlidersHorizontal, CheckCircle2, Clock, FileEdit } from 'lucide-react';
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
} from '@/components/data-table';
import { type TaskDefinitionRecord } from '@/features/workflows/api/task-definition-api';
import { createTaskDefinitionColumns } from './task-definition-columns';
import { cn } from '@/lib/utils';

export interface TaskDefinitionTableProps {
  data: TaskDefinitionRecord[];
  isLoading: boolean;
  onEditTaskDef: (taskDef: TaskDefinitionRecord) => void;
  onViewHistory: (taskName: string) => void;
  onPublishTaskDef: (name: string, version: number) => void;
  onDeleteDraft: (name: string, version: number) => void;
  onCreateNew: () => void;
}

export const TaskDefinitionTable: React.FC<TaskDefinitionTableProps> = ({
  data,
  isLoading,
  onEditTaskDef,
  onViewHistory,
  onPublishTaskDef,
  onDeleteDraft,
  onCreateNew,
}) => {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const columns = useMemo(
    () =>
      createTaskDefinitionColumns({
        onEditTaskDef,
        onViewHistory,
        onPublishTaskDef,
        onDeleteDraft,
      }),
    [onEditTaskDef, onViewHistory, onPublishTaskDef, onDeleteDraft]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
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
        'max-sm:has-[div[role="toolbar"]]:mb-16',
        'flex flex-1 flex-col gap-4'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AuthorizedButton
          permission="workflow:definition:manage"
          onClick={onCreateNew}
          size="sm"
          className="h-8 gap-1.5 shadow-md shadow-primary/20 text-xs font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Task Definition
        </AuthorizedButton>
      </div>

      {/* Header Toolbar & Faceted Filters */}
      <DataTableToolbar
        table={table}
        searchPlaceholder="Search task definitions by name or description..."
        filters={[
          {
            columnId: 'status',
            title: 'Status',
            options: [
              { label: 'Active', value: 'ACTIVE', icon: CheckCircle2 },
              { label: 'Draft', value: 'DRAFT', icon: FileEdit },
              { label: 'Deprecated', value: 'DEPRECATED', icon: Clock },
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
            <span className="italic text-muted-foreground">Loading task definitions...</span>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 gap-2 text-muted-foreground">
              <SlidersHorizontal className="h-8 w-8 text-muted-foreground/40" />
              <span className="text-sm font-medium">No task definitions found</span>
              <AuthorizedButton
                permission="workflow:definition:manage"
                variant="outline"
                size="sm"
                onClick={onCreateNew}
                className="text-xs"
              >
                Define your first task contract
              </AuthorizedButton>
            </div>
          )
        }
      />

      {/* Pagination */}
      <DataTablePagination table={table} className="mt-auto" />
    </div>
  );
};
