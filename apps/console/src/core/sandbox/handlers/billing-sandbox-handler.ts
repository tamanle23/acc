import type { SandboxRouteHandler, SandboxRequest } from '../types';
import { useSandboxStore } from '../store/sandbox-store';

export type SandboxSubscriptionTier = 'BASIC' | 'PRO' | 'PRO_MAX' | 'ENTERPRISE';

export interface SandboxQuotaUsage {
  workspacesUsed: number;
  maxWorkspaces: number;
  schemasUsed: number;
  maxSchemas: number;
  recordsUsed: number;
  maxRecords: number;
}

export interface SandboxVatInvoiceInfo {
  companyName: string;
  taxCode: string;
  address: string;
  email: string;
  isAutoInvoice: boolean;
}

export interface SandboxBillingTransaction {
  orderCode: number;
  amount: number;
  planTier: SandboxSubscriptionTier;
  billingCadence: 'MONTHLY' | 'YEARLY';
  status: string;
  description: string;
  createdAt: string;
  paidAt?: string | null;
}

export interface TenantBillingRecord {
  tenantId: string;
  planTier: SandboxSubscriptionTier;
  billingCadence: 'MONTHLY' | 'YEARLY';
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  amountPaid: number;
  expiresAt: string | null;
  entitledFeatures: string[];
  quotas: SandboxQuotaUsage;
  vatInvoice: SandboxVatInvoiceInfo;
  history: SandboxBillingTransaction[];
}

const BASIC_FEATURES = ['FEATURE_METADATA_READ', 'FEATURE_RECORDS_CRUD'];
const PRO_FEATURES = [
  'FEATURE_METADATA_READ',
  'FEATURE_RECORDS_CRUD',
  'FEATURE_SCHEMA_STUDIO',
  'FEATURE_PATTERN_C_GRAPH',
  'FEATURE_DATA_EXPORT',
];
const PRO_MAX_FEATURES = [
  'FEATURE_METADATA_READ',
  'FEATURE_RECORDS_CRUD',
  'FEATURE_SCHEMA_STUDIO',
  'FEATURE_PATTERN_C_GRAPH',
  'FEATURE_DATA_EXPORT',
  'FEATURE_AI_AGENT_MCP',
  'FEATURE_STATE_MACHINE',
  'FEATURE_STREAMING_EXPORT',
];
const ENTERPRISE_FEATURES = [
  ...PRO_MAX_FEATURES,
  'FEATURE_DEDICATED_REPLICA',
  'FEATURE_ENTERPRISE_SLA',
  'FEATURE_SSO_SAML',
];

// In-memory tenant billing repository partitioned by tenantId
const mockBillingStore = new Map<string, TenantBillingRecord>();

// Seed SYSTEM root sovereign custodian with unlimited tier and all features
mockBillingStore.set('SYSTEM', {
  tenantId: 'SYSTEM',
  planTier: 'ENTERPRISE',
  billingCadence: 'YEARLY',
  status: 'ACTIVE',
  amountPaid: 0,
  expiresAt: null,
  entitledFeatures: [...ENTERPRISE_FEATURES],
  quotas: {
    workspacesUsed: 1,
    maxWorkspaces: -1,
    schemasUsed: 12,
    maxSchemas: -1,
    recordsUsed: 50000,
    maxRecords: -1,
  },
  vatInvoice: {
    companyName: 'Unipost Sovereign Platform Core',
    taxCode: '0000000000',
    address: 'Global Root Platform',
    email: 'root@unipost.vn',
    isAutoInvoice: true,
  },
  history: [],
});

// Seed commercial tenant tenant-acme with PRO features in sandbox for seamless testing
mockBillingStore.set('tenant-acme', {
  tenantId: 'tenant-acme',
  planTier: 'PRO',
  billingCadence: 'MONTHLY',
  status: 'ACTIVE',
  amountPaid: 199000,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  entitledFeatures: [...PRO_FEATURES],
  quotas: {
    workspacesUsed: 2,
    maxWorkspaces: 5,
    schemasUsed: 4,
    maxSchemas: -1,
    recordsUsed: 1450,
    maxRecords: -1,
  },
  vatInvoice: {
    companyName: 'Công ty Cổ phần Unipost Logistics',
    taxCode: '0109876543',
    address: 'Tòa nhà Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội',
    email: 'billing@unipost.vn',
    isAutoInvoice: true,
  },
  history: [
    {
      orderCode: 1712800000000,
      amount: 199000,
      planTier: 'PRO',
      billingCadence: 'MONTHLY',
      status: 'ACTIVE',
      description: 'Gói Pro (individual) Hàng tháng',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
});

export const billingSandboxHandler: SandboxRouteHandler = {
  id: 'billing-sandbox-handler',
  name: 'Billing & payOS Sandbox Handler',
  description: 'Simulates payOS VietQR payment links, webhooks, dynamic tenant feature entitlements, and quota telemetry',
  priority: 95,
  matcher: (ctx) =>
    ctx.pathname.startsWith('/api/v1/billing') ||
    ctx.pathname.startsWith('/api/billing'),
  handler: async (req: SandboxRequest, ctx) => {
    const { pathname } = ctx;
    const activeTenantId = useSandboxStore.getState().activeTenantId || 'tenant-acme';
    const subPath = pathname.replace(/^\/(api\/v1\/billing|api\/billing)/, '');

    // 1. GET /summary
    if (subPath === '/summary' || subPath === '/summary/') {
      if (req.method === 'GET') {
        let record = mockBillingStore.get(activeTenantId);
        if (!record) {
          record = {
            tenantId: activeTenantId,
            planTier: 'BASIC',
            billingCadence: 'MONTHLY',
            status: 'ACTIVE',
            amountPaid: 0,
            expiresAt: null,
            entitledFeatures: [...BASIC_FEATURES],
            quotas: {
              workspacesUsed: 1,
              maxWorkspaces: 1,
              schemasUsed: 2,
              maxSchemas: 5,
              recordsUsed: 420,
              maxRecords: -1,
            },
            vatInvoice: {
              companyName: 'Công ty Cổ phần ' + activeTenantId,
              taxCode: '0109998888',
              address: 'Hà Nội, Việt Nam',
              email: `billing@${activeTenantId}.vn`,
              isAutoInvoice: false,
            },
            history: [],
          };
          mockBillingStore.set(activeTenantId, record);
        }
        return { status: 200, data: record };
      }
    }

    // 2. POST /checkout
    if (subPath === '/checkout' || subPath === '/checkout/') {
      if (req.method === 'POST') {
        const { planTier = 'PRO', cadence = 'MONTHLY' } = req.data || {};
        const orderCode = Date.now();
        const amount =
          planTier === 'PRO_MAX'
            ? cadence === 'YEARLY'
              ? 4990000
              : 499000
            : cadence === 'YEARLY'
            ? 1990000
            : 199000;

        const description = `UNIPOST ${planTier} ${cadence}`;

        return {
          status: 200,
          data: {
            orderCode,
            amount,
            description,
            checkoutUrl: `https://pay.payos.vn/web/${orderCode}`,
            qrCode: `00020101021238540010A00000072701240006970422011003456789100208QRIBFTTA5204${amount}53037045802VN5912UNIPOST CORP6008HANOI62200804${description}6304`,
            status: 'PENDING',
          },
        };
      }
    }

    // 3. PUT /vat-invoice
    if (subPath === '/vat-invoice' || subPath === '/vat-invoice/') {
      if (req.method === 'PUT') {
        const vatData = req.data || {};
        const existing = mockBillingStore.get(activeTenantId);
        if (existing) {
          existing.vatInvoice = {
            ...existing.vatInvoice,
            ...vatData,
          };
        }
        return {
          status: 200,
          data: vatData,
        };
      }
    }

    // 4. POST /contact-sales
    if (subPath === '/contact-sales' || subPath === '/contact-sales/') {
      if (req.method === 'POST') {
        return {
          status: 200,
          data: 'Inquiry submitted successfully',
        };
      }
    }

    // 5. POST /payos/webhook
    if (subPath === '/payos/webhook' || subPath === '/payos/webhook/') {
      if (req.method === 'POST') {
        const data = req.data?.data || {};
        const amount = data.amount || 199000;
        const planTier: SandboxSubscriptionTier = amount >= 4990000 || amount === 499000 ? 'PRO_MAX' : 'PRO';

        const features =
          planTier === 'PRO_MAX'
            ? [...PRO_MAX_FEATURES]
            : [...PRO_FEATURES];

        const existing = mockBillingStore.get(activeTenantId);
        const newTransaction: SandboxBillingTransaction = {
          orderCode: data.orderCode || Date.now(),
          amount,
          planTier,
          billingCadence: amount >= 1000000 ? 'YEARLY' : 'MONTHLY',
          status: 'ACTIVE',
          description: data.description || `UNIPOST ${planTier} PAYMENT`,
          createdAt: new Date().toISOString(),
          paidAt: new Date().toISOString(),
        };

        const updatedHistory = existing ? [newTransaction, ...existing.history] : [newTransaction];

        mockBillingStore.set(activeTenantId, {
          tenantId: activeTenantId,
          planTier,
          billingCadence: amount >= 1000000 ? 'YEARLY' : 'MONTHLY',
          status: 'ACTIVE',
          amountPaid: amount,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          entitledFeatures: features,
          quotas: {
            workspacesUsed: existing?.quotas?.workspacesUsed || 1,
            maxWorkspaces: planTier === 'PRO_MAX' ? 15 : 5,
            schemasUsed: existing?.quotas?.schemasUsed || 3,
            maxSchemas: -1,
            recordsUsed: existing?.quotas?.recordsUsed || 1200,
            maxRecords: -1,
          },
          vatInvoice: existing?.vatInvoice || {
            companyName: 'Công ty Cổ phần ' + activeTenantId,
            taxCode: '0109998888',
            address: 'Hà Nội, Việt Nam',
            email: `billing@${activeTenantId}.vn`,
            isAutoInvoice: true,
          },
          history: updatedHistory,
        });

        return {
          status: 200,
          data: { status: 'success', message: 'Webhook simulated and entitlements granted' },
        };
      }
    }

    return { status: 404, data: { message: 'Not found' } };
  },
};
