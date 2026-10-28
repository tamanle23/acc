// Defensive worker environment polyfill to avoid runtime errors from Vite HMR / React Refresh
if (typeof self !== 'undefined' && typeof (self as any).window === 'undefined') {
  (self as any).window = self;
}

import { bootstrapCoreWeb } from '@acc/core-web';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  type ModifierContext,
} from '@acc/ir';
import { VisionEngineRegistry } from '@acc/core-isomorphic';
import type {
  WorkerMessage,
  WorkerResponse,
} from './SidecarTypes';

// Bootstrap isomorphic client runtime inside worker context
bootstrapCoreWeb();

const registry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
const canceledTaskIds = new Set<string>();

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (!message || !message.type) return;

  switch (message.type) {
    case 'WARMUP': {
      try {
        const depthStrategy = VisionEngineRegistry.getDepthStrategy();
        if (typeof (depthStrategy as any).init === 'function') {
          await (depthStrategy as any).init();
        }
        const segStrategy = VisionEngineRegistry.getSegmentationStrategy();
        if (typeof (segStrategy as any).init === 'function') {
          await (segStrategy as any).init();
        }
        self.postMessage({ type: 'WARMED_UP' } satisfies WorkerResponse);
      } catch (err: any) {
        self.postMessage({
          type: 'ERROR',
          error: `[SidecarWorker:Warmup] ${err?.message || err}`,
        } satisfies WorkerResponse);
      }
      break;
    }

    case 'CANCEL_TASK': {
      canceledTaskIds.add(message.taskId);
      self.postMessage({
        type: 'TASK_CANCELED',
        taskId: message.taskId,
        targetId: message.targetId,
      } satisfies WorkerResponse);
      break;
    }

    case 'RESET': {
      canceledTaskIds.clear();
      break;
    }

    case 'EXECUTE_MODIFIER': {
      const { payload } = message;
      if (!payload) return;

      if (canceledTaskIds.has(payload.taskId)) {
        canceledTaskIds.delete(payload.taskId);
        self.postMessage({
          type: 'TASK_CANCELED',
          taskId: payload.taskId,
          targetId: payload.targetId,
        } satisfies WorkerResponse);
        return;
      }

      try {
        const plugin = registry.get(payload.modifier.type);
        const context: ModifierContext = {
          targetType: payload.targetType,
          targetEntity: payload.targetEntity as any,
          timeline: new Map(),
          fps: payload.fps,
          canvas: payload.canvas,
          assets: payload.assets,
        };

        if (plugin && typeof plugin.execute === 'function') {
          await plugin.execute(context, payload.modifier.params);
        }

        if (canceledTaskIds.has(payload.taskId)) {
          canceledTaskIds.delete(payload.taskId);
          self.postMessage({
            type: 'TASK_CANCELED',
            taskId: payload.taskId,
            targetId: payload.targetId,
          } satisfies WorkerResponse);
          return;
        }

        self.postMessage({
          type: 'MODIFIER_EXECUTED',
          taskId: payload.taskId,
          targetId: payload.targetId,
          modifierType: payload.modifier.type,
          state: context.state,
        } satisfies WorkerResponse);
      } catch (err: any) {
        self.postMessage({
          type: 'ERROR',
          taskId: payload.taskId,
          targetId: payload.targetId,
          error: `[SidecarWorker:Execute] ${err?.message || err}`,
        } satisfies WorkerResponse);
      }
      break;
    }
  }
};
