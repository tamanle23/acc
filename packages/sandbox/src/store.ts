import type {
  SandboxPersona,
  SandboxPersonaId,
  SandboxState,
} from './types';

export const DEFAULT_SANDBOX_PERSONAS: Record<SandboxPersonaId, SandboxPersona> = {
  system: {
    id: 'system',
    name: 'Sovereign Custodian (Me)',
    username: 'custodian_root',
    roles: ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_SYSTEM_CUSTODIAN'],
    defaultTenantId: 'SYSTEM',
    description: 'Ultimate sovereign authority across all tenants, fleet operations, unconstrained quotas, and RBAC matrix',
  },
  admin: {
    id: 'admin',
    name: 'Administrator',
    username: 'admin_bypass',
    roles: ['ROLE_USER', 'ROLE_ADMIN'],
    defaultTenantId: 'tenant-us-east-1',
    description: 'Full administrative access across all tenants and schema definitions',
  },
  creator: {
    id: 'creator',
    name: 'Content Creator',
    username: 'creator_bypass',
    roles: ['ROLE_USER', 'ROLE_CREATOR'],
    defaultTenantId: 'tenant-eu-central-1',
    description: 'Data authoring, record curation, and schema staging permissions',
  },
  user: {
    id: 'user',
    name: 'Standard User',
    username: 'user_bypass',
    roles: ['ROLE_USER'],
    defaultTenantId: 'tenant-us-west-2',
    description: 'Standard operational permissions with scoped tenant visibility',
  },
  custom: {
    id: 'custom',
    name: 'Custom Persona',
    username: 'custom_bypass',
    roles: ['ROLE_USER'],
    defaultTenantId: 'tenant-us-east-1',
    description: 'Configurable sandbox profile for edge-case diagnostics',
  },
};

export const initialDefaultSandboxState: SandboxState = {
  enabled: true,
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
