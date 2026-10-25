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
import { CheckCircle2, AlertOctagon } from 'lucide-react';
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
} from '@/components/data-table';
import type { TaskDlqRecordDto } from '@acc/client';
import { createDlqColumns } from './dlq-columns';

interface DlqTableProps {
  records: TaskDlqRecordDto[];
  onInspect: (record: TaskDlqRecordDto) => void;
  onReplay: (record: TaskDlqRecordDto) => void;
  onDiscard: (record: TaskDlqRecordDto) => void;
  replayingDlqId?: string | null;
}

export const DlqTable: React.FC<DlqTableProps> = ({
  records,
  onInspect,
  onReplay,
  onDiscard,
  replayingDlqId,
}) => {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'isolatedAtMs', desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const columns = useMemo(
    () =>
      createDlqColumns({
        onInspect,
        onReplay,
        onDiscard,
        replayingDlqId,
      }),
    [onInspect, onReplay, onDiscard, replayingDlqId]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: records,
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
        searchPlaceholder="Search task ID, workflow ID, error message..."
        filters={[
          {
            columnId: 'status',
            title: 'Status',
            options: [
              { label: 'Isolated', value: 'ISOLATED' },
              { label: 'Replayed', value: 'REPLAYED' },
              { label: 'Discarded', value: 'DISCARDED' },
            ],
          },
        ]}
      />

      {/* Shared DataTable Component */}
      <DataTable
        table={table}
        showRowIndex
        noResultsMessage={
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mb-3" />
            <h4 className="text-sm font-semibold text-foreground">Dead-Letter Queue Clean</h4>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              No tasks have exceeded maximum retries or been quarantined in the Dead-Letter Queue.
            </p>
          </div>
        }
      />

      {/* Pagination */}
      <DataTablePagination table={table} />
    </div>
  );
};
