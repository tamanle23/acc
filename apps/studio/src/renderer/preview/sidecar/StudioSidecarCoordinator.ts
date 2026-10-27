import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  type ModifierContext,
  type ResolvedTimeline,
  type ResolvedSequence,
  type ResolvedTrack,
} from '@acc/ir';
import { UniversalLogger as Logger } from '@acc/core-isomorphic';
import type {
  ExecuteModifierPayload,
  SidecarWorkerMessage,
  SidecarWorkerResponse,
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

export class StudioSidecarCoordinator {
  private static instance: StudioSidecarCoordinator | null = null;
  private worker: Worker | null = null;
  private inProcessRegistry: ModifierPluginRegistry | null = null;
  private isWarmedUp = false;
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

  constructor(customWorkerUrl?: URL) {
    this.initWorker(customWorkerUrl);
  }

  public static getInstance(): StudioSidecarCoordinator {
    if (!StudioSidecarCoordinator.instance) {
      StudioSidecarCoordinator.instance = new StudioSidecarCoordinator();
    }
    return StudioSidecarCoordinator.instance;
  }

  private initWorker(customWorkerUrl?: URL): void {
    if (typeof Worker !== 'undefined') {
      try {
        const workerUrl =
          customWorkerUrl ??
          new URL('../../../workers/preview-sidecar.worker.ts', import.meta.url);
        this.worker = new Worker(workerUrl, { type: 'module' });

        this.worker.onmessage = (event: MessageEvent<SidecarWorkerResponse>) => {
          this.handleWorkerMessage(event.data);
        };

        this.worker.onerror = (err) => {
          Logger.warn('StudioSidecarCoordinator', `Sidecar worker encountered an error: ${err.message || err}`);
          this.isProcessing = false;
          this.drainNext();
        };

        this.scheduleWarmup();
        return;
      } catch (err: any) {
        Logger.warn(
          'StudioSidecarCoordinator',
          `Failed to initialize Web Worker; falling back to in-process execution: ${err?.message || err}`
        );
      }
    }

    // In-process fallback for Node.js / Bun tests
    this.inProcessRegistry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
  }

  private scheduleWarmup(): void {
    if (typeof window === 'undefined' || !this.worker) return;
    const schedule =
      (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 200));
    schedule(() => {
      if (this.worker && !this.isWarmedUp) {
        this.worker.postMessage({ type: 'WARMUP' } satisfies SidecarWorkerMessage);
      }
    });
  }

  private handleWorkerMessage(msg: SidecarWorkerResponse): void {
    switch (msg.type) {
      case 'WARMED_UP': {
        this.isWarmedUp = true;
        Logger.info('StudioSidecarCoordinator', 'Sidecar worker successfully warmed up.');
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
        Logger.warn('StudioSidecarCoordinator', `Task failed: ${msg.error}`);
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
        Logger.error('StudioSidecarCoordinator', 'Error in warmed listener', err);
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
        targetEntity: payload.targetEntity as any,
        timeline: new Map(),
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
    } satisfies SidecarWorkerMessage);
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
          } satisfies SidecarWorkerMessage);
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
                targetEntity: track as unknown as Record<string, unknown>,
                modifier: { type: mod.type, params: mod.params || {} },
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

    for (const seq of sequences) {
      if (seq.modifiers) {
        const start = seq.startFrame ?? 0;
        const end = start + (seq.durationFrames ?? 0);
        const isNearPlayhead =
          prioritizedFrame >= start - lookaheadFrames &&
          prioritizedFrame <= end + lookaheadFrames;

        for (const mod of seq.modifiers) {
          const taskId = `seq:${seq.id}:${mod.type}`;
          tasks.push(
            this.executeModifier(
              {
                taskId,
                targetType: 'sequence',
                targetId: seq.id,
                targetEntity: seq as unknown as Record<string, unknown>,
                modifier: { type: mod.type, params: mod.params || {} },
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
      this.worker.postMessage({ type: 'RESET' } satisfies SidecarWorkerMessage);
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
