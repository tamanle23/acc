import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  type ModifierContext,
  type ResolvedTimeline,
  type ResolvedSequence,
  type ResolvedTrack,
  type ModifierNode,
} from '@acc/ir';

declare const WorkerGlobalScope: any;
import { UniversalLogger as Logger } from '@acc/core-isomorphic';
import { PreviewWorkerBridge } from './workers/PreviewWorkerBridge';
import type {
  ExecuteModifierPayload,
  WorkerMessage,
  WorkerResponse,
} from './SidecarTypes';

export interface ModifierWarmedEvent {
  targetId: string;
  modifierType: string;
  state?: Record<string, unknown>;
}

export interface SidecarPreflightOptions {
  prioritizedFrame?: number;
  lookaheadSec?: number;
}

const GLOBAL_COORDINATOR_KEY = Symbol.for('@acc/studio/PreviewWorkerCoordinator');

export class PreviewWorkerCoordinator {
  private static instance: PreviewWorkerCoordinator | null = null;
  private bridge: PreviewWorkerBridge | null = null;
  private worker: Worker | null = null;
  private inProcessRegistry: ModifierPluginRegistry | null = null;
  private isWarmedUp = false;
  private isWarmingUp = false;
  private isProcessing = false;
  private activeTasks = new Map<
    string,
    {
      targetId: string;
      resolve: () => void;
      reject: (err: Error) => void;
    }
  >();
  private highPriorityQueue: ExecuteModifierPayload[] = [];
  private lowPriorityQueue: ExecuteModifierPayload[] = [];
  private warmedListeners = new Set<(event: ModifierWarmedEvent) => void>();
  private completedTaskKeys = new Set<string>();
  private warmupResolvers: Array<(warmed: boolean) => void> = [];

  constructor(customWorkerUrl?: URL) {
    const g = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
    if (!customWorkerUrl && (PreviewWorkerCoordinator.instance || (g && g[GLOBAL_COORDINATOR_KEY]))) {
      return (PreviewWorkerCoordinator.instance || g[GLOBAL_COORDINATOR_KEY]) as PreviewWorkerCoordinator;
    }
    this.initWorker(customWorkerUrl);
  }

  public static getInstance(): PreviewWorkerCoordinator {
    // Invariant: PreviewWorkerCoordinator must NEVER be instantiated in Web Worker threads
    if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope) {
      throw new Error('[PreviewWorkerCoordinator] Must not be instantiated in a Web Worker realm.');
    }
    if (typeof self !== 'undefined' && typeof (self as any).importScripts === 'function') {
      throw new Error('[PreviewWorkerCoordinator] Must not be instantiated in a Web Worker realm.');
    }

    const g = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
    if (g && g[GLOBAL_COORDINATOR_KEY]) {
      PreviewWorkerCoordinator.instance = g[GLOBAL_COORDINATOR_KEY];
      return PreviewWorkerCoordinator.instance!;
    }

    if (!PreviewWorkerCoordinator.instance) {
      PreviewWorkerCoordinator.instance = new PreviewWorkerCoordinator();
      if (g) {
        g[GLOBAL_COORDINATOR_KEY] = PreviewWorkerCoordinator.instance;
      }
    }
    return PreviewWorkerCoordinator.instance;
  }

  private isWorkerGlobal(): boolean {
    if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope) {
      return true;
    }
    if (typeof self !== 'undefined' && 'importScripts' in self && typeof (self as Record<string, unknown>).importScripts === 'function') {
      return true;
    }
    return false;
  }

  private handleBridgeMessage = (event: MessageEvent): void => {
    if (event.data && typeof event.data === 'object' && 'type' in event.data) {
      this.handleWorkerMessage(event.data as WorkerResponse);
    }
  };

  private initWorker(customWorkerUrl?: URL): void {
    // Strictly prevent worker initialization if inside another worker
    if (this.isWorkerGlobal()) {
      return;
    }

    if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        if (customWorkerUrl) {
          this.worker = new Worker(customWorkerUrl, { type: 'module' });
          this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            this.handleWorkerMessage(event.data);
          };
        } else {
          // Re-use the unified single preview worker from PreviewWorkerBridge
          // to eliminate secondary duplicate worker allocation (~500MB RAM saving).
          this.bridge = PreviewWorkerBridge.getInstance();
          this.worker = this.bridge.getWorker();
          this.bridge.addMessageListener(this.handleBridgeMessage);
        }

        if (this.worker) {
          this.worker.onerror = (err) => {
            Logger.warn('PreviewWorkerCoordinator', `Sidecar worker encountered an error: ${err.message || err}`);
            this.isProcessing = false;
            this.notifyWarmupResolvers(false);
            this.drainNext();
          };
        }

        // Sole driver: initiate warmup immediately upon worker creation
        this.warmup();
        return;
      } catch (err: any) {
        Logger.warn(
          'PreviewWorkerCoordinator.ts',
          `Failed to initialize Web Worker; falling back to in-process execution: ${err?.message || err}`
        );
      }
    }

    // In-process fallback for Node.js / Bun tests
    this.inProcessRegistry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
    this.isWarmedUp = true;
    this.notifyWarmupResolvers(true);
  }

  public getIsWarmedUp(): boolean {
    return this.isWarmedUp;
  }

  public getIsWarmingUp(): boolean {
    return this.isWarmingUp;
  }

  /**
   * Returns a promise that resolves when the sidecar worker has completed its WARMUP task.
   * If the worker is already warmed up, resolves immediately.
   * Pure passive barrier: does not dispatch warmup requests itself.
   * Includes a timeout fallback (default: 4000ms) to ensure startup never hangs.
   */
  public waitForWarmup(timeoutMs = 4000): Promise<boolean> {
    if (this.isWarmedUp) {
      return Promise.resolve(true);
    }
    if (!this.worker) {
      return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const resolver = (warmed: boolean) => {
        if (timer) clearTimeout(timer);
        resolve(warmed);
      };

      this.warmupResolvers.push(resolver);

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          const idx = this.warmupResolvers.indexOf(resolver);
          if (idx !== -1) {
            this.warmupResolvers.splice(idx, 1);
          }
          resolve(false);
        }, timeoutMs);
      }
    });
  }

  private notifyWarmupResolvers(warmed: boolean): void {
    const list = [...this.warmupResolvers];
    this.warmupResolvers = [];
    list.forEach((r) => r(warmed));
  }

  public warmup(): void {
    if (this.isWarmedUp || this.isWarmingUp) {
      return;
    }
    if (this.worker) {
      this.isWarmingUp = true;
      this.worker.postMessage({ type: 'WARMUP' } satisfies WorkerMessage);
    }
  }

  private handleWorkerMessage(msg: WorkerResponse): void {
    switch (msg.type) {
      case 'WARMED_UP': {
        const alreadyWarmed = this.isWarmedUp;
        this.isWarmingUp = false;
        this.isWarmedUp = true;
        if (alreadyWarmed) {
          Logger.warn('PreviewWorkerCoordinator.ts', 'Duplicate WARMED_UP response received from sidecar worker.');
          break;
        }
        Logger.info('PreviewWorkerCoordinator.ts', 'Sidecar worker successfully warmed up.');
        this.notifyWarmupResolvers(true);
        break;
      }

      case 'TASK_CANCELED': {
        if (msg.taskId && this.activeTasks.has(msg.taskId)) {
          const task = this.activeTasks.get(msg.taskId)!;
          this.activeTasks.delete(msg.taskId);
          task.resolve();
        }
        this.isProcessing = false;
        this.drainNext();
        break;
      }

      case 'MODIFIER_EXECUTED': {
        if (msg.taskId && this.activeTasks.has(msg.taskId)) {
          const task = this.activeTasks.get(msg.taskId)!;
          this.activeTasks.delete(msg.taskId);
          this.completedTaskKeys.add(`${msg.targetId}:${msg.modifierType}`);
          task.resolve();
        }

        // Notify active subscribers (e.g. Preview canvas eager redraw)
        this.notifyWarmed({
          targetId: msg.targetId,
          modifierType: msg.modifierType,
          state: msg.state,
        });

        this.isProcessing = false;
        this.drainNext();
        break;
      }

      case 'ERROR': {
        if (msg.taskId && this.activeTasks.has(msg.taskId)) {
          const task = this.activeTasks.get(msg.taskId)!;
          this.activeTasks.delete(msg.taskId);
          task.reject(new Error(msg.error));
        }
        Logger.warn('PreviewWorkerCoordinator.ts', `Task failed: ${msg.error}`);
        this.isProcessing = false;
        this.drainNext();
        break;
      }
    }
  }

  /**
   * Subscribe to modifier warmed events for reactive UI frame repaints.
   */
  public onModifierWarmed(callback: (event: ModifierWarmedEvent) => void): () => void {
    this.warmedListeners.add(callback);
    return () => {
      this.warmedListeners.delete(callback);
    };
  }

  private notifyWarmed(event: ModifierWarmedEvent): void {
    for (const listener of this.warmedListeners) {
      try {
        listener(event);
      } catch (err) {
        Logger.error('PreviewWorkerCoordinator.ts', 'Error in warmed listener', err);
      }
    }
  }

  /**
   * Dispatches or in-process executes preflight for a specific modifier.
   */
  public async executeModifier(
    payload: ExecuteModifierPayload,
    isHighPriority = false
  ): Promise<void> {
    const taskKey = `${payload.targetId}:${payload.modifier.type}`;
    if (this.completedTaskKeys.has(taskKey)) {
      return;
    }

    if (this.worker) {
      return new Promise<void>((resolve, reject) => {
        this.activeTasks.set(payload.taskId, {
          targetId: payload.targetId,
          resolve,
          reject,
        });

        if (isHighPriority) {
          this.highPriorityQueue.push(payload);
        } else {
          this.lowPriorityQueue.push(payload);
        }

        this.drainNext();
      });
    }

    // Direct in-process execution (Node / Bun tests)
    if (!this.inProcessRegistry) {
      this.inProcessRegistry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
    }

    const plugin = this.inProcessRegistry.get(payload.modifier.type);
    if (plugin && typeof plugin.execute === 'function') {
      const context: ModifierContext = {
        targetType: payload.targetType,
        targetEntity: payload.targetEntity,
        timeline: new Map(),
        assets: payload.assets,
        fps: payload.fps,
        canvas: payload.canvas,
      };
      await plugin.execute(context, payload.modifier.params);
      this.completedTaskKeys.add(taskKey);
      this.notifyWarmed({
        targetId: payload.targetId,
        modifierType: payload.modifier.type,
        state: context.state,
      });
    }
  }

  private drainNext(): void {
    if (this.isProcessing || !this.worker) return;

    const nextPayload =
      this.highPriorityQueue.shift() || this.lowPriorityQueue.shift();
    if (!nextPayload) return;

    this.isProcessing = true;
    this.worker.postMessage({
      type: 'EXECUTE_MODIFIER',
      payload: nextPayload,
    } satisfies WorkerMessage);
  }

  /**
   * Cancels any pending or active tasks for a removed sequence.
   */
  public cancelTasksForTarget(targetId: string): void {
    // 1. Remove from pending queues
    this.highPriorityQueue = this.highPriorityQueue.filter((p) => p.targetId !== targetId);
    this.lowPriorityQueue = this.lowPriorityQueue.filter((p) => p.targetId !== targetId);

    // 2. Cancel active tasks
    for (const [taskId, task] of this.activeTasks.entries()) {
      if (task.targetId === targetId) {
        if (this.worker) {
          this.worker.postMessage({
            type: 'CANCEL_TASK',
            taskId,
            targetId,
          } satisfies WorkerMessage);
        }
        this.activeTasks.delete(taskId);
        task.resolve();
      }
    }
  }

  /**
   * Preflights an entire timeline or prioritized temporal window.
   */
  public async preflightTimeline(
    timeline: ResolvedTimeline,
    options: SidecarPreflightOptions = {}
  ): Promise<void> {
    const fps = timeline.meta.globalFps || 30;
    const canvas = {
      width: timeline.meta.canvasSize.w,
      height: timeline.meta.canvasSize.h,
    };
    const prioritizedFrame = options.prioritizedFrame ?? 0;
    const lookaheadFrames = (options.lookaheadSec ?? 3) * fps;

    const tasks: Promise<void>[] = [];

    // 1. Track Modifiers
    for (const track of timeline.tracks.values()) {
      if (track.modifiers) {
        for (const mod of track.modifiers) {
          const taskId = `track:${track.id}:${mod.type}`;
          tasks.push(
            this.executeModifier(
              {
                taskId,
                targetType: 'track',
                targetId: track.id,
                targetEntity: track,
                modifier: { type: mod.type, params: mod.params || {} } as ModifierNode,
                fps,
                canvas,
              },
              true
            )
          );
        }
      }
    }
    // 2. Sequence Modifiers sorted by proximity to prioritizedFrame
    const sequences = Array.from(timeline.sequences.values()).sort((a, b) => {
      const distA = Math.abs((a.startFrame ?? 0) - prioritizedFrame);
      const distB = Math.abs((b.startFrame ?? 0) - prioritizedFrame);
      return distA - distB;
    });

    const assets = timeline.assets || {};

    for (const seq of sequences) {
      if (seq.modifiers) {
        const start = seq.startFrame ?? 0;
        const end = start + (seq.durationFrames ?? 0);
        const isNearPlayhead =
          prioritizedFrame >= start - lookaheadFrames &&
          prioritizedFrame <= end + lookaheadFrames;

        const assetDef = seq.assetId ? assets[seq.assetId] : undefined;
        const effectiveImagePath = assetDef?.src || seq.assetId;

        for (const mod of seq.modifiers) {
          const taskId = `seq:${seq.id}:${mod.type}`;
          tasks.push(
            this.executeModifier(
              {
                taskId,
                targetType: 'sequence',
                targetId: seq.id,
                targetEntity: seq,
                rawEntity: {
                  ...seq,
                  src: effectiveImagePath,
                },
                modifier: {
                  type: mod.type,
                  params: {
                    ...(mod.params as Record<string, unknown>),
                    imagePath: (mod.params as Record<string, unknown>)?.imagePath || effectiveImagePath,
                  },
                } as ModifierNode,
                assets,
                fps,
                canvas,
              },
              isNearPlayhead
            )
          );
        }
      }
    }

    await Promise.allSettled(tasks);
  }

  /**
   * Resets coordinator state and invalidates task caches.
   */
  public reset(): void {
    this.highPriorityQueue = [];
    this.lowPriorityQueue = [];
    this.activeTasks.clear();
    this.completedTaskKeys.clear();
    this.isProcessing = false;
    if (this.worker) {
      this.worker.postMessage({ type: 'RESET' } satisfies WorkerMessage);
    }
  }

  /**
   * Explicitly terminates background worker for cleanup.
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.reset();
  }
}
