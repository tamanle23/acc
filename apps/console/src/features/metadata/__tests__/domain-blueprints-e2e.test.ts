import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { mockMetadataStore } from '@/features/metadata/data/mock-metadata';
import { useMetadataUiStore } from '@/features/metadata/store/use-metadata-ui-store';
import { mockBlueprintSummaries, mockBlueprintManifests } from '@/features/metadata/data/mock-blueprints';
import { billingSandboxHandler } from '@/core/sandbox/handlers/billing-sandbox-handler';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';

describe('Multi-Tenant & Domain Blueprints Full E2E Integration Suite', () => {
  const TENANT_E2E = 'tenant-acme-corp';

  beforeEach(() => {
    mockMetadataStore.resetToInitialState();
    useMetadataUiStore.getState().setActiveTenant('tenant-acme', 'Acme Corp');
    useMetadataUiStore.getState().setActiveWorkspace('ws-acme-prod', 'Acme Prod');
    useSandboxStore.getState().setActiveTenant(TENANT_E2E);
  });

  describe('Flow 1: Public Acquisition -> Blueprint Selection -> Provisioning', () => {
    it('should query available blueprint catalog and detail manifests without authentication requirement', async () => {
      expect(mockBlueprintSummaries.length).toBeGreaterThanOrEqual(4);

      const cmsSummary = mockBlueprintSummaries.find((b) => b.id === 'bp_cms_publishing_v1');
      expect(cmsSummary).toBeDefined();
      expect(cmsSummary?.name).toBe('Headless CMS & Digital Publishing');
      expect(cmsSummary?.entityTypesCount).toBe(3);

      const cmsManifest = mockBlueprintManifests.find((b) => b.id === 'bp_cms_publishing_v1');
      expect(cmsManifest).toBeDefined();
      expect(cmsManifest?.entityTypes.length).toBe(3);
      expect(cmsManifest?.relationshipTypes.length).toBe(2);
    });

    it('should provision a new tenant with Headless CMS blueprint into data store with tenant isolation', async () => {
      const manifest = mockBlueprintManifests.find((b) => b.id === 'bp_cms_publishing_v1')!;

      // Simulate tenant provisioning
      for (const bType of manifest.entityTypes) {
        await mockMetadataStore.createEntityType({
          name: bType.name,
          systemName: bType.systemName,
          description: bType.description,
        });
      }

      const entityTypes = await mockMetadataStore.getEntityTypes({ search: 'ent_cms', size: 10 });
      expect(entityTypes.content.some((e) => e.systemName === 'ent_cms_article')).toBe(true);
      expect(entityTypes.content.some((e) => e.systemName === 'ent_cms_category')).toBe(true);
      expect(entityTypes.content.some((e) => e.systemName === 'ent_cms_media_asset')).toBe(true);
    });
  });

  describe('Flow 2: Tenant & Workspace Domain Hierarchy Isolation', () => {
    it('should isolate active workspace from active tenant without overwriting organizational boundary', () => {
      const store = useMetadataUiStore.getState();

      store.setActiveTenant('tenant-acme-global', 'Acme Global Logistics');
      store.setActiveWorkspace('ws-fleet-south', 'Kho Vận Miền Nam');

      const updated = useMetadataUiStore.getState();
      expect(updated.activeTenantId).toBe('tenant-acme-global');
      expect(updated.activeTenantName).toBe('Acme Global Logistics');
      expect(updated.activeWorkspaceId).toBe('ws-fleet-south');
      expect(updated.activeWorkspaceName).toBe('Kho Vận Miền Nam');

      // Switch sub-workspace under same tenant
      store.setActiveWorkspace('ws-fleet-north', 'Kho Vận Miền Bắc');
      const switched = useMetadataUiStore.getState();
      expect(switched.activeTenantId).toBe('tenant-acme-global'); // Tenant unchanged!
      expect(switched.activeWorkspaceId).toBe('ws-fleet-north');
    });
  });

  describe('Flow 3: FinOps, payOS VietQR & Dynamic Feature Gating Lifecycle', () => {
    it('should return default basic tier with restricted features for fresh tenants', async () => {
      const res = await billingSandboxHandler.handler(
        { method: 'GET', url: '/api/v1/billing/summary' },
        { pathname: '/api/v1/billing/summary', searchParams: new URLSearchParams() }
      );

      expect(res).not.toBeNull();
      expect(res?.status).toBe(200);
      expect(res?.data.planTier).toBe('BASIC');
      expect(res?.data.entitledFeatures).toContain('FEATURE_METADATA_READ');
      expect(res?.data.entitledFeatures).not.toContain('FEATURE_PATTERN_C_GRAPH');
    });

    it('should generate payOS checkout link with dynamic VietQR code for upgrading to Pro', async () => {
      const res = await billingSandboxHandler.handler(
        {
          method: 'POST',
          url: '/api/v1/billing/checkout',
          data: { planTier: 'PRO', cadence: 'MONTHLY' },
        },
        { pathname: '/api/v1/billing/checkout', searchParams: new URLSearchParams() }
      );

      expect(res).not.toBeNull();
      expect(res?.status).toBe(200);
      expect(res?.data.orderCode).toBeDefined();
      expect(res?.data.amount).toBe(199000);
      expect(res?.data.qrCode).toContain('00020101021238540010A000000727');
      expect(res?.data.checkoutUrl).toContain('https://pay.payos.vn/web/');
    });

    it('should unlock premium features and elevate tenant status upon receiving valid payOS webhook', async () => {
      const orderCode = Date.now();

      // 1. Trigger payment webhook simulation
      const webhookRes = await billingSandboxHandler.handler(
        {
          method: 'POST',
          url: '/api/v1/billing/payos/webhook',
          data: {
            code: '00',
            data: {
              orderCode,
              amount: 199000,
            },
          },
        },
        { pathname: '/api/v1/billing/payos/webhook', searchParams: new URLSearchParams() }
      );

      expect(webhookRes?.status).toBe(200);
      expect(webhookRes?.data.status).toBe('success');

      // 2. Fetch updated billing summary
      const summaryRes = await billingSandboxHandler.handler(
        { method: 'GET', url: '/api/v1/billing/summary' },
        { pathname: '/api/v1/billing/summary', searchParams: new URLSearchParams() }
      );

      expect(summaryRes?.data.planTier).toBe('PRO');
      expect(summaryRes?.data.status).toBe('ACTIVE');
      expect(summaryRes?.data.amountPaid).toBe(199000);
      expect(summaryRes?.data.entitledFeatures).toContain('FEATURE_SCHEMA_STUDIO');
      expect(summaryRes?.data.entitledFeatures).toContain('FEATURE_PATTERN_C_GRAPH');
      expect(summaryRes?.data.entitledFeatures).toContain('FEATURE_DATA_EXPORT');
    });
  });
});
