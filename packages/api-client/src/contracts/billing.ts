// ==========================================
// Billing, Subscriptions & Quotas Contracts
// ==========================================

export type SubscriptionTier = 'BASIC' | 'PRO' | 'PRO_MAX' | 'ENTERPRISE';

export interface QuotaUsage {
  workspacesUsed: number;
  maxWorkspaces: number; // -1 for unlimited
  schemasUsed: number;
  maxSchemas: number; // -1 for unlimited
  recordsUsed: number;
  maxRecords: number; // -1 for unlimited
}

export interface VatInvoiceInfo {
  companyName: string;
  taxCode: string;
  address: string;
  email: string;
  isAutoInvoice: boolean;
}

export interface BillingTransaction {
  orderCode: number;
  amount: number;
  planTier: SubscriptionTier;
  billingCadence: 'MONTHLY' | 'YEARLY';
  status: string;
  description: string;
  createdAt: string;
  paidAt?: string | null;
}

export interface TenantBillingSummary {
  tenantId: string;
  planTier: SubscriptionTier;
  billingCadence: 'MONTHLY' | 'YEARLY';
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  amountPaid: number;
  expiresAt: string | null;
  entitledFeatures: string[];
  quotas?: QuotaUsage;
  vatInvoice?: VatInvoiceInfo;
  history?: BillingTransaction[];
}

export interface CreatePaymentLinkPayload {
  planTier: 'PRO' | 'PRO_MAX';
  cadence: 'MONTHLY' | 'YEARLY';
  returnUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResponse {
  orderCode: number;
  amount: number;
  description: string;
  checkoutUrl: string;
  qrCode: string;
  status: string;
}

export interface ContactSalesPayload {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  seatCount?: number;
  requirements?: string;
}
