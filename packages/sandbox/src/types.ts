/**
 * Unified Sandbox Platform - Core Types
 */

export type SandboxPersonaId = 'system' | 'admin' | 'creator' | 'user' | 'custom';

export interface SandboxPersona {
  id: SandboxPersonaId;
  name: string;
  username: string;
  roles: string[];
  defaultTenantId: string;
  description: string;
}

export interface SandboxRequest {
  url: string;
  method: string;
  headers?: Record<string, string | null | undefined>;
  data?: any;
  params?: Record<string, any>;
}

export interface SandboxResponse<T = any> {
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  data: T;
}

export interface SandboxRouteMatcherContext {
  url: string;
  method: string;
  headers: Record<string, string>;
  pathname: string;
  searchParams: URLSearchParams;
}

export type SandboxRouteMatcher = (context: SandboxRouteMatcherContext) => boolean;

export type SandboxRouteHandlerFn = (
  req: SandboxRequest,
  context: SandboxRouteMatcherContext
) => Promise<SandboxResponse> | SandboxResponse;

export interface SandboxRouteHandler {
  id: string;
  name: string;
  description?: string;
  matcher: SandboxRouteMatcher;
  handler: SandboxRouteHandlerFn;
  /** Optional priority for ordering handlers (higher number = evaluated first) */
  priority?: number;
}

export interface NetworkSimulationConfig {
  /** Simulated latency jitter in ms [min, max] or fixed ms */
  latencyMinMs: number;
  latencyMaxMs: number;
  /** Fault injection rate (0.0 to 1.0) */
  faultRate: number;
  /** HTTP status code to return when fault is triggered */
  faultStatusCode: number;
}

export interface SandboxState {
  enabled: boolean;
  activePersonaId: SandboxPersonaId;
  activeTenantId: string;
  networkSimulation: NetworkSimulationConfig;
  activeFeatures: {
    auth: boolean;
    metadata: boolean;
    users: boolean;
    tasks: boolean;
  };
}
