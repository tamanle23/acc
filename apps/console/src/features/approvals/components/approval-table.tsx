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
import { ShieldCheck } from 'lucide-react';
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
} from '@/components/data-table';
import type { ApprovalTask } from '@unipost/client';
import { useClaimApprovalMutation, useUnclaimApprovalMutation } from '../hooks/use-approvals';
import { createApprovalColumns } from './approval-columns';

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

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const columns = useMemo(
    () =>
      createApprovalColumns({
        onReviewTask,
        onClaimTask: (taskId) => claimMutation.mutate({ taskId, userId: currentUserId }),
        onUnclaimTask: (taskId) => unclaimMutation.mutate(taskId),
        currentUserId,
        isClaimPending: claimMutation.isPending,
        isUnclaimPending: unclaimMutation.isPending,
      }),
    [onReviewTask, claimMutation, unclaimMutation, currentUserId]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tasks,
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
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <DataTableToolbar
        table={table}
        searchPlaceholder="Filter tasks, roles, keys..."
        filters={[
          {
            columnId: 'role',
            title: 'Role',
            options: [
              { label: 'Compliance Officer', value: 'ROLE_COMPLIANCE_OFFICER' },
              { label: 'Finance Director', value: 'ROLE_FINANCE_DIRECTOR' },
              { label: 'Workflow Approver', value: 'ROLE_WORKFLOW_APPROVER' },
            ],
          },
        ]}
      />

      {/* Shared DataTable Component */}
      <DataTable
        showRowIndex
        table={table}
        noResultsMessage={
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl">
            <ShieldCheck className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <h4 className="text-sm font-semibold text-foreground">No Pending Approvals</h4>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              All workflow review gates have been cleared or there are no human tasks assigned to this queue.
            </p>
          </div>
        }
      />

      {/* Pagination */}
      <DataTablePagination table={table} />
    </div>
  );
};
