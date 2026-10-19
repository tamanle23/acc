import React, { useState } from 'react';
import { useTenantBilling } from '../../api/use-billing';
import { PayOsQrModal } from './payos-qr-modal';
import { Lock, Sparkles, Zap, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { usePermissions } from '@/features/spring-auth';

interface Props {
  featureKey: string;
  featureTitle: string;
  requiredTier?: 'PRO' | 'PRO_MAX';
  description?: string;
  children: React.ReactNode;
}

export const FeatureGate: React.FC<Props> = ({
  featureKey,
  featureTitle,
  requiredTier = 'PRO',
  description,
  children,
}) => {
  const { data: billing, isLoading } = useTenantBilling();
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const { isSovereignCustodian } = usePermissions();

  if (isSovereignCustodian) {
    return <>{children}</>;
  }

  // If loading, render children in defensive mode or loading state
  if (isLoading) {
    return <>{children}</>;
  }

  const entitledFeatures = billing?.entitledFeatures || [];
  const isEntitled = entitledFeatures.includes(featureKey);

  // If entitled, render transparently without scrim
  if (isEntitled) {
    return <>{children}</>;
  }

  // If NOT entitled, render Liquid Glass frosted teaser scrim over children
  return (
    <div className="relative w-full h-full min-h-[300px] overflow-hidden rounded-2xl">
      {/* Blurred / Obscured Underlying UI */}
      <div className="filter blur-md pointer-events-none select-none opacity-40 transition-all duration-300">
        {children}
      </div>

      {/* Floating Liquid Glass Teaser Card */}
      <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-950/20 backdrop-blur-xs z-20">
        <div className="max-w-md w-full p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-2xl shadow-blue-500/10 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-sm">
            <Lock className="h-6 w-6" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary uppercase">
                Yêu cầu gói {requiredTier}
              </Badge>
              <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-600/40 font-semibold text-[10px]">
                Tính năng Nâng cao
              </Badge>
            </div>
            <h3 className="text-base font-bold text-foreground">
              {featureTitle}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {description ||
                `Tính năng này chỉ dành riêng cho các tổ chức sử dụng gói ${requiredTier}. Mở khóa ngay hôm nay để quản trị kiến trúc dữ liệu không giới hạn.`}
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Button
              onClick={() => setIsQrModalOpen(true)}
              className="w-full text-xs font-semibold gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Nâng cấp ngay qua VietQR</span>
            </Button>
            <span className="text-[10px] text-muted-foreground">
              Kích hoạt tự động tức thì trong 0s • Hỗ trợ toàn bộ app ngân hàng
            </span>
          </div>
        </div>
      </div>

      {/* payOS VietQR Checkout Modal */}
      <PayOsQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        planTier={requiredTier}
        featureTitle={featureTitle}
      />
    </div>
  );
};
