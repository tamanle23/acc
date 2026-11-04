import { springApiClient } from '@/features/spring-auth/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMetadataUiStore } from '../store/use-metadata-ui-store';
import { useSpringAuthStore } from '@/features/spring-auth';
import { useHasPermission } from '@/features/system/hooks/use-has-permission';
import type {
  SubscriptionTier,
  QuotaUsage,
  VatInvoiceInfo,
  BillingTransaction,
  TenantBillingSummary,
  CreatePaymentLinkPayload,
  CheckoutResponse,
} from '@acc/client';

export type {
  SubscriptionTier,
  QuotaUsage,
  VatInvoiceInfo,
  BillingTransaction,
  TenantBillingSummary,
  CreatePaymentLinkPayload,
  CheckoutResponse,
};

export interface ContactSalesPayload {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  seatCount?: number;
  requirements?: string;
}

/**
 * Fetch billing & active feature tokens for the active tenant
 */
export function useTenantBilling() {
  const activeTenantId = useMetadataUiStore((s) => s.activeTenantId);
  const isAuthenticated = useSpringAuthStore((s) => s.isAuthenticated);
  const canReadBilling = useHasPermission('billing:subscription:read');

  return useQuery<TenantBillingSummary>({
    queryKey: ['billing-summary', activeTenantId],
    queryFn: async () => {
      const res = await springApiClient.get('/v1/billing/summary');
      return res.data?.data || res.data;
    },
    enabled: Boolean(isAuthenticated && activeTenantId && canReadBilling),
    retry: false, // Fail fast on 401/403/429; do not spam or loop requests
    staleTime: 1000 * 60 * 5, // 5 mins
  });
}

/**
 * Create payOS VietQR payment link
 */
export function useCreatePaymentLink() {
  const queryClient = useQueryClient();
  const activeTenantId = useMetadataUiStore((s) => s.activeTenantId);

  return useMutation<CheckoutResponse, Error, CreatePaymentLinkPayload>({
    mutationFn: async (payload) => {
      const res = await springApiClient.post('/v1/billing/checkout', payload);
      return res.data?.data || res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-summary', activeTenantId] });
    },
  });
}

/**
 * Update VAT E-Invoice information
 */
export function useUpdateVatInvoice() {
  const queryClient = useQueryClient();
  const activeTenantId = useMetadataUiStore((s) => s.activeTenantId);

  return useMutation<VatInvoiceInfo, Error, VatInvoiceInfo>({
    mutationFn: async (payload) => {
      const res = await springApiClient.put('/v1/billing/vat-invoice', payload);
      return res.data?.data || res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-summary', activeTenantId] });
    },
  });
}

/**
 * Submit Enterprise Contact Sales Inquiry
 */
export function useContactEnterpriseSales() {
  return useMutation<string, Error, ContactSalesPayload>({
    mutationFn: async (payload) => {
      const res = await springApiClient.post('/v1/billing/contact-sales', payload);
      return res.data?.data || res.data;
    },
  });
}

/**
 * Simulate Webhook Payment confirmation (for sandbox / dev testing)
 */
export function useSimulatePaymentWebhook() {
  const queryClient = useQueryClient();
  const activeTenantId = useMetadataUiStore((s) => s.activeTenantId);

  return useMutation<boolean, Error, { orderCode: number; amount: number; planTier: string }>({
    mutationFn: async ({ orderCode, amount, planTier }) => {
      const res = await springApiClient.post('/v1/billing/payos/webhook', {
        code: '00',
        desc: 'Success',
        signature: 'mock_signature_ok',
        data: {
          orderCode,
          amount,
          description: `UNIPOST ${planTier} PAYMENT`,
        },
      });
      return res.data?.status === 'success';
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-summary', activeTenantId] });
      queryClient.invalidateQueries({ queryKey: ['entity-types'] });
    },
  });
}

