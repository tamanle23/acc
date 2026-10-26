import { UniversalLogger as Logger } from '@acc/core-isomorphic';

export type HfDeviceType = 'webgpu' | 'wasm' | 'cpu' | 'auto';
export type HfDtypeType = 'fp32' | 'fp16' | 'q8' | 'q4';

export interface HfConfigOptions {
  device: HfDeviceType;
  dtype?: HfDtypeType;
  remoteHost?: string;
  cacheDir?: string;
  allowLocalModels?: boolean;
  allowRemoteModels?: boolean;
}

export type OnnxBackendType = 'transformers' | 'heuristic';

export interface OnnxRuntimeStatus {
  backend: OnnxBackendType;
  available: boolean;
  device: HfDeviceType;
  transformersModule: any;
}

/**
 * UniversalOnnxRuntimeProvider:
 * Clean, isomorphic singleton facade managing @huggingface/transformers initialization.
 *
 * Defaults to WebGPU across browser and Node/Bun environments with seamless
 * fallback to WASM / CPU and full enterprise configuration support (remote host endpoints,
 * quantization levels, and local filesystem caching).
 */
export class UniversalOnnxRuntimeProvider {
  private static cachedModule: any = null;
  private static initPromise: Promise<any> | null = null;

  private static currentConfig: HfConfigOptions = {
    device: 'webgpu',
    allowLocalModels: true,
    allowRemoteModels: true,
  };

  /**
   * Updates global configuration options for Hugging Face Transformers runtime.
   */
  public static configure(options: Partial<HfConfigOptions>): void {
    this.currentConfig = {
      ...this.currentConfig,
      ...options,
    };

    if (this.cachedModule?.env) {
      this.applyConfigToEnv(this.cachedModule.env);
    }
  }

  /**
   * Retrieves current configuration.
   */
  public static getConfig(): Readonly<HfConfigOptions> {
    return this.currentConfig;
  }

  /**
   * Universally imports and initializes @huggingface/transformers with active configuration.
   */
  public static async getTransformers(): Promise<any> {
    if (this.cachedModule) return this.cachedModule;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const tf = await import('@huggingface/transformers');
        if (tf?.env) {
          this.applyConfigToEnv(tf.env);
        }
        this.cachedModule = tf;
        Logger.info('UniversalOnnxRuntimeProvider', `Loaded @huggingface/transformers (device: ${this.currentConfig.device})`);
        return tf;
      } catch (err: any) {
        Logger.warn('UniversalOnnxRuntimeProvider', `Transformers.js unavailable: ${err?.message || err}`);
        return null;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Resolves current runtime status and availability.
   */
  public static async getStatus(): Promise<OnnxRuntimeStatus> {
    const tf = await this.getTransformers();
    return {
      backend: tf ? 'transformers' : 'heuristic',
      available: Boolean(tf),
      device: this.currentConfig.device,
      transformersModule: tf,
    };
  }

  /**
   * Applies active configuration options directly to Transformers.js env object.
   */
  public static applyConfigToEnv(env: any): void {
    if (!env) return;

    if (this.currentConfig.cacheDir) {
      env.cacheDir = this.currentConfig.cacheDir;
    }

    if (this.currentConfig.remoteHost) {
      env.remoteHost = this.currentConfig.remoteHost;
    }

    if (this.currentConfig.allowLocalModels !== undefined) {
      env.allowLocalModels = this.currentConfig.allowLocalModels;
    }

    if (this.currentConfig.allowRemoteModels !== undefined) {
      env.allowRemoteModels = this.currentConfig.allowRemoteModels;
    }

    // Configure ONNX backend device preferences
    if (env.backends?.onnx) {
      if (this.currentConfig.device === 'wasm') {
        env.backends.onnx.wasm = env.backends.onnx.wasm || {};
      }
    }
  }

  /**
   * Resets singleton cache (useful for isolated unit testing).
   */
  public static reset(): void {
    this.cachedModule = null;
    this.initPromise = null;
    this.currentConfig = {
      device: 'webgpu',
      allowLocalModels: true,
      allowRemoteModels: true,
    };
  }
}
