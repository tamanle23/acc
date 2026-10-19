import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Save } from 'lucide-react';
import { useUpdateVatInvoice, type VatInvoiceInfo } from '@/features/metadata/api/use-billing';
import { toast } from 'sonner';

interface Props {
  initialData?: VatInvoiceInfo;
}

export const VatInvoiceForm: React.FC<Props> = ({ initialData }) => {
  const [companyName, setCompanyName] = useState(initialData?.companyName || '');
  const [taxCode, setTaxCode] = useState(initialData?.taxCode || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [isAutoInvoice, setIsAutoInvoice] = useState(initialData?.isAutoInvoice ?? true);

  const updateMutation = useUpdateVatInvoice();

  useEffect(() => {
    if (initialData) {
      setCompanyName(initialData.companyName || '');
      setTaxCode(initialData.taxCode || '');
      setAddress(initialData.address || '');
      setEmail(initialData.email || '');
      setIsAutoInvoice(initialData.isAutoInvoice ?? true);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      {
        companyName,
        taxCode,
        address,
        email,
        isAutoInvoice,
      },
      {
        onSuccess: () => {
          toast.success('Đã lưu thông tin xuất hóa đơn điện tử GTGT thành công!');
        },
        onError: () => {
          toast.error('Không thể cập nhật thông tin hóa đơn.');
        },
      }
    );
  };

  return (
    <div className="space-y-4 p-6 rounded-3xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-white/20">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              Thông tin Hóa đơn Điện tử Doanh nghiệp (VAT E-Invoice)
            </h3>
            <p className="text-xs text-muted-foreground">
              Thông tin phục vụ xuất hóa đơn GTGT tự động qua cổng Tổng cục Thuế Việt Nam khi thanh toán VietQR.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
          Tuân thủ TCT VN
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Tên Doanh nghiệp / Tổ chức xuất hóa đơn *
            </label>
            <Input
              required
              placeholder="Ví dụ: Công ty Cổ phần Công nghệ ABC"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="h-9 text-xs bg-white/50 dark:bg-white/5 border-white/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Mã số thuế Doanh nghiệp (MST) *
            </label>
            <Input
              required
              placeholder="0101234567 hoặc 0101234567-001"
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              className="h-9 text-xs bg-white/50 dark:bg-white/5 border-white/20 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Địa chỉ đăng ký kinh doanh hợp pháp *
            </label>
            <Input
              required
              placeholder="Tầng 10, Tòa nhà Bitexco, Q.1, TP. Hồ Chí Minh"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-9 text-xs bg-white/50 dark:bg-white/5 border-white/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Email nhận hóa đơn điện tử (Bộ phận Kế toán) *
            </label>
            <Input
              required
              type="email"
              placeholder="ketoan@doanhnghiep.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 text-xs bg-white/50 dark:bg-white/5 border-white/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="autoInvoice"
            checked={isAutoInvoice}
            onChange={(e) => setIsAutoInvoice(e.target.checked)}
            className="rounded border-white/30 text-primary focus:ring-primary h-4 w-4"
          />
          <label htmlFor="autoInvoice" className="text-xs text-muted-foreground select-none cursor-pointer">
            Tự động xuất hóa đơn điện tử GTGT và gửi vào email kế toán ngay sau khi giao dịch VietQR hoàn tất.
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            size="sm"
            disabled={updateMutation.isPending}
            className="text-xs gap-1.5 font-semibold bg-primary text-primary-foreground shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{updateMutation.isPending ? 'Đang lưu...' : 'Lưu thông tin hóa đơn'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
