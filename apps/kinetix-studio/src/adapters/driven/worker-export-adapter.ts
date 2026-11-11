// ============================================================================
// KINETIX STUDIO - DRIVEN ADAPTER: WORKER EXPORT ADAPTER (ECMA-429)
// Manages dedicated Web Worker lifecycle, font binary shipping, raw PCM
// audio transfer, and fallback execution for background 4K video encoding.
// ============================================================================

import type {
  IVideoEncoderPort,
  VideoEncoderOptions,
  EncodedVideoResult,
} from '@/core/ports/driven/video-encoder.port';
import { gltfMeshEngine } from '@/engine/webgpu/gltf-mesh-engine';

export class WorkerExportAdapter implements IVideoEncoderPort {
  public readonly name = 'WorkerWebCodecsVideoEncoder';

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined'
    );
  }

  public async encodeVideo(options: VideoEncoderOptions): Promise<EncodedVideoResult | null> {
    if (!this.isSupported()) {
      return null;
    }

    const {
      state,
      width,
      height,
      fps,
      audioChannels,
      audioSampleRate = 44100,
      onProgress,
      abortSignal,
    } = options;

    return new Promise<EncodedVideoResult | null>((resolve, reject) => {
      let worker: Worker | null = null;
      try {
        worker = new Worker(
          new URL('../../workers/render-worker.ts', import.meta.url),
          { type: 'module' }
        );
      } catch (err) {
        console.warn('Worker instantiation failed, cascading to fallback:', err);
        resolve(null);
        return;
      }

      const cleanup = () => {
        if (worker) {
          worker.terminate();
          worker = null;
        }
      };

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          if (worker) {
            worker.postMessage({ type: 'CANCEL' });
            cleanup();
          }
          resolve(null);
        });
      }

      worker.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'PROGRESS') {
          if (onProgress) {
            onProgress(data.pct, data.currentFrame, data.totalFrames);
          }
        } else if (data.type === 'COMPLETE') {
          const buffer = data.buffer as ArrayBuffer;
          const blob = new Blob([buffer], { type: 'video/mp4' });
          cleanup();
          resolve({
            blob,
            buffer,
            durationSec: data.durationSec ?? state.durationSec,
            mimeType: 'video/mp4',
            width: data.width ?? width,
            height: data.height ?? height,
          });
        } else if (data.type === 'ERROR') {
          cleanup();
          reject(new Error(data.error || 'Worker render failure'));
        } else if (data.type === 'CANCELLED') {
          cleanup();
          resolve(null);
        }
      };

      worker.onerror = (errEvent) => {
        console.error('Worker runtime error:', errEvent);
        cleanup();
        reject(new Error('Render worker terminated with an error'));
      };

      // Extract raw PCM channel ArrayBuffers for zero-copy transfer
      const transferList: Transferable[] = [];
      let workerAudioPayload: {
        channels: ArrayBuffer[];
        sampleRate: number;
        numberOfChannels: number;
        length: number;
      } | undefined = undefined;

      if (audioChannels && audioChannels.length > 0) {
        const channelBuffers: ArrayBuffer[] = audioChannels.map((c) => {
          const uint8 = new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
          const copy = new Uint8Array(uint8.length);
          copy.set(uint8);
          transferList.push(copy.buffer);
          return copy.buffer;
        });

        workerAudioPayload = {
          channels: channelBuffers,
          sampleRate: audioSampleRate,
          numberOfChannels: audioChannels.length,
          length: audioChannels[0]!.length,
        };
      }

      // Extract custom 3D mesh if present (via safe cloning to preserve main thread buffers)
      const customMesh = gltfMeshEngine.getCustomMesh();
      const workerMeshPayload = customMesh
        ? {
            vertices: new Float32Array(customMesh.vertices),
            indices:
              customMesh.indices instanceof Uint32Array
                ? new Uint32Array(customMesh.indices)
                : new Uint16Array(customMesh.indices),
          }
        : undefined;

      // Dispatch START_RENDER to worker
      worker.postMessage(
        {
          type: 'START_RENDER',
          payload: {
            state,
            width,
            height,
            fps,
            audio: workerAudioPayload,
            mesh: workerMeshPayload,
          },
        },
        transferList
      );
    });
  }
}
