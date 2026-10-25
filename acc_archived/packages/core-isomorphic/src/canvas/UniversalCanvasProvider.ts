import type {
  ICanvasAdapter,
  ICanvasInstance,
  CanvasEnvironment,
  CanvasAdapter,
  CanvasInstance,
} from './types';
import { CanvasScratchPool } from './CanvasScratchPool';

/**
 * UniversalCanvasProvider:
 * Isomorphic Canvas abstract factory providing seamless strategy registration
 * and switching across Web (OffscreenCanvas / HTMLCanvasElement) and Node/Bun (@napi-rs/canvas).
 * Guarantees zero native C++ bundle pollution in client-side Vite builds.
 */
export class UniversalCanvasProvider {
  private static instance: UniversalCanvasProvider | null = null;
  private static adapters = new Map<string, ICanvasAdapter>();
  private static defaultAdapter: ICanvasAdapter | null = null;
  private static lazyLoaders = new Map<string, () => ICanvasAdapter | Promise<ICanvasAdapter>>();
  private currentEngine: CanvasEnvironment = 'auto';

  public static getInstance(): UniversalCanvasProvider {
    if (!UniversalCanvasProvider.instance) {
      UniversalCanvasProvider.instance = new UniversalCanvasProvider();
    }
    return UniversalCanvasProvider.instance;
  }

  public static detectEnvironment(): 'web' | 'node' {
    const isNodeOrBun =
      typeof process !== 'undefined' &&
      typeof process.versions !== 'undefined' &&
      (Boolean(process.versions.node) || Boolean((process.versions as any).bun));

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

  public static registerAdapter(adapter: ICanvasAdapter, isDefault = false): void {
    UniversalCanvasProvider.adapters.set(adapter.name, adapter);
    UniversalCanvasProvider.adapters.set(adapter.environment, adapter);
    if (adapter.name === 'node-napi-rs') {
      UniversalCanvasProvider.adapters.set('napi-rs', adapter);
    }
    if (adapter.name === 'web-canvas') {
      UniversalCanvasProvider.adapters.set('web', adapter);
    }
    if (isDefault || !UniversalCanvasProvider.defaultAdapter) {
      UniversalCanvasProvider.defaultAdapter = adapter;
    }
  }

  public static registerLazy(name: string, loader: () => ICanvasAdapter | Promise<ICanvasAdapter>): void {
    UniversalCanvasProvider.lazyLoaders.set(name, loader);
  }

  public static unregisterAll(): void {
    UniversalCanvasProvider.adapters.clear();
    UniversalCanvasProvider.lazyLoaders.clear();
    UniversalCanvasProvider.defaultAdapter = null;
  }

  public registerAdapter(adapter: ICanvasAdapter, isDefault = false): void {
    UniversalCanvasProvider.registerAdapter(adapter, isDefault);
  }

  public setEngine(engine: CanvasEnvironment): void {
    this.currentEngine = engine;
  }

  public getEngine(): CanvasEnvironment {
    return this.currentEngine;
  }

  public getAdapter(engine: CanvasEnvironment | string = this.currentEngine): ICanvasAdapter {
    return UniversalCanvasProvider.getAdapter(engine);
  }

  public createCanvas(width: number, height: number, engine?: CanvasEnvironment | string): ICanvasInstance {
    return UniversalCanvasProvider.createCanvas(width, height, engine);
  }

  // Static delegates
  public static setEngine(engine: CanvasEnvironment): void {
    UniversalCanvasProvider.getInstance().setEngine(engine);
  }

  public static getAdapter(engine?: CanvasEnvironment | string): ICanvasAdapter {
    const resolvedEngine = engine ?? UniversalCanvasProvider.getInstance().getEngine();
    const isAuto = resolvedEngine === 'auto';
    const target = isAuto ? UniversalCanvasProvider.detectEnvironment() : resolvedEngine;

    // 1. Direct match by name or environment
    if (UniversalCanvasProvider.adapters.has(target)) {
      return UniversalCanvasProvider.adapters.get(target)!;
    }

    // 2. Default adapter if environment matches target or if engine was 'auto'
    if (UniversalCanvasProvider.defaultAdapter) {
      if (
        isAuto ||
        UniversalCanvasProvider.defaultAdapter.environment === target ||
        UniversalCanvasProvider.defaultAdapter.name === target
      ) {
        return UniversalCanvasProvider.defaultAdapter;
      }
    }

    // 3. Check any registered adapter matching the target environment
    for (const adapter of UniversalCanvasProvider.adapters.values()) {
      if (adapter.environment === target || adapter.name === target) {
        return adapter;
      }
    }

    // 4. Check lazy loaders
    if (UniversalCanvasProvider.lazyLoaders.has(target)) {
      const loader = UniversalCanvasProvider.lazyLoaders.get(target)!;
      const loaded = loader();
      if (loaded && typeof (loaded as any).then !== 'function') {
        UniversalCanvasProvider.registerAdapter(loaded as ICanvasAdapter);
        return loaded as ICanvasAdapter;
      }
    }

    // 5. Default fallback if 'auto'
    if (isAuto && UniversalCanvasProvider.defaultAdapter) {
      return UniversalCanvasProvider.defaultAdapter;
    }

    throw new Error(
      `[UniversalCanvasProvider] No canvas adapter registered for environment '${target}'. Register an adapter via UniversalCanvasProvider.registerAdapter().`
    );
  }

  public static createCanvas(width: number, height: number, preferredAdapter?: CanvasEnvironment | string): ICanvasInstance {
    const adapter = UniversalCanvasProvider.getAdapter(preferredAdapter || UniversalCanvasProvider.getInstance().getEngine());
    return adapter.createCanvas(width, height);
  }

  public static acquireScratchCanvas(width: number, height: number, preferredAdapter?: CanvasEnvironment): ICanvasInstance {
    return CanvasScratchPool.getInstance().acquire(width, height, preferredAdapter);
  }

  public static releaseScratchCanvas(canvas: ICanvasInstance): void {
    CanvasScratchPool.getInstance().release(canvas);
  }

  public acquireScratchCanvas(width: number, height: number, preferredAdapter?: CanvasEnvironment): ICanvasInstance {
    return UniversalCanvasProvider.acquireScratchCanvas(width, height, preferredAdapter);
  }

  public releaseScratchCanvas(canvas: ICanvasInstance): void {
    UniversalCanvasProvider.releaseScratchCanvas(canvas);
  }
}
