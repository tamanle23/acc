import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
} from '@tanstack/react-table';
import { Receipt } from 'lucide-react';
import type { BillingTransaction } from '@/features/metadata/api/use-billing';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/pagination';
import { getBillingHistoryColumns } from './billing-history-columns';

interface Props {
  transactions?: BillingTransaction[];
}

export const BillingHistoryTable: React.FC<Props> = ({ transactions = [] }) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const handleDownloadReceipt = (orderCode: number) => {
    toast.success(`Đang tải biên lai thanh toán VietQR cho đơn hàng #${orderCode}...`);
  };

  const columns = useMemo(
    () =>
      getBillingHistoryColumns({
        onDownloadReceipt: handleDownloadReceipt,
      }),
    []
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 5,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            Lịch sử Giao dịch & Hóa đơn payOS VietQR
          </h3>
          <p className="text-xs text-muted-foreground">
            Bản ghi tất cả các lệnh thanh toán chuyển khoản Napas247 của Tổ chức.
          </p>
        </div>
      </div>

      <DataTable
        table={table}
        noResultsMessage="Chưa có giao dịch thanh toán nào được ghi nhận."
      />

      {transactions.length > 5 && (
        <DataTablePagination table={table} />
      )}
    </div>
  );
};
