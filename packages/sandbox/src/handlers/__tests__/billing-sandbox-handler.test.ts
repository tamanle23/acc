import { describe, it, expect, beforeEach } from 'vitest';
import { billingSandboxHandler, billingSandboxRepo } from '../billing-sandbox-handler';
import { defaultSandboxStore } from '../../store';

describe('Billing Sandbox Handler Test Suite', () => {
  beforeEach(() => {
    billingSandboxRepo.reset();
    defaultSandboxStore.resetToDefaults();
  });

  const createCtx = (path: string, method: string = 'GET') => ({
    pathname: path,
    method,
    headers: {},
    searchParams: new URLSearchParams(),
    url: path,
  });

  describe('Route Matcher', () => {
    it('matches /api/v1/billing routes', () => {
      expect(billingSandboxHandler.matcher(createCtx('/api/v1/billing/summary'))).toBe(true);
      expect(billingSandboxHandler.matcher(createCtx('/api/billing/create-payment-link'))).toBe(true);
      expect(billingSandboxHandler.matcher(createCtx('/api/v1/billing/webhook-simulate'))).toBe(true);
      expect(billingSandboxHandler.matcher(createCtx('/api/v1/users'))).toBe(false);
    });
  });

  describe('GET /summary', () => {
    it('returns existing billing summary for pre-seeded tenant-acme', async () => {
      defaultSandboxStore.setActiveTenant('tenant-acme');
      const ctx = createCtx('/api/v1/billing/summary', 'GET');
      const req = { url: '/api/v1/billing/summary', method: 'GET', headers: {} };

      const res = await billingSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.tenantId).toBe('tenant-acme');
      expect(res?.data?.planTier).toBe('PRO');
      expect(res?.data?.entitledFeatures).toContain('FEATURE_SCHEMA_STUDIO');
      expect(res?.data?.history).toHaveLength(1);
    });

    it('returns enterprise sovereign summary for SYSTEM tenant', async () => {
      defaultSandboxStore.setActiveTenant('SYSTEM');
      const ctx = createCtx('/api/v1/billing/summary', 'GET');
      const req = { url: '/api/v1/billing/summary', method: 'GET', headers: {} };

      const res = await billingSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.tenantId).toBe('SYSTEM');
      expect(res?.data?.planTier).toBe('ENTERPRISE');
      expect(res?.data?.quotas?.maxWorkspaces).toBe(-1);
    });

    it('creates default BASIC summary for new unseeded tenant on the fly', async () => {
      defaultSandboxStore.setActiveTenant('tenant-new-corp');
      const ctx = createCtx('/api/v1/billing/summary', 'GET');
      const req = { url: '/api/v1/billing/summary', method: 'GET', headers: {} };

      const res = await billingSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.tenantId).toBe('tenant-new-corp');
      expect(res?.data?.planTier).toBe('BASIC');
      expect(res?.data?.entitledFeatures).toEqual(['FEATURE_METADATA_READ', 'FEATURE_RECORDS_CRUD']);
    });
  });

  describe('POST /create-payment-link', () => {
    it('generates VietQR code and PayOS payment link for PRO monthly', async () => {
      const ctx = createCtx('/api/v1/billing/create-payment-link', 'POST');
      const req = {
        url: '/api/v1/billing/create-payment-link',
        method: 'POST',
        headers: {},
        data: { planTier: 'PRO', cadence: 'MONTHLY' },
      };

      const res = await billingSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.amount).toBe(199000);
      expect(res?.data?.orderCode).toBeDefined();
      expect(res?.data?.qrCode).toContain('0002010102123854');
      expect(res?.data?.checkoutUrl).toContain('https://pay.payos.vn/web/');
      expect(res?.data?.status).toBe('PENDING');
    });

    it('generates VietQR code for PRO_MAX yearly', async () => {
      const ctx = createCtx('/api/v1/billing/create-payment-link', 'POST');
      const req = {
        url: '/api/v1/billing/create-payment-link',
        method: 'POST',
        headers: {},
        data: { planTier: 'PRO_MAX', cadence: 'YEARLY' },
      };

      const res = await billingSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.amount).toBe(3990000);
    });
  });

  describe('POST /contact-sales', () => {
    it('returns sales consultation confirmation', async () => {
      const ctx = createCtx('/api/v1/billing/contact-sales', 'POST');
      const req = { url: '/api/v1/billing/contact-sales', method: 'POST', headers: {} };

      const res = await billingSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.success).toBe(true);
      expect(res?.data?.message).toContain('Unipost Enterprise');
    });
  });

  describe('POST /webhook-simulate', () => {
    it('simulates PayOS webhook, upgrades tier, and adds to transaction history', async () => {
      defaultSandboxStore.setActiveTenant('tenant-acme');
      const ctx = createCtx('/api/v1/billing/webhook-simulate', 'POST');
      const req = {
        url: '/api/v1/billing/webhook-simulate',
        method: 'POST',
        headers: {},
        data: { orderCode: 998877, amount: 3990000, planTier: 'PRO_MAX' },
      };

      const res = await billingSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      expect(res?.data?.status).toBe('success');

      // Verify repository updated
      const updated = billingSandboxRepo.get('tenant-acme');
      expect(updated?.planTier).toBe('PRO_MAX');
      expect(updated?.billingCadence).toBe('YEARLY');
      expect(updated?.entitledFeatures).toContain('FEATURE_AI_AGENT_MCP');
      expect(updated?.history?.[0]?.orderCode).toBe(998877);
      expect(updated?.history?.[0]?.status).toBe('PAID');
    });

    it('upgrades to ENTERPRISE tier with enterprise feature entitlements', async () => {
      defaultSandboxStore.setActiveTenant('tenant-acme');
      const ctx = createCtx('/api/v1/billing/webhook-simulate', 'POST');
      const req = {
        url: '/api/v1/billing/webhook-simulate',
        method: 'POST',
        headers: {},
        data: { orderCode: 112233, amount: 15000000, planTier: 'ENTERPRISE' },
      };

      const res = await billingSandboxHandler.handler(req, ctx);
      expect(res?.status).toBe(200);
      const updated = billingSandboxRepo.get('tenant-acme');
      expect(updated?.planTier).toBe('ENTERPRISE');
      expect(updated?.entitledFeatures).toContain('FEATURE_ENTERPRISE_SLA');
    });

    it('returns null for unmatched sub-path', async () => {
      const ctx = createCtx('/api/v1/billing/unknown-subpath', 'GET');
      const req = { url: '/api/v1/billing/unknown-subpath', method: 'GET', headers: {} };
      const res = await billingSandboxHandler.handler(req, ctx);
      expect(res).toBeNull();
    });
  });
});
