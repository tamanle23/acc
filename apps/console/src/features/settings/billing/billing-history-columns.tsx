import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, XCircle, Download } from 'lucide-react';
import type { BillingTransaction } from '@/features/metadata/api/use-billing';
import { DataTableColumnHeader } from '@/components/data-table/column-header';

interface BillingHistoryColumnsOptions {
  onDownloadReceipt: (orderCode: number) => void;
}

export function getBillingHistoryColumns({
  onDownloadReceipt,
}: BillingHistoryColumnsOptions): ColumnDef<BillingTransaction>[] {
  return [
    {
      accessorKey: 'orderCode',
      id: 'orderCode',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Mã đơn hàng" />
      ),
      cell: ({ row }) => {
        return (
          <span className="font-mono font-medium text-foreground">
            #{row.original.orderCode}
          </span>
        );
      },
    },
    {
      accessorKey: 'description',
      id: 'description',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Gói dịch vụ" />
      ),
      cell: ({ row }) => {
        return (
          <span className="font-medium text-foreground">
            {row.original.description}
          </span>
        );
      },
    },
    {
      accessorKey: 'amount',
      id: 'amount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Số tiền" />
      ),
      cell: ({ row }) => {
        return (
          <span className="font-bold text-foreground">
            {row.original.amount.toLocaleString()} ₫
          </span>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      id: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Thời gian" />
      ),
      cell: ({ row }) => {
        return (
          <span className="text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString('vi-VN')}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      id: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Trạng thái" />
      ),
      cell: ({ row }) => {
        const status = row.original.status || '';
        switch (status.toUpperCase()) {
          case 'ACTIVE':
          case 'SUCCESS':
          case '00':
            return (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Thành công
              </Badge>
            );
          case 'PENDING':
            return (
              <Badge variant="outline" className="text-amber-600 border-amber-500/40 bg-amber-500/10 text-[10px] gap-1">
                <Clock className="h-3 w-3" />
                Đang chờ
              </Badge>
            );
          default:
            return (
              <Badge variant="destructive" className="text-[10px] gap-1">
                <XCircle className="h-3 w-3" />
                {status}
              </Badge>
            );
        }
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Biên lai</span>,
      cell: ({ row }) => {
        const tx = row.original;
        return (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 text-xs text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => onDownloadReceipt(tx.orderCode)}
              aria-label={`Tải biên lai đơn hàng #${tx.orderCode}`}
            >
              <Download className="h-3.5 w-3.5" />
              Tải biên lai
            </Button>
          </div>
        );
      },
    },
  ];
}
