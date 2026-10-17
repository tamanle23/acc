import type { CanvasAdapter, CanvasInstance, CanvasEnvironment } from './types';
import { WebCanvasAdapter } from './adapters/WebCanvasAdapter';
import { NodeCanvasAdapter } from './adapters/NodeCanvasAdapter';

/**
 * UniversalCanvasProvider:
 * Isomorphic Canvas resolution engine providing seamless switching between
 * Web (OffscreenCanvas / HTMLCanvasElement) and Node/Bun (@napi-rs/canvas).
 * Guarantees zero native C++ bundle pollution in client-side Vite builds.
 */
export class UniversalCanvasProvider {
  private static instance: UniversalCanvasProvider | null = null;
  private currentEngine: CanvasEnvironment = 'auto';
  private webAdapter: CanvasAdapter;
  private nodeAdapter: CanvasAdapter;
  private customAdapters = new Map<string, CanvasAdapter>();

  private constructor() {
    this.webAdapter = new WebCanvasAdapter();
    this.nodeAdapter = new NodeCanvasAdapter();
  }

  public static getInstance(): UniversalCanvasProvider {
    if (!UniversalCanvasProvider.instance) {
      UniversalCanvasProvider.instance = new UniversalCanvasProvider();
    }
    return UniversalCanvasProvider.instance;
  }

  public static detectEnvironment(): 'web' | 'node' {
    // 1. Explicit Node/Bun detection
    const isNodeOrBun =
      typeof process !== 'undefined' &&
      typeof process.versions !== 'undefined' &&
      (Boolean(process.versions.node) || Boolean((process.versions as any).bun));

    // 2. Browser window or worker environment
    const isBrowserWindow = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const isWebWorker =
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as any).importScripts === 'function' &&
      typeof (globalThis as any).OffscreenCanvas !== 'undefined';

    if (isBrowserWindow || isWebWorker) {
      return 'web';
    }

    if (isNodeOrBun) {
      return 'node';
    }

    return 'web';
  }

  public setEngine(engine: CanvasEnvironment): void {
    this.currentEngine = engine;
  }

  public getEngine(): CanvasEnvironment {
    return this.currentEngine;
  }

  public registerAdapter(adapter: CanvasAdapter): void {
    this.customAdapters.set(adapter.name, adapter);
  }

  public getAdapter(engine: CanvasEnvironment = this.currentEngine): CanvasAdapter {
    if (this.customAdapters.has(engine)) {
      return this.customAdapters.get(engine)!;
    }

    if (engine === 'web') {
      return this.webAdapter;
    }

    if (engine === 'node') {
      return this.nodeAdapter;
    }

    // Auto resolution:
    const detected = UniversalCanvasProvider.detectEnvironment();
    if (detected === 'node' && this.nodeAdapter.isSupported()) {
      return this.nodeAdapter;
    }
    return this.webAdapter;
  }

  public createCanvas(width: number, height: number, engine?: CanvasEnvironment): CanvasInstance {
    const adapter = this.getAdapter(engine);
    return adapter.createCanvas(width, height);
  }

  // Static ergonomic convenience delegates
  public static getAdapter(engine?: CanvasEnvironment): CanvasAdapter {
    return UniversalCanvasProvider.getInstance().getAdapter(engine);
  }

  public static setEngine(engine: CanvasEnvironment): void {
    UniversalCanvasProvider.getInstance().setEngine(engine);
  }

  public static createCanvas(width: number, height: number, engine?: CanvasEnvironment): CanvasInstance {
    return UniversalCanvasProvider.getInstance().createCanvas(width, height, engine);
  }
}
