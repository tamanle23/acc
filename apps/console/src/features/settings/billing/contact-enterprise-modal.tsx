import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Mail, Phone, User, Send, CheckCircle2 } from 'lucide-react';
import { useContactEnterpriseSales } from '@/features/metadata/api/use-billing';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantName: string;
}

export const ContactEnterpriseModal: React.FC<Props> = ({
  isOpen,
  onClose,
  tenantName,
}) => {
  const [companyName, setCompanyName] = useState(tenantName);
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [seatCount, setSeatCount] = useState<number>(50);
  const [requirements, setRequirements] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const contactMutation = useContactEnterpriseSales();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    contactMutation.mutate(
      {
        companyName,
        contactName,
        email,
        phone,
        seatCount,
        requirements,
      },
      {
        onSuccess: () => {
          setIsSuccess(true);
          toast.success('Yêu cầu tư vấn Enterprise đã được gửi tới Đội ngũ Kỹ sư Giải pháp.');
        },
        onError: () => {
          toast.error('Không thể gửi yêu cầu. Vui lòng thử lại.');
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-6 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-2xl">
        <DialogHeader className="space-y-1 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 border border-amber-500/30">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Tư vấn Gói Enterprise (Tổ chức quy mô lớn)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Hạ tầng chuyên dụng (Dedicated Database Replica), SLA 99.99%, và tích hợp SSO nội bộ.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-lg">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-foreground">
                Gửi yêu cầu thành công!
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Chuyên viên giải pháp Acc Enterprise sẽ liên hệ lại với bạn qua email <b>{email}</b> trong vòng 2 giờ làm việc.
              </p>
            </div>
            <Button size="sm" onClick={onClose} className="text-xs">
              Đóng cửa sổ
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 py-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Tên Tổ chức / Doanh nghiệp *</span>
              </label>
              <Input
                required
                placeholder="Tập đoàn Công nghệ / Logistics..."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="h-8.5 text-xs bg-white/50 dark:bg-white/5 border-white/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Người đại diện liên hệ *</span>
                </label>
                <Input
                  required
                  placeholder="Họ và tên"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="h-8.5 text-xs bg-white/50 dark:bg-white/5 border-white/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Số điện thoại *</span>
                </label>
                <Input
                  required
                  placeholder="0912 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-8.5 text-xs bg-white/50 dark:bg-white/5 border-white/20 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Email doanh nghiệp *</span>
                </label>
                <Input
                  required
                  type="email"
                  placeholder="contact@enterprise.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8.5 text-xs bg-white/50 dark:bg-white/5 border-white/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Số lượng người dùng dự kiến
                </label>
                <Input
                  type="number"
                  min={10}
                  value={seatCount}
                  onChange={(e) => setSeatCount(Number(e.target.value))}
                  className="h-8.5 text-xs bg-white/50 dark:bg-white/5 border-white/20 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Yêu cầu kỹ thuật đặc thù (VPC, On-premise, SAML...)
              </label>
              <textarea
                rows={2}
                placeholder="Mô tả tóm tắt kiến trúc dữ liệu và yêu cầu bảo mật của tổ chức..."
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                className="w-full rounded-xl p-2.5 text-xs bg-white/50 dark:bg-white/5 border border-white/20 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-white/10">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={contactMutation.isPending}
                className="text-xs gap-1.5 font-bold bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{contactMutation.isPending ? 'Đang gửi...' : 'Gửi yêu cầu giải pháp'}</span>
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
