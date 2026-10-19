import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCreatePaymentLink, useSimulatePaymentWebhook } from '../../api/use-billing';
import {
  QrCode,
  CheckCircle2,
  Copy,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  planTier: 'PRO' | 'PRO_MAX';
  cadence?: 'MONTHLY' | 'YEARLY';
  featureTitle?: string;
  onSuccess?: () => void;
  children?: React.ReactNode;
}

export const PayOsQrModal: React.FC<Props> = ({
  isOpen,
  onClose,
  planTier,
  cadence = 'MONTHLY',
  featureTitle,
  onSuccess,
}) => {
  const [selectedCadence, setSelectedCadence] = useState<'MONTHLY' | 'YEARLY'>(cadence);
  const [isSuccess, setIsSuccess] = useState(false);

  const createPaymentMutation = useCreatePaymentLink();
  const simulatePaymentMutation = useSimulatePaymentWebhook();

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      setSelectedCadence(cadence);
      createPaymentMutation.mutate({
        planTier,
        cadence,
      });
    }
  }, [isOpen, planTier, cadence]);

  const checkoutData = createPaymentMutation.data;
  const isGenerating = createPaymentMutation.isPending;

  const handleSimulatePayment = async () => {
    if (!checkoutData) return;

    try {
      await simulatePaymentMutation.mutateAsync({
        orderCode: checkoutData.orderCode,
        amount: checkoutData.amount,
        planTier,
      });
      setIsSuccess(true);
      toast.success(`Nâng cấp gói ${planTier} thành công! Toàn bộ tính năng đã được mở khóa.`);
      if (onSuccess) onSuccess();
    } catch {
      toast.error('Xác nhận thanh toán thất bại, vui lòng thử lại');
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-white/20 dark:border-white/10 shadow-2xl rounded-3xl">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground font-mono text-[10px]">
                payOS VietQR
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                Napas247 0s Instant
              </Badge>
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Gói {planTier}
            </span>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground mt-2 flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <span>Thanh toán Quét mã VietQR</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {featureTitle
              ? `Mở khóa tính năng "${featureTitle}" và toàn bộ đặc quyền gói ${planTier}.`
              : `Nâng cấp gói ${planTier} với chu kỳ thanh toán ${selectedCadence === 'YEARLY' ? 'Hàng năm (-20%)' : 'Hàng tháng'}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-4 space-y-4">
          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center border border-emerald-500/30 shadow-lg">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Thanh Toán Hoàn Tất!
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Hệ thống đã nhận diện giao dịch thành công. Quyền hạn tính năng của tổ chức bạn đã được cập nhật tức thì.
              </p>
              <Button onClick={onClose} className="w-full text-xs font-semibold">
                Bắt đầu sử dụng ngay
              </Button>
            </div>
          ) : isGenerating ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                Đang tạo mã VietQR thanh toán tự động qua payOS...
              </p>
            </div>
          ) : checkoutData ? (
            <>
              {/* Dynamic QR Display Card */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-border/50 shadow-inner flex flex-col items-center justify-center">
                <div className="relative p-3 rounded-xl bg-white border border-slate-200 shadow-md">
                  {/* Generated QR Code preview with fallback vector illustration */}
                  <div className="w-48 h-48 bg-slate-50 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-2 text-center relative overflow-hidden">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                        checkoutData.checkoutUrl
                      )}`}
                      alt="VietQR payOS"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <span className="text-xs text-muted-foreground">Số tiền thanh toán:</span>
                  <div className="text-xl font-black text-foreground text-primary">
                    {checkoutData.amount.toLocaleString()} VND
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Nội dung CK: {checkoutData.description}
                  </span>
                </div>
              </div>

              {/* Order Information Breakdown */}
              <div className="space-y-2 text-xs bg-muted/30 p-3 rounded-xl border border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mã đơn hàng:</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span>{checkoutData.orderCode}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(String(checkoutData.orderCode), 'mã đơn hàng')}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cổng thanh toán:</span>
                  <span className="font-semibold text-foreground">payOS (VietQR / Napas247)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Thời gian kích hoạt:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tức thì (0s Webhook)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <Button
                  onClick={handleSimulatePayment}
                  disabled={simulatePaymentMutation.isPending}
                  className="w-full text-xs font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                >
                  {simulatePaymentMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>Xác nhận đã chuyển khoản (Mô phỏng Webhook 0s)</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.open(checkoutData.checkoutUrl, '_blank')}
                    className="flex-1 text-xs gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Mở cổng payOS</span>
                  </Button>
                  <Button variant="ghost" onClick={onClose} className="text-xs">
                    Đóng
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Không thể tạo liên kết thanh toán. Vui lòng thử lại.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
