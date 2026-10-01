import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { FFmpegManager } from './FFmpegManager';
import { Logger } from './logger';
import path from 'path';

export interface SceneTaskPayload {
  sceneIndex: number;
  scene: any;
  duration: number;
  assPath: string | null;
  config: any;
  outputPath: string;
  fallbackImagePath: string;
  fallbackAudioPath: string;
  paddingTime: number;
  hasAnyTransition: boolean;
  is3D: boolean;
}

export interface SceneTaskResult {
  path: string;
  duration: number;
}

if (!isMainThread) {
  (async () => {
    try {
      if (workerData?.binDir) {
        FFmpegManager.setBinDir(workerData.binDir);
      } else {
        await FFmpegManager.prepare();
      }

      const { renderDepth3DScene } = await import('@acc/effect-engines');
      const { FFISceneEngine } = await import('./ffmpeg-ffi/FFISceneEngine');

      parentPort?.on('message', async (task: { type: string; data: SceneTaskPayload }) => {
        if (task.type === 'EXIT') {
          process.exit(0);
        }
        if (task.type === 'RENDER') {
          const { scene, duration, assPath, config, outputPath, fallbackImagePath, fallbackAudioPath, paddingTime, hasAnyTransition, is3D } = task.data;
          try {
            let result: SceneTaskResult;
            if (is3D) {
              try {
                result = await renderDepth3DScene({
                  scene,
                  duration,
                  assPath,
                  config,
                  outputPath,
                  fallbackAudioPath,
                  paddingTime,
                  useHighQualityIntermediate: hasAnyTransition
                });
              } catch (depthErr: any) {
                result = await FFISceneEngine.renderScene({
                  scene,
                  duration,
                  assPath,
                  config,
                  outputPath,
                  fallbackImagePath,
                  fallbackAudioPath,
                  paddingTime
                });
              }
            } else {
              result = await FFISceneEngine.renderScene({
                scene,
                duration,
                assPath,
                config,
                outputPath,
                fallbackImagePath,
                fallbackAudioPath,
                paddingTime
              });
            }

            parentPort?.postMessage({ type: 'SUCCESS', result });
          } catch (err: any) {
            parentPort?.postMessage({ type: 'ERROR', error: err.message || String(err) });
          }
        }
      });

      parentPort?.postMessage({ type: 'READY' });
    } catch (err: any) {
      parentPort?.postMessage({ type: 'INIT_ERROR', error: err.message || String(err) });
    }
  })();
}

export class SceneWorkerPool {
  private workers: Worker[] = [];
  private idleWorkers: Worker[] = [];
  private taskQueue: Array<{
    task: SceneTaskPayload;
    resolve: (res: SceneTaskResult) => void;
    reject: (err: any) => void;
  }> = [];

  constructor(private size: number, private binDir: string) {}

  public async initialize(): Promise<void> {
    const initPromises: Promise<void>[] = [];
    const workerScript = path.resolve(__filename);

    for (let i = 0; i < this.size; i++) {
      const p = new Promise<void>((resolve, reject) => {
        const worker = new Worker(workerScript, {
          workerData: { binDir: this.binDir }
        });

        const onReady = (msg: any) => {
          if (msg.type === 'READY') {
            this.workers.push(worker);
            this.idleWorkers.push(worker);
            resolve();
          } else {
            reject(new Error(msg.error || 'Worker initialization failed'));
          }
        };

        worker.once('message', onReady);
        worker.once('error', reject);
      });

      initPromises.push(p);
    }

    await Promise.all(initPromises);
  }

  public runTask(task: SceneTaskPayload): Promise<SceneTaskResult> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.dispatchNext();
    });
  }

  private dispatchNext() {
    if (this.idleWorkers.length === 0 || this.taskQueue.length === 0) return;

    const worker = this.idleWorkers.shift()!;
    const { task, resolve, reject } = this.taskQueue.shift()!;

    const onMessage = (msg: any) => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      this.idleWorkers.push(worker);
      this.dispatchNext();

      if (msg.type === 'SUCCESS') {
        resolve(msg.result);
      } else {
        reject(new Error(msg.error));
      }
    };

    const onError = (err: any) => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      reject(err);
    };

    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.postMessage({ type: 'RENDER', data: task });
  }

  public terminate() {
    for (const w of this.workers) {
      try {
        w.postMessage({ type: 'EXIT' });
      } catch {}
    }
    this.workers = [];
    this.idleWorkers = [];
  }
}
