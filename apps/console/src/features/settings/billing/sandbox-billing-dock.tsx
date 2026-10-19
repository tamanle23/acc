import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Terminal, Zap } from 'lucide-react';
import { useSimulatePaymentWebhook } from '@/features/metadata/api/use-billing';
import { toast } from 'sonner';

interface Props {
  activeTenantId: string;
}

export const SandboxBillingDock: React.FC<Props> = ({ activeTenantId }) => {
  if (!import.meta.env.DEV) return null;

  const simulateMutation = useSimulatePaymentWebhook();

  const handleSimulatePayment = (planTier: 'PRO' | 'PRO_MAX') => {
    const orderCode = Date.now();
    const amount = planTier === 'PRO_MAX' ? 4990000 : 1990000;

    simulateMutation.mutate(
      {
        orderCode,
        amount,
        planTier,
      },
      {
        onSuccess: () => {
          toast.success(`Sandbox Webhook kích hoạt thành công: Gói ${planTier} đã unlock toàn bộ quyền lợi.`);
        },
      }
    );
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 border border-slate-700/60 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            Unified Sandbox FinOps Simulator
          </span>
          <Badge variant="outline" className="text-[9px] font-mono border-slate-700 text-slate-400">
            Tenant: {activeTenantId}
          </Badge>
        </div>
        <span className="text-[10px] text-slate-400">DEV MODE ONLY</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleSimulatePayment('PRO')}
          disabled={simulateMutation.isPending}
          className="h-7 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 gap-1.5"
        >
          <Zap className="h-3 w-3 text-blue-400" />
          <span>Mô phỏng VietQR: Nâng cấp PRO (0s)</span>
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleSimulatePayment('PRO_MAX')}
          disabled={simulateMutation.isPending}
          className="h-7 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 gap-1.5"
        >
          <Zap className="h-3 w-3 text-purple-400" />
          <span>Mô phỏng VietQR: Nâng cấp PRO MAX (0s)</span>
        </Button>
      </div>
    </div>
  );
};
