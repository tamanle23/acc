import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { defaultSandboxStore } from '@acc/sandbox';
import type { SandboxPersona, SandboxPersonaId, SandboxState } from '../types';

export const DEFAULT_SANDBOX_PERSONAS: Record<SandboxPersonaId, SandboxPersona> = {
  system: {
    id: 'system',
    name: 'Sovereign Root Custodian (Me)',
    username: 'custodian@system',
    aliases: ['custodian@system', 'custodian_root', 'system', 'sovereign-custodian@acc.io', 'system-custodian', 'system_bypass'],
    defaultTenantId: 'SYSTEM',
    actorTenantId: 'SYSTEM',
    uid: 'usr_sandbox_custodian_001',
    roles: ['ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
    description: 'Ultimate sovereign authority across all tenants, fleet operations, unconstrained quotas, and RBAC matrix',
    permissions: [
      'platform:fleet:read', 'platform:fleet:mutate', 'platform:fleet:trip_circuit', 'platform:tenant:assume',
      'platform:tenant:purge', 'platform:quotas:manage', 'platform:roles:manage', 'platform:users:manage',
      'platform:dlq:manage', 'platform:workers:manage', 'metadata:schema:read', 'metadata:schema:write',
      'metadata:blueprint:package', 'metadata:blueprint:provision', 'metadata:cache:evict',
      'entity:record:read', 'entity:record:create', 'entity:record:update', 'entity:record:delete', 'entity:record:export',
      'workspace:settings:read', 'workspace:settings:manage', 'workspace:members:read', 'workspace:members:manage',
      'workflow:definition:read', 'workflow:definition:manage', 'workflow:execution:read', 'workflow:execution:submit', 'workflow:approval:execute',
      'audit:log:read', 'audit:hash:verify', 'audit:compliance:export',
      'billing:subscription:read', 'billing:subscription:upgrade', 'billing:tier:override', 'billing:invoice:adjust',
    ],
  },
  admin: {
    id: 'admin',
    name: 'Workspace Owner',
    username: 'admin@acc.io',
    aliases: ['admin@acc.io', 'admin_bypass', 'admin', 'tenant-admin'],
    defaultTenantId: 'tenant-acme',
    actorTenantId: null,
    uid: 'usr_sandbox_admin_001',
    roles: ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER', 'ROLE_ADMIN'],
    description: 'Full workspace administrative access, schema authoring, member and billing governance',
    permissions: [
      'workspace:settings:read', 'workspace:settings:manage', 'workspace:members:read', 'workspace:members:manage',
      'metadata:schema:read', 'metadata:schema:write', 'metadata:blueprint:provision',
      'entity:record:read', 'entity:record:create', 'entity:record:update', 'entity:record:delete', 'entity:record:export',
      'workflow:definition:read', 'workflow:definition:manage', 'workflow:execution:read', 'workflow:execution:submit', 'workflow:approval:execute',
      'audit:log:read', 'billing:subscription:read', 'billing:subscription:upgrade',
    ],
  },
  creator: {
    id: 'creator',
    name: 'Operations Manager',
    username: 'creator@acc.io',
    aliases: ['creator@acc.io', 'creator_bypass', 'creator', 'tenant-creator'],
    defaultTenantId: 'tenant-acme',
    actorTenantId: null,
    uid: 'usr_sandbox_creator_001',
    roles: ['ROLE_OPERATIONS_MANAGER', 'ROLE_STANDARD_MEMBER'],
    description: 'Operations manager with schema write, record mutation, integrations, and data export',
    permissions: [
      'workspace:settings:read', 'metadata:schema:read', 'metadata:schema:write',
      'entity:record:read', 'entity:record:create', 'entity:record:update', 'entity:record:delete', 'entity:record:export',
      'workflow:definition:read', 'workflow:definition:manage', 'workflow:execution:read', 'workflow:execution:submit', 'workflow:approval:execute',
      'audit:log:read',
    ],
  },
  user: {
    id: 'user',
    name: 'Standard Member',
    username: 'user@acc.io',
    aliases: ['user@acc.io', 'user_bypass', 'user', 'tenant-user'],
    defaultTenantId: 'tenant-acme',
    actorTenantId: null,
    uid: 'usr_sandbox_user_001',
    roles: ['ROLE_STANDARD_MEMBER'],
    description: 'Standard member with data record read and write access',
    permissions: [
      'workspace:settings:read', 'metadata:schema:read',
      'entity:record:read', 'entity:record:create', 'entity:record:update',
      'workflow:execution:read', 'workflow:execution:submit',
    ],
  },
  custom: {
    id: 'custom',
    name: 'Custom Persona',
    username: 'custom@acc.io',
    aliases: ['custom@acc.io', 'custom_bypass', 'custom'],
    defaultTenantId: 'tenant-acme',
    actorTenantId: null,
    uid: 'usr_sandbox_custom_001',
    roles: ['ROLE_STANDARD_MEMBER'],
    description: 'Configurable sandbox profile for edge-case diagnostics',
    permissions: [
      'workspace:settings:read', 'entity:record:read',
    ],
  },
};

export interface SandboxStoreActions {
  setEnabled: (enabled: boolean) => void;
  setActivePersona: (personaId: SandboxPersonaId) => void;
  setActiveTenant: (tenantId: string) => void;
  setNetworkLatency: (minMs: number, maxMs?: number) => void;
  setFaultInjection: (faultRate: number, faultStatusCode?: number) => void;
  setFeatureToggle: (feature: keyof SandboxState['activeFeatures'], enabled: boolean) => void;
  resetToDefaults: () => void;
}

export type SandboxStore = SandboxState & SandboxStoreActions;

const initialDefaultState: SandboxState = {
  enabled: false,
  activePersonaId: 'admin',
  activeTenantId: 'tenant-acme',
  networkSimulation: {
    latencyMinMs: 0,
    latencyMaxMs: 0,
    faultRate: 0,
    faultStatusCode: 500,
  },
  activeFeatures: {
    auth: true,
    metadata: true,
    users: true,
    tasks: true,
  },
};

export const useSandboxStore = create<SandboxStore>()(
  persist(
    (set) => ({
      ...initialDefaultState,

      setEnabled: (enabled) => {
        defaultSandboxStore.setEnabled(enabled);
        set({ enabled });
      },

      setActivePersona: (activePersonaId) => {
        const persona = DEFAULT_SANDBOX_PERSONAS[activePersonaId] || DEFAULT_SANDBOX_PERSONAS.admin;
        defaultSandboxStore.setActivePersona(activePersonaId);
        defaultSandboxStore.setActiveTenant(persona.defaultTenantId);
        set({
          activePersonaId,
          activeTenantId: persona.defaultTenantId,
        });
      },

      setActiveTenant: (activeTenantId) => {
        defaultSandboxStore.setActiveTenant(activeTenantId);
        set({ activeTenantId });
      },

      setNetworkLatency: (latencyMinMs, latencyMaxMs) =>
        set((state) => ({
          networkSimulation: {
            ...state.networkSimulation,
            latencyMinMs,
            latencyMaxMs: latencyMaxMs ?? latencyMinMs,
          },
        })),

      setFaultInjection: (faultRate, faultStatusCode = 500) =>
        set((state) => ({
          networkSimulation: {
            ...state.networkSimulation,
            faultRate: Math.max(0, Math.min(1, faultRate)),
            faultStatusCode,
          },
        })),

      setFeatureToggle: (feature, enabled) =>
        set((state) => ({
          activeFeatures: {
            ...state.activeFeatures,
            [feature]: enabled,
          },
        })),

      resetToDefaults: () => {
        defaultSandboxStore.resetToDefaults();
        set(initialDefaultState);
      },
    }),
    {
      name: 'acc-sandbox-config',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

// Two-way synchronization with @acc/sandbox defaultSandboxStore
useSandboxStore.subscribe((state) => {
  defaultSandboxStore.setState({
    enabled: state.enabled,
    activePersonaId: state.activePersonaId,
    activeTenantId: state.activeTenantId,
    networkSimulation: state.networkSimulation,
    activeFeatures: state.activeFeatures,
  });
});

