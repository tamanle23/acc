import { describe, it, expect, beforeEach } from 'vitest';
import {
  useProfileStore,
  resolveTenantProfile,
  SOVEREIGN_PROFILE,
  type Profile,
} from '../profile-store';

describe('profile-store and tenant resolution', () => {
  beforeEach(() => {
    localStorage.clear();
    useProfileStore.getState().syncAssumedTenant(null);
  });

  describe('resolveTenantProfile', () => {
    it('resolves SYSTEM tenant to SOVEREIGN_PROFILE', () => {
      const { profile, allProfiles } = resolveTenantProfile('SYSTEM');
      expect(profile.id).toBe(SOVEREIGN_PROFILE.id);
      expect(profile.tenantId).toBe('SYSTEM');
      expect(allProfiles.some((p) => p.id === SOVEREIGN_PROFILE.id)).toBe(true);
    });

    it('resolves existing configured tenant (tenant-acme) from defaults', () => {
      const { profile, allProfiles } = resolveTenantProfile('tenant-acme', 'Acme Corp');
      expect(profile.tenantId).toBe('tenant-acme');
      expect(profile.name).toBe('Acme Prod');
      expect(allProfiles.length).toBeGreaterThanOrEqual(3);
    });

    it('synthesizes a delegated workspace for unconfigured tenant', () => {
      const { profile, allProfiles } = resolveTenantProfile('tenant-custom-99', 'Custom Logistics');
      expect(profile.id).toBe('ws-tenant-custom-99');
      expect(profile.name).toBe('Custom Logistics Workspace');
      expect(profile.plan).toBe('Default Workspace');
      expect(profile.tenantId).toBe('tenant-custom-99');
      expect(profile.tenantName).toBe('Custom Logistics');
      expect(profile.isDefault).toBe(true);
      expect(allProfiles.some((p) => p.id === 'ws-tenant-custom-99')).toBe(true);
    });

    it('resolves user personal default workspace if set in localStorage', () => {
      localStorage.setItem('unipost_user_default_ws_tenant-acme', 'ws-acme-staging');
      const { profile } = resolveTenantProfile('tenant-acme', 'Acme Corp');
      expect(profile.id).toBe('ws-acme-staging');
      expect(profile.name).toBe('Acme Staging');
    });
  });

  describe('syncAssumedTenant action', () => {
    it('switches currentProfile and updates profiles when assuming tenant', () => {
      useProfileStore.getState().syncAssumedTenant('tenant-acme', 'Acme Corp');
      const state = useProfileStore.getState();

      expect(state.currentProfile.tenantId).toBe('tenant-acme');
      expect(state.currentProfile.name).toBe('Acme Prod');
    });

    it('creates and activates a delegated profile for brand new fleet tenant', () => {
      useProfileStore.getState().syncAssumedTenant('tenant-custom-99', 'NorthStar Express');
      const state = useProfileStore.getState();

      expect(state.currentProfile.tenantId).toBe('tenant-custom-99');
      expect(state.currentProfile.name).toBe('NorthStar Express Workspace');
      expect(state.profiles.some((p) => p.tenantId === 'tenant-custom-99')).toBe(true);
    });

    it('cleanly restores default profile when syncAssumedTenant is called with null or SYSTEM', () => {
      useProfileStore.getState().syncAssumedTenant('tenant-custom-99', 'NorthStar Express');
      expect(useProfileStore.getState().currentProfile.tenantId).toBe('tenant-custom-99');

      useProfileStore.getState().syncAssumedTenant(null);
      const restored = useProfileStore.getState();
      expect(restored.currentProfile.id).toBe('ws-acme-prod');
      expect(restored.currentProfile.tenantId).toBe('tenant-acme');
    });
  });
});
