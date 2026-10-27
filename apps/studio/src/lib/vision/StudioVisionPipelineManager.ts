import {
  ContentCacheRegistry,
  UniversalLogger as Logger,
} from '@acc/core-isomorphic';
import { StudioPlayheadController } from '../playhead/StudioPlayheadController';
import { IRStateManager } from '../ir/irState';

export interface VisionTaskRequest {
  sequenceId: string;
  frame: number;
  mediaHash: string;
  imageBitmap: ImageBitmap;
  width: number;
  height: number;
  depthStrategy?: string;
  segmentationStrategy?: string;
}

export class StudioVisionPipelineManager {
  private static instance: StudioVisionPipelineManager | null = null;
  private worker: Worker | null = null;
  private isWarmedUp = false;
  private isProcessing = false;
  private queue: VisionTaskRequest[] = [];
  private unsubscribePlayhead: (() => void) | null = null;

  private constructor() {
    this.initWorker();
    this.scheduleIdleWarmup();
    this.attachPlayheadListener();
  }

  public static getInstance(): StudioVisionPipelineManager {
    if (!StudioVisionPipelineManager.instance) {
      StudioVisionPipelineManager.instance = new StudioVisionPipelineManager();
    }
    return StudioVisionPipelineManager.instance;
  }

  private initWorker(): void {
    if (typeof Worker === 'undefined') return;

    try {
      this.worker = new Worker(
        new URL('../../workers/visionWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent) => {
        const { type, sequenceId, frame, cacheKey, error } = event.data;
        if (type === 'WARMED_UP') {
          this.isWarmedUp = true;
          Logger.info('StudioVisionPipelineManager', 'Vision Worker eagerly warmed up on idle.');
        } else if (type === 'FRAME_PROCESSED') {
          Logger.debug(
            'StudioVisionPipelineManager',
            `Frame processed for sequence ${sequenceId} at frame ${frame} (${cacheKey})`
          );
          this.isProcessing = false;
          this.processNext();
        } else if (type === 'ERROR') {
          Logger.warn('StudioVisionPipelineManager', `Worker error: ${error}`);
          this.isProcessing = false;
          this.processNext();
        }
      };
    } catch (err: any) {
      Logger.warn(
        'StudioVisionPipelineManager',
        `Failed to initialize vision worker: ${err?.message || err}`
      );
    }
  }

  private scheduleIdleWarmup(): void {
    if (typeof window === 'undefined') return;

    const schedule = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 1000));
    schedule(() => {
      if (this.worker && !this.isWarmedUp) {
        Logger.info('StudioVisionPipelineManager', 'Scheduling eager idle warmup for ONNX runtime...');
        this.worker.postMessage({ type: 'WARMUP' });
      }
    });
  }

  private attachPlayheadListener(): void {
    const playhead = StudioPlayheadController.getInstance();
    this.unsubscribePlayhead = playhead.subscribeLowFrequency((frame, isPlaying) => {
      // Only trigger on-demand frame vision processing when playhead is paused/scrubbed
      if (!isPlaying) {
        this.onPlayheadIdle(frame);
      }
    });
  }

  private onPlayheadIdle(frame: number): void {
    const irState = IRStateManager.getInstance().getState();
    const sequences = irState.timeline?.sequences;
    if (!sequences) return;

    for (const seq of sequences.values()) {
      // Restrict Depth3D to image sequences with relevant modifier
      if (seq.type === 'image' && frame >= seq.startFrame && frame <= seq.endFrame) {
        const hasRelight = seq.modifiers?.some(
          (m: any) => m.type === 'vfx/depth_relighting' || m.type === 'vfx/depth3d'
        );
        if (hasRelight) {
          const cacheKey = `vision:${seq.id}:${frame}:${seq.assetId || 'direct'}`;
          ContentCacheRegistry.get().has(cacheKey).then((cached) => {
            if (!cached) {
              Logger.debug('StudioVisionPipelineManager', `Uncached active frame ${frame} on seq ${seq.id}`);
            }
          });
        }
      }
    }
  }

  public queueTask(task: VisionTaskRequest): void {
    this.queue.push(task);
    this.processNext();
  }

  private processNext(): void {
    if (this.isProcessing || this.queue.length === 0 || !this.worker) return;

    const task = this.queue.shift();
    if (!task) return;

    this.isProcessing = true;
    this.worker.postMessage(
      {
        type: 'PROCESS_FRAME',
        payload: {
          sequenceId: task.sequenceId,
          frame: task.frame,
          mediaHash: task.mediaHash,
          imageBitmap: task.imageBitmap,
          width: task.width,
          height: task.height,
          depthStrategy: task.depthStrategy,
          segmentationStrategy: task.segmentationStrategy,
        },
      },
      task.imageBitmap ? [task.imageBitmap] : []
    );
  }

  public dispose(): void {
    if (this.unsubscribePlayhead) {
      this.unsubscribePlayhead();
      this.unsubscribePlayhead = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.queue = [];
    StudioVisionPipelineManager.instance = null;
  }
}
