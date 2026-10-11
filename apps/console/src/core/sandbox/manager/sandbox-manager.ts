import { useSandboxStore, DEFAULT_SANDBOX_PERSONAS } from '../store/sandbox-store';
import { sandboxRegistry } from './sandbox-registry';
import { withSimulationDecorator } from './simulation-decorator';
import { createMockJwt } from '../handlers/auth-sandbox-handler';
import { useSpringAuthStore } from '../../../features/spring-auth/store';
import { useMetadataUiStore } from '../../../features/metadata/store/use-metadata-ui-store';
import { useProfileStore } from '../../../stores/profile-store';
import type {
  SandboxPersona,
  SandboxPersonaId,
  SandboxRequest,
  SandboxResponse,
} from '../types';

export class UnifiedSandboxManager {
  private static instance: UnifiedSandboxManager;

  private constructor() {}

  public static getInstance(): UnifiedSandboxManager {
    if (!UnifiedSandboxManager.instance) {
      UnifiedSandboxManager.instance = new UnifiedSandboxManager();
    }
    return UnifiedSandboxManager.instance;
  }

  /**
   * Check if sandbox mode is currently enabled in store (strictly false in production or when disabled)
   */
  public isEnabled(): boolean {
    if (!import.meta.env.DEV) {
      return false;
    }
    if (import.meta.env.VITE_ENABLE_SANDBOX === 'false') {
      return false;
    }
    return useSandboxStore.getState().enabled;
  }

  /**
   * Get active persona details
   */
  public getActivePersona(): SandboxPersona {
    const { activePersonaId } = useSandboxStore.getState();
    return DEFAULT_SANDBOX_PERSONAS[activePersonaId] || DEFAULT_SANDBOX_PERSONAS.admin;
  }

  /**
   * Sync active persona tokens to useSpringAuthStore
   */
  public syncPersonaAuthTokens(personaId: SandboxPersonaId): void {
    const persona = DEFAULT_SANDBOX_PERSONAS[personaId] || DEFAULT_SANDBOX_PERSONAS.admin;
    const sub = persona.username.split('_')[0];

    const accessToken = createMockJwt({
      sub,
      roles: persona.roles,
      tenantId: persona.defaultTenantId,
      isSandbox: true,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 15,
    });
    const refreshToken = `mock_refresh_token_${sub}`;

    useSpringAuthStore.getState().setTokens(accessToken, refreshToken);
  }

  /**
   * Switch the active persona, sync active tenant, and update spring auth store tokens & UI profile context
   */
  public switchPersona(personaId: SandboxPersonaId): void {
    const persona = DEFAULT_SANDBOX_PERSONAS[personaId] || DEFAULT_SANDBOX_PERSONAS.admin;
    useSandboxStore.getState().setActivePersona(personaId);
    this.syncPersonaAuthTokens(personaId);

    const tenantId = persona.defaultTenantId;
    useMetadataUiStore.getState().setActiveTenant(tenantId, persona.name);
    useProfileStore.getState().syncAssumedTenant(tenantId === 'SYSTEM' ? null : tenantId, persona.name);
  }

  /**
   * Switch the active tenant and synchronize UI profile and metadata stores
   */
  public switchTenant(tenantId: string, tenantName?: string): void {
    useSandboxStore.getState().setActiveTenant(tenantId);
    useMetadataUiStore.getState().setActiveTenant(tenantId, tenantName || tenantId);
    useProfileStore.getState().syncAssumedTenant(tenantId === 'SYSTEM' ? null : tenantId, tenantName || tenantId);
  }

  /**
   * Configure simulated latency
   */
  public setLatency(minMs: number, maxMs?: number): void {
    useSandboxStore.getState().setNetworkLatency(minMs, maxMs);
  }

  /**
   * Configure fault injection
   */
  public setFaultInjection(faultRate: number, statusCode: number = 500): void {
    useSandboxStore.getState().setFaultInjection(faultRate, statusCode);
  }

  /**
   * Master toggle for sandbox mode
   */
  public setEnabled(enabled: boolean): void {
    useSandboxStore.getState().setEnabled(enabled);
    if (enabled) {
      const { activePersonaId } = useSandboxStore.getState();
      this.syncPersonaAuthTokens(activePersonaId);
    }
  }

  /**
   * Reset sandbox configuration to initial default values
   */
  public resetConfig(): void {
    useSandboxStore.getState().resetToDefaults();
    this.syncPersonaAuthTokens('admin');
  }

  /**
   * Dispatch an incoming request against registered sandbox handlers.
   * If sandbox is disabled or no handler matches, returns null to signal fall-through.
   */
  public async handleRequest(
    req: SandboxRequest
  ): Promise<SandboxResponse | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const state = useSandboxStore.getState();
    const headers: Record<string, string> = {};
    if (req.headers) {
      for (const [key, val] of Object.entries(req.headers)) {
        if (val !== undefined && val !== null) {
          headers[key.toLowerCase()] = String(val);
        }
      }
    }

    const match = sandboxRegistry.findHandler(req.url, req.method, headers);
    if (!match) {
      return null;
    }

    const { handler, context } = match;

    // Apply simulation decorator (latency + fault injection)
    return await withSimulationDecorator(
      () => handler.handler(req, context),
      state.networkSimulation
    );
  }
}

export const sandboxManager = UnifiedSandboxManager.getInstance();
