import type { VideoIRDocument } from '../types/VideoIR';
import type { IConfigToIRAdapter, AdapterOptions } from './IConfigToIRAdapter';
import { PipelineIRToUniversalIRAdapter } from './PipelineIRToUniversalIRAdapter';

/**
 * IRConfigAdapterRegistry:
 * Strategy Registry maintaining all input config adapters.
 * Implements the Open-Closed Principle (OCP): new formats register dynamically
 * without modifying compiler or renderer pipelines.
 */
export class IRConfigAdapterRegistry {
  private static instance: IRConfigAdapterRegistry;
  private adapters: Map<string, IConfigToIRAdapter<any>> = new Map();

  private constructor() {
    // Register the omnichannel pipeline-ir adapter by default
    this.register(new PipelineIRToUniversalIRAdapter());
  }

  public static getInstance(): IRConfigAdapterRegistry {
    if (!IRConfigAdapterRegistry.instance) {
      IRConfigAdapterRegistry.instance = new IRConfigAdapterRegistry();
    }
    return IRConfigAdapterRegistry.instance;
  }

  public register(adapter: IConfigToIRAdapter<any>): void {
    this.adapters.set(adapter.id, adapter);
  }

  public get(id: string): IConfigToIRAdapter<any> | undefined {
    return this.adapters.get(id);
  }

  public listAdapters(): Array<{ id: string; name: string; version: string }> {
    return Array.from(this.adapters.values()).map(a => ({
      id: a.id,
      name: a.name,
      version: a.version,
    }));
  }

  /**
   * Automatically discovers the best matching adapter for the given configuration.
   */
  public findAdapter(config: unknown): IConfigToIRAdapter<any> | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.canAdapt(config)) {
        return adapter;
      }
    }
    return undefined;
  }

  /**
   * Transforms any recognized input configuration into a canonical Video IR document.
   */
  public transform(config: unknown, options?: AdapterOptions): VideoIRDocument {
    // If it's already a valid Video IR document, pass it through directly
    if (
      config &&
      typeof config === 'object' &&
      'version' in config &&
      typeof (config as any).version === 'string' &&
      (config as any).version.includes('stable')
    ) {
      return config as VideoIRDocument;
    }

    const adapter = this.findAdapter(config);
    if (!adapter) {
      throw new Error(
        `[IRConfigAdapterRegistry] No registered adapter found capable of translating the provided configuration. Registered adapters: ${Array.from(this.adapters.keys()).join(', ')}`
      );
    }

    return adapter.adapt(config, options);
  }
}
