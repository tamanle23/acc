import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubscriptionTier } from '@/features/metadata/api/use-billing';

interface Props {
  currentPlan: SubscriptionTier;
  onUpgradePrompt: (tier: 'PRO' | 'PRO_MAX', cadence: 'MONTHLY' | 'YEARLY') => void;
  onContactSales: () => void;
}

export const PlanPricingSelector: React.FC<Props> = ({
  currentPlan,
  onUpgradePrompt,
  onContactSales,
}) => {
  const [cadence, setCadence] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Chọn gói cước nâng cấp hoặc thay đổi
          </h3>
          <p className="text-xs text-muted-foreground">
            Linh hoạt nâng cấp tức thì qua payOS VietQR hoặc liên hệ cho quy mô tổ chức lớn.
          </p>
        </div>

        {/* Cadence Switcher */}
        <div className="p-1 rounded-2xl bg-white/50 dark:bg-slate-900/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-sm flex items-center">
          <button
            type="button"
            onClick={() => setCadence('MONTHLY')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all',
              cadence === 'MONTHLY'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Hàng tháng (Monthly)
          </button>
          <button
            type="button"
            onClick={() => setCadence('YEARLY')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5',
              cadence === 'YEARLY'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>Hàng năm (Yearly)</span>
            <Badge variant="secondary" className="text-[9px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none px-1.5">
              -20%
            </Badge>
          </button>
        </div>
      </div>

      {/* 4-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {/* Tier 1: Basic (individual) */}
        <div
          className={cn(
            'p-5 rounded-3xl backdrop-blur-2xl border transition-all flex flex-col justify-between',
            currentPlan === 'BASIC'
              ? 'bg-blue-500/10 border-blue-500/50 shadow-md ring-1 ring-blue-500/30'
              : 'bg-white/40 dark:bg-white/5 border-white/20'
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-foreground">🆓 Basic (individual)</span>
              {currentPlan === 'BASIC' && (
                <Badge className="text-[9px] font-mono bg-blue-500/15 text-blue-600 border border-blue-500/30">
                  Gói Hiện Tại
                </Badge>
              )}
            </div>
            <div className="mb-3">
              <div className="text-2xl font-black text-foreground">Miễn phí</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Không giới hạn thời gian</div>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">
              Dành cho cá nhân bắt đầu tìm hiểu mô hình dữ liệu động.
            </p>

            <ul className="space-y-2 text-xs text-muted-foreground border-t border-white/10 pt-4">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>1 Workspace cá nhân</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>5 Entity Schemas</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Records CRUD chuẩn</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Cộng đồng hỗ trợ</span>
              </li>
            </ul>
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={currentPlan === 'BASIC'}
            className="w-full mt-6 text-xs font-semibold"
          >
            {currentPlan === 'BASIC' ? 'Đang sử dụng' : 'Chuyển về Basic'}
          </Button>
        </div>

        {/* Tier 2: Pro (individual) */}
        <div
          className={cn(
            'p-5 rounded-3xl backdrop-blur-2xl border transition-all flex flex-col justify-between relative',
            currentPlan === 'PRO'
              ? 'bg-blue-500/15 border-blue-500/60 shadow-lg ring-2 ring-blue-500/40'
              : 'bg-white/40 dark:bg-white/5 border-white/20 hover:border-blue-500/40'
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">⚡ Pro (individual)</span>
              {currentPlan === 'PRO' ? (
                <Badge className="text-[9px] font-mono bg-blue-500/20 text-blue-600 border border-blue-500/30">
                  Gói Hiện Tại
                </Badge>
              ) : (
                <Badge className="text-[9px] font-mono bg-blue-500/10 text-blue-600 border-none">
                  Phổ biến
                </Badge>
              )}
            </div>
            <div className="mb-3">
              <div className="text-2xl font-black text-foreground">
                {cadence === 'MONTHLY' ? '199,000 ₫' : '1,990,000 ₫'}
                <span className="text-xs font-normal text-muted-foreground ms-1">
                  /{cadence === 'MONTHLY' ? 'tháng' : 'năm'}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {cadence === 'YEARLY' ? 'Tiết kiệm 398,000 ₫' : 'Thanh toán theo tháng'}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">
              Dành cho lập trình viên và chuyên gia mô hình hóa thực thể.
            </p>

            <ul className="space-y-2 text-xs text-muted-foreground border-t border-white/10 pt-4">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="font-semibold text-foreground">5 Workspaces độc lập</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="font-semibold text-foreground">Schema Architect Studio</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Pattern C Entity Graph</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Xuất dữ liệu & Sao lưu</span>
              </li>
            </ul>
          </div>

          <Button
            size="sm"
            disabled={currentPlan === 'PRO'}
            onClick={() => onUpgradePrompt('PRO', cadence)}
            className={cn(
              'w-full mt-6 text-xs font-bold shadow-sm',
              currentPlan === 'PRO'
                ? 'bg-muted text-muted-foreground'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
            )}
          >
            {currentPlan === 'PRO' ? 'Đang sử dụng' : 'Nâng cấp qua VietQR'}
          </Button>
        </div>

        {/* Tier 3: Pro Max (individual) */}
        <div
          className={cn(
            'p-5 rounded-3xl backdrop-blur-2xl border transition-all flex flex-col justify-between',
            currentPlan === 'PRO_MAX'
              ? 'bg-purple-500/15 border-purple-500/60 shadow-lg ring-2 ring-purple-500/40'
              : 'bg-white/40 dark:bg-white/5 border-white/20 hover:border-purple-500/40'
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">👑 Pro Max (individual)</span>
              {currentPlan === 'PRO_MAX' && (
                <Badge className="text-[9px] font-mono bg-purple-500/20 text-purple-600 border border-purple-500/30">
                  Gói Hiện Tại
                </Badge>
              )}
            </div>
            <div className="mb-3">
              <div className="text-2xl font-black text-foreground">
                {cadence === 'MONTHLY' ? '499,000 ₫' : '4,990,000 ₫'}
                <span className="text-xs font-normal text-muted-foreground ms-1">
                  /{cadence === 'MONTHLY' ? 'tháng' : 'năm'}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {cadence === 'YEARLY' ? 'Tiết kiệm 998,000 ₫' : 'Toàn quyền cá nhân'}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">
              Dành cho power users cần AI Agent MCP Server và streaming export.
            </p>

            <ul className="space-y-2 text-xs text-muted-foreground border-t border-white/10 pt-4">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="font-semibold text-foreground">15 Workspaces môi trường</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="font-semibold text-foreground">AI Agent MCP Protocol</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>State Machine Engine</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>GDPR Streaming Export</span>
              </li>
            </ul>
          </div>

          <Button
            size="sm"
            disabled={currentPlan === 'PRO_MAX'}
            onClick={() => onUpgradePrompt('PRO_MAX', cadence)}
            className={cn(
              'w-full mt-6 text-xs font-bold shadow-sm',
              currentPlan === 'PRO_MAX'
                ? 'bg-muted text-muted-foreground'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
            )}
          >
            {currentPlan === 'PRO_MAX' ? 'Đang sử dụng' : 'Nâng cấp Pro Max'}
          </Button>
        </div>

        {/* Tier 4: Enterprise (organization) */}
        <div
          className={cn(
            'p-5 rounded-3xl backdrop-blur-2xl border transition-all flex flex-col justify-between',
            currentPlan === 'ENTERPRISE'
              ? 'bg-amber-500/15 border-amber-500/60 shadow-lg ring-2 ring-amber-500/40'
              : 'bg-white/40 dark:bg-white/5 border-white/20 hover:border-amber-500/40'
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">🏢 Enterprise (organization)</span>
              {currentPlan === 'ENTERPRISE' && (
                <Badge className="text-[9px] font-mono bg-amber-500/20 text-amber-600 border border-amber-500/30">
                  Gói Hiện Tại
                </Badge>
              )}
            </div>
            <div className="mb-3">
              <div className="text-2xl font-black text-foreground">Báo giá riêng</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Tùy chỉnh theo quy mô</div>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">
              Hạ tầng chuyên dụng cho doanh nghiệp lớn và tổ chức tập trung.
            </p>

            <ul className="space-y-2 text-xs text-muted-foreground border-t border-white/10 pt-4">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="font-semibold text-foreground">Không giới hạn Workspaces</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Dedicated DB Replica</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Cam kết SLA 99.99%</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>SSO/SAML & Hóa đơn GTGT</span>
              </li>
            </ul>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={onContactSales}
            className="w-full mt-6 text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
          >
            <Building2 className="w-3.5 h-3.5 me-1.5" />
            <span>Liên hệ Doanh nghiệp</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
