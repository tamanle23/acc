import type {
  SandboxRouteHandler,
  SandboxRouteMatcherContext,
} from './types';

export class SandboxRegistry {
  private static instance: SandboxRegistry;
  private handlers: Map<string, SandboxRouteHandler> = new Map();

  public constructor() {}

  public static getInstance(): SandboxRegistry {
    if (!SandboxRegistry.instance) {
      SandboxRegistry.instance = new SandboxRegistry();
    }
    return SandboxRegistry.instance;
  }

  /**
   * Registers a domain sandbox handler. If a handler with the same ID exists, it is overwritten.
   */
  public register(handler: SandboxRouteHandler): void {
    this.handlers.set(handler.id, handler);
  }

  /**
   * Unregisters a handler by ID.
   */
  public unregister(id: string): boolean {
    return this.handlers.delete(id);
  }

  /**
   * Clears all registered handlers (used in testing).
   */
  public clear(): void {
    this.handlers.clear();
  }

  /**
   * Returns registered handlers sorted by priority (descending).
   */
  public getHandlers(): SandboxRouteHandler[] {
    return Array.from(this.handlers.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );
  }

  /**
   * Finds the first handler whose matcher satisfies the request context.
   */
  public findHandler(
    url: string,
    method: string,
    headers: Record<string, string> = {}
  ): { handler: SandboxRouteHandler; context: SandboxRouteMatcherContext } | null {
    let pathname = url;
    let searchParams = new URLSearchParams();

    try {
      // Normalise URL to extract pathname and query parameters
      const parsed = new URL(url, 'http://localhost');
      pathname = parsed.pathname;
      searchParams = parsed.searchParams;
    } catch {
      const qIdx = url.indexOf('?');
      if (qIdx !== -1) {
        pathname = url.substring(0, qIdx);
        searchParams = new URLSearchParams(url.substring(qIdx + 1));
      }
    }

    const context: SandboxRouteMatcherContext = {
      url,
      method: method.toUpperCase(),
      headers,
      pathname,
      searchParams,
    };

    for (const handler of this.getHandlers()) {
      try {
        if (handler.matcher(context)) {
          return { handler, context };
        }
      } catch (err) {
        console.error(`[SandboxRegistry] Handler matcher error: ${handler.id}`, err);
      }
    }

    return null;
  }
}

export const sandboxRegistry = SandboxRegistry.getInstance();
