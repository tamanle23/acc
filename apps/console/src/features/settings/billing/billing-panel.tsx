import React, { useState } from 'react';
import { ContentSection } from '../components/content-section';
import { useMetadataUiStore } from '@/features/metadata/store/use-metadata-ui-store';
import { useTenantBilling } from '@/features/metadata/api/use-billing';
import { CurrentSubscriptionCard } from './current-subscription-card';
import { PlanPricingSelector } from './plan-pricing-selector';
import { BillingHistoryTable } from './billing-history-table';
import { VatInvoiceForm } from './vat-invoice-form';
import { ContactEnterpriseModal } from './contact-enterprise-modal';
import { SandboxBillingDock } from './sandbox-billing-dock';
import { PayOsQrModal } from '@/features/metadata/components/billing/payos-qr-modal';

export const BillingPanel: React.FC = () => {
  const { activeTenantId, activeTenantName } = useMetadataUiStore();
  const { data: billing, isLoading } = useTenantBilling();

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'PRO' | 'PRO_MAX'>('PRO');
  const [selectedCadence, setSelectedCadence] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [isContactEnterpriseOpen, setIsContactEnterpriseOpen] = useState(false);

  const handleOpenUpgrade = (plan: 'PRO' | 'PRO_MAX', cadence: 'MONTHLY' | 'YEARLY') => {
    setSelectedPlan(plan);
    setSelectedCadence(cadence);
    setIsQrModalOpen(true);
  };

  return (
    <ContentSection
      title="Billing & Subscriptions"
      desc="Quản lý gói cước dịch vụ, định ngạch tài nguyên tiêu thụ, hóa đơn VAT và giao dịch payOS VietQR của Tổ chức."
    >
      <div className="space-y-8">
        {/* Active Subscription & Quota Gauges */}
        <CurrentSubscriptionCard
          billing={billing}
          tenantName={activeTenantName || 'Acme International Corp'}
        />

        {/* 4-Tier Plan Pricing Selector */}
        <PlanPricingSelector
          currentPlan={billing?.planTier || 'BASIC'}
          onUpgradePrompt={handleOpenUpgrade}
          onContactSales={() => setIsContactEnterpriseOpen(true)}
        />

        {/* payOS VietQR Transaction History */}
        <BillingHistoryTable transactions={billing?.history} />

        {/* Corporate VAT E-Invoice Form */}
        <VatInvoiceForm initialData={billing?.vatInvoice} />

        {/* Developer Sandbox Dock */}
        <SandboxBillingDock activeTenantId={activeTenantId || 'tenant-acme'} />

        {/* payOS Dynamic VietQR Modal */}
        <PayOsQrModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          planTier={selectedPlan}
          cadence={selectedCadence}
          featureTitle={`Nâng cấp gói ${selectedPlan}`}
        />

        {/* Enterprise Inquiry Modal */}
        <ContactEnterpriseModal
          isOpen={isContactEnterpriseOpen}
          onClose={() => setIsContactEnterpriseOpen(false)}
          tenantName={activeTenantName || 'Acme International Corp'}
        />
      </div>
    </ContentSection>
  );
};
