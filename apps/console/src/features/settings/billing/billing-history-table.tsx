import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Receipt, CheckCircle2, Clock, XCircle, Download } from 'lucide-react';
import type { BillingTransaction } from '@/features/metadata/api/use-billing';
import { toast } from 'sonner';

interface Props {
  transactions?: BillingTransaction[];
}

export const BillingHistoryTable: React.FC<Props> = ({ transactions = [] }) => {
  const getStatusBadge = (status: string) => {
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
  };

  const handleDownloadReceipt = (orderCode: number) => {
    toast.success(`Đang tải biên lai thanh toán VietQR cho đơn hàng #${orderCode}...`);
  };

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

      <div className="rounded-2xl border border-white/20 dark:border-white/10 overflow-hidden bg-white/40 dark:bg-white/5 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/40 dark:bg-white/5 border-b border-white/10 text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-4">Mã đơn hàng</th>
                <th className="py-3 px-4">Gói dịch vụ</th>
                <th className="py-3 px-4">Số tiền</th>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Biên lai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground italic">
                    Chưa có giao dịch thanh toán nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.orderCode} className="hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      #{tx.orderCode}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {tx.description}
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground">
                      {tx.amount.toLocaleString()} ₫
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadReceipt(tx.orderCode)}
                        className="h-7 px-2 text-[11px] gap-1 text-primary hover:text-primary"
                      >
                        <Download className="h-3 w-3" />
                        <span>Biên lai</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
