import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SandboxPersona, SandboxPersonaId, SandboxState } from '../types';

export const DEFAULT_SANDBOX_PERSONAS: Record<SandboxPersonaId, SandboxPersona> = {
  system: {
    id: 'system',
    name: 'Sovereign Root Custodian (Me)',
    username: 'custodian_root',
    roles: ['ROLE_SYSTEM_ROOT', 'ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
    defaultTenantId: 'SYSTEM',
    description: 'Ultimate sovereign authority across all tenants, fleet operations, unconstrained quotas, and RBAC matrix',
  },
  admin: {
    id: 'admin',
    name: 'Workspace Owner',
    username: 'admin_bypass',
    roles: ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER', 'ROLE_ADMIN'],
    defaultTenantId: 'tenant-us-east-1',
    description: 'Full workspace administrative access, schema authoring, member and billing governance',
  },
  creator: {
    id: 'creator',
    name: 'Operations Manager',
    username: 'creator_bypass',
    roles: ['ROLE_OPERATIONS_MANAGER', 'ROLE_STANDARD_MEMBER'],
    defaultTenantId: 'tenant-eu-central-1',
    description: 'Operations manager with schema write, record mutation, integrations, and data export',
  },
  user: {
    id: 'user',
    name: 'Standard Member',
    username: 'user_bypass',
    roles: ['ROLE_STANDARD_MEMBER'],
    defaultTenantId: 'tenant-us-west-2',
    description: 'Standard member with data record read and write access',
  },
  custom: {
    id: 'custom',
    name: 'Custom Persona',
    username: 'custom_bypass',
    roles: ['ROLE_STANDARD_MEMBER'],
    defaultTenantId: 'tenant-us-east-1',
    description: 'Configurable sandbox profile for edge-case diagnostics',
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
  enabled: import.meta.env.DEV || false,
  activePersonaId: 'admin',
  activeTenantId: 'tenant-us-east-1',
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

      setEnabled: (enabled) => set({ enabled }),

      setActivePersona: (activePersonaId) => {
        const persona = DEFAULT_SANDBOX_PERSONAS[activePersonaId] || DEFAULT_SANDBOX_PERSONAS.admin;
        set({
          activePersonaId,
          activeTenantId: persona.defaultTenantId,
        });
      },

      setActiveTenant: (activeTenantId) => set({ activeTenantId }),

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

      resetToDefaults: () => set(initialDefaultState),
    }),
    {
      name: 'unipost-sandbox-config',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

// Two-way synchronization with @unipost/sandbox defaultSandboxStore
import { defaultSandboxStore } from '@unipost/sandbox';
useSandboxStore.subscribe((state) => {
  defaultSandboxStore.setState({
    enabled: state.enabled,
    activePersonaId: state.activePersonaId,
    activeTenantId: state.activeTenantId,
    networkSimulation: state.networkSimulation,
    activeFeatures: state.activeFeatures,
  });
});

