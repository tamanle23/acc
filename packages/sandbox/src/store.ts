import type {
  SandboxPersona,
  SandboxPersonaId,
  SandboxState,
} from './types';

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
  },
};

export const initialDefaultSandboxState: SandboxState = {
  enabled: false,
  activePersonaId: 'admin',
  activeTenantId: 'tenant-acme',
  networkSimulation: {
    latencyMinMs: 0,
    latencyMaxMs: 0,
    faultRate: 0.0,
    faultStatusCode: 500,
  },
  activeFeatures: {
    auth: true,
    metadata: true,
    users: true,
    tasks: true,
  },
};

export type StateListener = (state: SandboxState) => void;

/**
 * Lightweight, framework-agnostic sandbox state store.
 * Works uniformly in Browser, Node.js, and React Native.
 */
export class SandboxStoreManager {
  private state: SandboxState;
  private listeners: Set<StateListener> = new Set();

  constructor(initialState: SandboxState = initialDefaultSandboxState) {
    this.state = { ...initialState };
  }

  public getState(): SandboxState {
    return this.state;
  }

  public setState(updater: Partial<SandboxState> | ((prev: SandboxState) => Partial<SandboxState>)): void {
    const next = typeof updater === 'function' ? updater(this.state) : updater;
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener(this.state));
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public setEnabled(enabled: boolean): void {
    this.setState({ enabled });
  }

  public setActivePersona(personaId: SandboxPersonaId): void {
    const persona = DEFAULT_SANDBOX_PERSONAS[personaId] || DEFAULT_SANDBOX_PERSONAS.admin;
    this.setState({
      activePersonaId: personaId,
      activeTenantId: persona.defaultTenantId,
    });
  }

  public setActiveTenant(tenantId: string): void {
    this.setState({ activeTenantId: tenantId });
  }

  public setNetworkLatency(minMs: number, maxMs: number = minMs): void {
    this.setState((prev) => ({
      networkSimulation: {
        ...prev.networkSimulation,
        latencyMinMs: Math.max(0, minMs),
        latencyMaxMs: Math.max(minMs, maxMs),
      },
    }));
  }

  public setFaultInjection(faultRate: number, faultStatusCode: number = 500): void {
    this.setState((prev) => ({
      networkSimulation: {
        ...prev.networkSimulation,
        faultRate: Math.max(0, Math.min(1, faultRate)),
        faultStatusCode,
      },
    }));
  }

  public setFeatureToggle(feature: keyof SandboxState['activeFeatures'], enabled: boolean): void {
    this.setState((prev) => ({
      activeFeatures: {
        ...prev.activeFeatures,
        [feature]: enabled,
      },
    }));
  }

  public resetToDefaults(): void {
    this.state = {
      ...initialDefaultSandboxState,
      networkSimulation: { ...initialDefaultSandboxState.networkSimulation },
      activeFeatures: { ...initialDefaultSandboxState.activeFeatures },
    };
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export const defaultSandboxStore = new SandboxStoreManager();
