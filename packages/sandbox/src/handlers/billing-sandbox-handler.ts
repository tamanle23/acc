import type { SandboxRouteHandler, SandboxRequest } from '../types';
import { defaultSandboxStore } from '../store';
import { sandboxResetRegistry } from '../reset-registry';
import type {
  SubscriptionTier,
  TenantBillingSummary,
  BillingTransaction,
  QuotaUsage,
  VatInvoiceInfo,
} from '@acc/client';

export type SandboxSubscriptionTier = SubscriptionTier;
export type SandboxQuotaUsage = QuotaUsage;
export type SandboxVatInvoiceInfo = VatInvoiceInfo;
export type SandboxBillingTransaction = BillingTransaction;
export type TenantBillingRecord = TenantBillingSummary;

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

export class BillingSandboxRepository {
  private store: Map<string, TenantBillingSummary> = new Map();

  constructor() {
    this.reset();
    sandboxResetRegistry.register(() => this.reset());
  }

  public reset(): void {
    this.store.clear();
    this.store.set('SYSTEM', {
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
        email: 'root@acc.vn',
        isAutoInvoice: true,
      },
      history: [],
    });

    this.store.set('tenant-acme', {
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
        email: 'billing@acc.vn',
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
  }

  public get(tenantId: string): TenantBillingSummary | undefined {
    return this.store.get(tenantId);
  }

  public set(tenantId: string, record: TenantBillingSummary): void {
    this.store.set(tenantId, record);
  }
}

export const billingSandboxRepo = new BillingSandboxRepository();

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
    const activeTenantId = defaultSandboxStore.getState().activeTenantId || 'tenant-acme';
    const subPath = pathname.replace(/^\/(api\/v1\/billing|api\/billing)/, '');

    // 1. GET /summary
    if (subPath === '/summary' || subPath === '/summary/') {
      if (req.method === 'GET') {
        let record = billingSandboxRepo.get(activeTenantId);
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
          billingSandboxRepo.set(activeTenantId, record);
        }
        return { status: 200, data: record };
      }
    }

    // 2. POST /create-payment-link or /checkout
    if ((subPath === '/create-payment-link' || subPath === '/checkout') && req.method === 'POST') {
      const { planTier = 'PRO', cadence = 'MONTHLY' } = req.data || {};
      const orderCode = Date.now();
      const amount =
        planTier === 'PRO_MAX'
          ? cadence === 'YEARLY'
            ? 3990000
            : 399000
          : cadence === 'YEARLY'
            ? 1990000
            : 199000;

      const desc = `Thanh toán ${planTier} (${cadence === 'YEARLY' ? '12 tháng' : '1 tháng'})`;
      const dummyCheckoutUrl = `https://pay.payos.vn/web/${orderCode}`;
      const dummyQr = `00020101021238540010A00000072701240006970422011001098765430208QRIBFTTA5303704540${amount}5802VN62150811${orderCode}6304`;

      return {
        status: 200,
        data: {
          orderCode,
          amount,
          description: desc,
          checkoutUrl: dummyCheckoutUrl,
          qrCode: dummyQr,
          status: 'PENDING',
        },
      };
    }

    // 3. POST /contact-sales
    if (subPath === '/contact-sales' && req.method === 'POST') {
      return {
        status: 200,
        data: {
          success: true,
          message: 'Cảm ơn bạn! Đội ngũ Unipost Enterprise sẽ liên hệ lại trong vòng 2 giờ làm việc.',
        },
      };
    }

    // 4. POST /webhook-simulate or /payos/webhook
    if ((subPath === '/webhook-simulate' || subPath === '/payos/webhook') && req.method === 'POST') {
      const payload = req.data?.data || req.data || {};
      const { orderCode, amount = 199000, planTier = 'PRO' } = payload;
      const existing = billingSandboxRepo.get(activeTenantId);

      const features =
        planTier === 'PRO_MAX'
          ? [...PRO_MAX_FEATURES]
          : planTier === 'ENTERPRISE'
            ? [...ENTERPRISE_FEATURES]
            : [...PRO_FEATURES];

      const newTransaction: BillingTransaction = {
        orderCode: Number(orderCode) || Date.now(),
        amount,
        planTier,
        billingCadence: amount >= 1000000 ? 'YEARLY' : 'MONTHLY',
        status: 'PAID',
        description: `Thanh toán thành công ${planTier}`,
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
      };

      const updatedHistory = existing?.history ? [newTransaction, ...existing.history] : [newTransaction];

      billingSandboxRepo.set(activeTenantId, {
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

    return null;
  },
};
