import { UniversalLogger as Logger } from '@acc/core-isomorphic';

export type OnnxBackendType = 'node' | 'web' | 'heuristic';

export interface OnnxRuntimeStatus {
  backend: OnnxBackendType;
  nativeAvailable: boolean;
  webWasmAvailable: boolean;
  platform: string;
  arch: string;
  transformersModule: any;
}

/**
 * UniversalOnnxRuntimeProvider:
 * Manages cross-platform ONNX Runtime inference execution across Node, Bun, and Browser.
 * 
 * Hierarchy:
 * 1. Checks if running in browser -> directly uses transformers.web.js (WebGPU / WASM).
 * 2. If running in Node/Bun:
 *    - Probes if native `onnxruntime-node` binary exists for current OS & architecture.
 *    - If binary exists and is openable -> loads native Node module for maximum performance.
 *    - If binary is missing (e.g. `darwin/x64`) or throws error -> seamlessly falls back to transformers.web.js (WASM / WebGPU).
 *    - If WASM fails -> degrades gracefully to mathematical heuristics (GrabCut / Procedural Depth).
 */
export class UniversalOnnxRuntimeProvider {
  private static cachedStatus: OnnxRuntimeStatus | null = null;
  private static initPromise: Promise<OnnxRuntimeStatus> | null = null;

  public static async getStatus(): Promise<OnnxRuntimeStatus> {
    if (this.cachedStatus) return this.cachedStatus;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.resolveBackend();
    this.cachedStatus = await this.initPromise;
    this.initPromise = null;
    return this.cachedStatus;
  }

  public static async getTransformers(): Promise<any> {
    const status = await this.getStatus();
    return status.transformersModule;
  }

  private static async resolveBackend(): Promise<OnnxRuntimeStatus> {
    const isNode = typeof process !== 'undefined' && !!process.versions?.node;
    const platform = isNode ? process.platform : 'browser';
    const arch = isNode ? process.arch : 'unknown';

    if (!isNode) {
      // Pure browser runtime: load standard @huggingface/transformers web bundle
      try {
        const webMod = await import('@huggingface/transformers');
        return {
          backend: 'web',
          nativeAvailable: false,
          webWasmAvailable: true,
          platform,
          arch,
          transformersModule: webMod,
        };
      } catch (err: any) {
        Logger.warn('UniversalOnnxRuntimeProvider', `Browser transformers load failed: ${err.message}`);
        return {
          backend: 'heuristic',
          nativeAvailable: false,
          webWasmAvailable: false,
          platform,
          arch,
          transformersModule: null,
        };
      }
    }

    // Node/Bun runtime: probe native onnxruntime-node
    let nativeAvailable = false;
    let nativeMod: any = null;

    try {
      // Probe if native binary actually exists on disk before requiring to avoid hard crash
      const fs = require('fs');
      const path = require('path');
      const { createRequire } = require('module');
      const req = createRequire(import.meta.url || __filename);
      const pkgPath = req.resolve('@huggingface/transformers/package.json');
      const pkgDir = path.dirname(pkgPath);

      // Check onnxruntime-node native binding path
      const candidateBindingPaths = [
        path.join(pkgDir, 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6', platform, arch, 'onnxruntime_binding.node'),
        path.resolve(process.cwd(), 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6', platform, arch, 'onnxruntime_binding.node'),
      ];

      for (const p of candidateBindingPaths) {
        if (fs.existsSync(p)) {
          nativeAvailable = true;
          break;
        }
      }

      if (nativeAvailable) {
        nativeMod = await import('@huggingface/transformers');
        Logger.info('UniversalOnnxRuntimeProvider', `Loaded native onnxruntime-node for ${platform}/${arch}`);
        return {
          backend: 'node',
          nativeAvailable: true,
          webWasmAvailable: true,
          platform,
          arch,
          transformersModule: nativeMod,
        };
      }
    } catch (e: any) {
      Logger.warn(
        'UniversalOnnxRuntimeProvider',
        `Native onnxruntime-node probe failed on ${platform}/${arch} (${e.message}). Switching to WASM fallback...`
      );
    }

    // Seamless fallback to transformers.web.js (WebAssembly / WebGPU backend)
    try {
      const path = require('path');
      const { createRequire } = require('module');
      const req = createRequire(import.meta.url || __filename);
      const pkgJson = req.resolve('@huggingface/transformers/package.json');
      const webPath = path.join(path.dirname(pkgJson), 'dist', 'transformers.web.js');

      const webMod = await import(webPath);
      Logger.info(
        'UniversalOnnxRuntimeProvider',
        `Successfully engaged onnxruntime-web (WASM) for host: ${platform}/${arch}`
      );

      return {
        backend: 'web',
        nativeAvailable: false,
        webWasmAvailable: true,
        platform,
        arch,
        transformersModule: webMod,
      };
    } catch (fallbackErr: any) {
      Logger.warn(
        'UniversalOnnxRuntimeProvider',
        `WASM fallback also failed (${fallbackErr.message}). Engaging heuristic fallback.`
      );
      return {
        backend: 'heuristic',
        nativeAvailable: false,
        webWasmAvailable: false,
        platform,
        arch,
        transformersModule: null,
      };
    }
  }
}
