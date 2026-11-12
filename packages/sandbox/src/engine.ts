import { SandboxRegistry, sandboxRegistry } from './registry';
import { defaultSandboxStore, SandboxStoreManager, DEFAULT_SANDBOX_PERSONAS } from './store';
import { withSimulationDecorator } from './simulation';
import type {
  SandboxPersona,
  SandboxRequest,
  SandboxResponse,
} from './types';

export interface SandboxEngineOptions {
  registry?: SandboxRegistry;
  store?: SandboxStoreManager;
  isDev?: boolean;
}

export class UnifiedSandboxEngine {
  private registry: SandboxRegistry;
  private store: SandboxStoreManager;

  constructor(options: SandboxEngineOptions = {}) {
    this.registry = options.registry || sandboxRegistry;
    this.store = options.store || defaultSandboxStore;
  }

  public getRegistry(): SandboxRegistry {
    return this.registry;
  }

  public getStore(): SandboxStoreManager {
    return this.store;
  }

  public getActivePersona(): SandboxPersona {
    const { activePersonaId } = this.store.getState();
    return DEFAULT_SANDBOX_PERSONAS[activePersonaId] || DEFAULT_SANDBOX_PERSONAS.admin;
  }

  /**
   * Dispatches an incoming request against registered handlers.
   * Returns SandboxResponse if handled, or null if unhandled / disabled.
   */
  public async handleRequest(req: SandboxRequest): Promise<SandboxResponse | null> {
    console.log('handleRequest');
    const state = this.store.getState();
    const headers: Record<string, string> = {};
    if (req.headers) {
      for (const [key, val] of Object.entries(req.headers)) {
        if (val !== undefined && val !== null) {
          headers[key.toLowerCase()] = String(val);
        }
      }
    }

    const match = this.registry.findHandler(req.url, req.method, headers);
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

export const defaultSandboxEngine = new UnifiedSandboxEngine();
