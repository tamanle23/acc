import { MediabunnyClientSink } from '@acc/core-web';
import { UniversalAudioMixer, DecodedPcmSource } from '@acc/ir';
import { IRPreviewEngine } from '../../renderer';
import { AssetTextureCache } from '../textures/AssetTextureCache';
import { AudioAssetCache } from '../audio/AudioAssetCache';
import { normalizeTracksList } from '../ir/studioTypes';
import type { IRState } from '../ir/irState';

export interface ClientExportSinkLike {
  initialize(config: {
    width: number;
    height: number;
    fps: number;
    format: 'mp4';
    codec: string;
    videoBitrate: number;
    enableAudio: boolean;
  }): Promise<void>;
  consumeFrame(frameIndex: number, rgba: Uint8Array): Promise<void>;
  finalize(audioMixResult?: unknown): Promise<{
    framesConsumed?: number;
    fileSizeBytes?: number;
    buffer?: Uint8Array | ArrayBuffer | null;
  }>;
  getBuffer?(): Uint8Array | ArrayBuffer | null;
}

export interface ClientExportOptions {
  irState: IRState;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  videoBitrate?: number;
  codec?: string;
  yieldEveryNFrames?: number;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  sinkFactory?: () => ClientExportSinkLike;
}

export interface ClientExportResult {
  cancelled: boolean;
  framesConsumed: number;
  fileSizeBytes: number;
  buffer: Uint8Array | ArrayBuffer | null;
}

/**
 * Yields control back to the browser main thread so React UI state updates
 * (progress bar, Cancel Export button clicks, animations) can flush without
 * freezing the tab during heavy frame-by-frame encoding.
 */
export async function yieldToMainThread(): Promise<void> {
  const g = globalThis as unknown as {
    scheduler?: { yield?: () => Promise<void> };
    requestAnimationFrame?: (cb: FrameRequestCallback) => number;
  };
  if (g.scheduler && typeof g.scheduler.yield === 'function') {
    await g.scheduler.yield();
    return;
  }
  if (typeof g.requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => {
      g.requestAnimationFrame!(() => resolve());
    });
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/**
 * Triggers a client-side browser download for an exported MP4 buffer.
 */
export function downloadExportedMp4(
  exportBuffer: Uint8Array | ArrayBuffer,
  filename = `video-ir-export-${Date.now()}.mp4`
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blobPart =
    exportBuffer instanceof Uint8Array
      ? (exportBuffer as unknown as BlobPart)
      : (new Uint8Array(exportBuffer) as unknown as BlobPart);
  const blob = new Blob([blobPart], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Enterprise Non-Blocking Client Export Orchestrator.
 * Encapsulates frame-by-frame canvas rasterization, lazy texture hydration,
 * stereo PCM audio mixing via UniversalAudioMixer, and Mediabunny MP4 muxing
 * with cooperative main-thread yielding and AbortSignal cancellation.
 */
export class ClientExportOrchestrator {
  static async exportToMp4(options: ClientExportOptions): Promise<ClientExportResult> {
    const {
      irState,
      width,
      height,
      fps,
      totalFrames,
      videoBitrate = 4_000_000,
      codec = 'avc1.42E01E',
      yieldEveryNFrames = 3,
      signal,
      onProgress,
      sinkFactory,
    } = options;

    onProgress?.(0);

    const sink: ClientExportSinkLike = sinkFactory ? sinkFactory() : new MediabunnyClientSink();
    await sink.initialize({
      width,
      height,
      fps,
      format: 'mp4',
      codec,
      videoBitrate,
      enableAudio: true,
    });

    let offscreenCanvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;

    if (typeof document !== 'undefined') {
      offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
      ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }

    const previewEngine = irState.timeline ? new IRPreviewEngine(irState.timeline) : null;
    const studioTextureCache = AssetTextureCache.getInstance();
    const assetsMap = irState.doc?.assets || {};
    const engineTextures = previewEngine ? previewEngine.getTextureCache() : null;

    const safeTotalFrames = Math.max(1, totalFrames);
    const yieldStride = Math.max(1, yieldEveryNFrames);

    for (let f = 0; f < safeTotalFrames; f++) {
      if (signal?.aborted) {
        console.warn('Client export cancelled by user.');
        return {
          cancelled: true,
          framesConsumed: f,
          fileSizeBytes: 0,
          buffer: null,
        };
      }

      let rgba: Uint8Array;
      if (ctx && offscreenCanvas) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        if (previewEngine && engineTextures) {
          const activeSeqs = irState.intervalTree?.queryActive(f) || [];
          for (const seq of activeSeqs) {
            if (seq.assetId) {
              const assetDef = assetsMap[seq.assetId];
              const assetSrc = assetDef?.src;
              const assetType = assetDef?.type;
              const seqStart = seq.startFrame ?? 0;
              const seqLocalTimeSec = Math.max(0, (f - seqStart) / fps);

              const visualAsset = studioTextureCache.getVisualAsset(
                seq.assetId,
                assetSrc,
                assetType === 'image' ? 'image' : 'video',
                seqLocalTimeSec
              );

              if (visualAsset.source) {
                engineTextures.set(seq.assetId, visualAsset.source);
              }
            }
          }

          previewEngine.renderFrame(f, ctx, {
            textureCache: engineTextures,
          });
        }

        const imgData = ctx.getImageData(0, 0, width, height);
        rgba = new Uint8Array(imgData.data.buffer);
      } else {
        rgba = new Uint8Array(width * height * 4).fill(0);
      }

      await sink.consumeFrame(f, rgba);
      onProgress?.(Math.round(((f + 1) / safeTotalFrames) * 85));

      // Yield to main thread periodically so UI remains 60fps responsive & Cancel works immediately
      if ((f + 1) % yieldStride === 0) {
        await yieldToMainThread();
      }
    }

    if (signal?.aborted) {
      return {
        cancelled: true,
        framesConsumed: safeTotalFrames,
        fileSizeBytes: 0,
        buffer: null,
      };
    }

    onProgress?.(90);
    await yieldToMainThread();

    // Mix timeline audio using UniversalAudioMixer
    let audioMixResult:
      | {
        totalSamples: number;
        sampleRate: number;
        channels: number;
        durationSeconds: number;
        buffer: Float32Array;
        pcmLeft: Float32Array;
        pcmRight: Float32Array;
      }
      | undefined = undefined;

    try {
      const resolvedTracks = normalizeTracksList(irState.timeline?.tracks);
      const audioTracks = resolvedTracks.filter((t) => t.type === 'audio');
      if (audioTracks.length > 0) {
        const sampleRate = 48000;
        const totalDurationSec = safeTotalFrames / fps;
        const totalSamples = Math.floor(totalDurationSec * sampleRate);
        const mixer = new UniversalAudioMixer([], sampleRate);

        for (const track of audioTracks) {
          const sequences = track.sequences || [];
          for (const seq of sequences) {
            const startSec = (seq.startFrame ?? 0) / fps;
            const durationSec = (seq.durationFrames ?? 30) / fps;
            const isVoice =
              track.id?.includes('voice') || seq.name?.toLowerCase().includes('voice');

            let audioSource: DecodedPcmSource | undefined;
            if (seq.assetId && assetsMap[seq.assetId]) {
              const assetDef = assetsMap[seq.assetId];
              let decoded = AudioAssetCache.getInstance().getAudioChannels(
                seq.assetId,
                assetDef.src
              );
              if (!decoded && assetDef.src) {
                try {
                  decoded = await AudioAssetCache.getInstance().fetchAndDecode(
                    seq.assetId,
                    assetDef.src
                  );
                } catch (e) {
                  console.warn(`[Export] Failed to decode audio for asset ${seq.assetId}:`, e);
                }
              }
              if (decoded) {
                audioSource = new DecodedPcmSource({
                  channels: decoded.channels,
                  sourceSampleRate: decoded.sampleRate,
                  sourceTrimStartSec: (seq.sourceTrim?.startFrame || 0) / fps,
                  loop:
                    track.id?.toLowerCase().includes('bgm') ||
                    track.name?.toLowerCase().includes('bgm'),
                });
              }
            }

            mixer.addClip({
              id: seq.id,
              type: isVoice ? 'voice' : 'bgm',
              startTimeSec: startSec,
              durationSec: durationSec,
              volume: 0.85,
              assetId: seq.assetId,
              audioSource,
              modifiers: seq.modifiers,
            });
          }
        }

        const mix = mixer.mixStereo(0, totalDurationSec);
        audioMixResult = {
          totalSamples,
          sampleRate,
          channels: 2,
          durationSeconds: totalDurationSec,
          buffer: new Float32Array(totalSamples * 2),
          pcmLeft: mix.left,
          pcmRight: mix.right,
        };
      }
    } catch (audioErr) {
      console.warn(
        'Audio mixing for export encountered an error, falling back to silent/video-only:',
        audioErr
      );
    }

    if (signal?.aborted) {
      return {
        cancelled: true,
        framesConsumed: safeTotalFrames,
        fileSizeBytes: 0,
        buffer: null,
      };
    }

    onProgress?.(95);
    const result = await sink.finalize(audioMixResult);
    onProgress?.(100);
    const exportBuffer = result.buffer || sink.getBuffer?.() || null;

    return {
      cancelled: false,
      framesConsumed: result.framesConsumed ?? safeTotalFrames,
      fileSizeBytes: result.fileSizeBytes || exportBuffer?.byteLength || 0,
      buffer: exportBuffer ?? null,
    };
  }
}
