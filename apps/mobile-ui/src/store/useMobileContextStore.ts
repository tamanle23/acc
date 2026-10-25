import { create } from 'zustand';
import { defaultSandboxStore } from '@acc/sandbox';
import type { SandboxPersonaId } from '@acc/sandbox';

export interface MobileContextState {
  activeTenantId: string;
  activeWorkspaceId: string;
  activePersonaId: SandboxPersonaId;
  authToken: string | null;
  setActiveTenant: (tenantId: string) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  setActivePersona: (personaId: SandboxPersonaId) => void;
  setAuthToken: (token: string | null) => void;
}

export const useMobileContextStore = create<MobileContextState>((set) => ({
  activeTenantId: 'tenant-us-east-1',
  activeWorkspaceId: 'ws-mobile-default',
  activePersonaId: 'admin',
  authToken: null,

  setActiveTenant: (tenantId) => {
    set({ activeTenantId: tenantId });
    defaultSandboxStore.setActiveTenant(tenantId);
  },

  setActiveWorkspace: (workspaceId) => {
    set({ activeWorkspaceId: workspaceId });
  },

  setActivePersona: (personaId) => {
    set({ activePersonaId: personaId });
    defaultSandboxStore.setActivePersona(personaId);
    const personaTenant = defaultSandboxStore.getState().activeTenantId;
    if (personaTenant) {
      set({ activeTenantId: personaTenant });
    }
  },

  setAuthToken: (authToken) => {
    set({ authToken });
  },
}));
