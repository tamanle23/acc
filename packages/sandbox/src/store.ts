import type {
  SandboxPersona,
  SandboxPersonaId,
  SandboxState,
} from './types';

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
    roles: ['ROLE_WORKSPACE_OWNER', 'ROLE_STANDARD_MEMBER'],
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

export const initialDefaultSandboxState: SandboxState = {
  enabled: false,
  activePersonaId: 'admin',
  activeTenantId: 'tenant-us-east-1',
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
