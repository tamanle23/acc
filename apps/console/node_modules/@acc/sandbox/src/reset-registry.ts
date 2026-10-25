/**
 * Unified Sandbox Platform - Centralized State Reset Registry
 * Allows in-memory mock repositories and stateful stores to register their reset callbacks.
 */

export type ResetHandler = () => void | Promise<void>;

export class SandboxResetRegistry {
  private static instance: SandboxResetRegistry;
  private resetHandlers: Set<ResetHandler> = new Set();

  private constructor() {}

  public static getInstance(): SandboxResetRegistry {
    if (!SandboxResetRegistry.instance) {
      SandboxResetRegistry.instance = new SandboxResetRegistry();
    }
    return SandboxResetRegistry.instance;
  }

  /**
   * Registers a repository or store reset callback.
   * Returns an unregister function.
   */
  public register(handler: ResetHandler): () => void {
    this.resetHandlers.add(handler);
    return () => {
      this.resetHandlers.delete(handler);
    };
  }

  /**
   * Unregisters a reset handler.
   */
  public unregister(handler: ResetHandler): boolean {
    return this.resetHandlers.delete(handler);
  }

  /**
   * Resets all registered in-memory stores and mock repositories across all domains.
   */
  public async resetAll(): Promise<void> {
    for (const handler of Array.from(this.resetHandlers)) {
      try {
        await handler();
      } catch (err) {
        console.error('[SandboxResetRegistry] Error during reset handler execution:', err);
      }
    }
  }

  /**
   * Clears all registered reset handlers (primarily for test tear-down).
   */
  public clear(): void {
    this.resetHandlers.clear();
  }
}

export const sandboxResetRegistry = SandboxResetRegistry.getInstance();
