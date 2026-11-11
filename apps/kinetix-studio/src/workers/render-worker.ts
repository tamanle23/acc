// ============================================================================
// KINETIX STUDIO - DEDICATED OFFSCREENCANVAS RENDER WORKER (ECMA-429)
// Background WebCodecs 4K/60FPS video encoding with zero main-thread hitching,
// raw PCM audio sample multiplexing, and worker font lifecycle management.
// ============================================================================

import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  AudioSampleSource,
  AudioSample,
  canEncodeAudio,
} from 'mediabunny';
import { renderPosterComposition } from '@/engine/composition-engine';
import { computeChoreography } from '@/engine/choreography';
import { SafeCanvas2D } from '@/lib/safe-canvas-2d';
import { gltfMeshEngine, type Mesh3D } from '@/engine/webgpu/gltf-mesh-engine';
import type { StudioState } from '@/types/studio';

export interface WorkerFontPayload {
  family: string;
  buffer: ArrayBuffer;
}

export interface WorkerAudioPayload {
  channels: ArrayBuffer[];
  sampleRate: number;
  numberOfChannels: number;
  length: number;
}

export interface WorkerStartRenderPayload {
  state: StudioState;
  width: number;
  height: number;
  fps: number;
  fonts?: WorkerFontPayload[];
  audio?: WorkerAudioPayload;
  mesh?: Mesh3D;
}

let activeOutput: Output | null = null;
let isCancelled = false;

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'PING') {
    self.postMessage({ type: 'PONG' });
    return;
  }

  if (data.type === 'CANCEL') {
    isCancelled = true;
    if (activeOutput) {
      await activeOutput.cancel().catch(() => {});
      activeOutput = null;
    }
    self.postMessage({ type: 'CANCELLED' });
    return;
  }

  if (data.type === 'LOAD_FONTS') {
    const fonts = data.fonts as WorkerFontPayload[] | undefined;
    if (fonts && 'fonts' in self) {
      const fontSet = (self as unknown as { fonts: { add: (f: FontFace) => void } }).fonts;
      for (const f of fonts) {
        try {
          const fontFace = new FontFace(f.family, f.buffer);
          await fontFace.load();
          fontSet.add(fontFace);
        } catch (err) {
          console.warn(`[RenderWorker] Failed to register font ${f.family}:`, err);
        }
      }
    }
    self.postMessage({ type: 'FONTS_LOADED' });
    return;
  }

  if (data.type === 'START_RENDER') {
    isCancelled = false;
    const { state, width, height, fps, fonts, audio, mesh } = data.payload as WorkerStartRenderPayload;

    if (mesh) {
      gltfMeshEngine.setCustomMesh(mesh);
    }

    try {
      // 1. Ingest fonts into worker scope if provided
      if (fonts && fonts.length > 0 && 'fonts' in self) {
        const fontSet = (self as unknown as { fonts: { add: (f: FontFace) => void } }).fonts;
        for (const f of fonts) {
          try {
            const fontFace = new FontFace(f.family, f.buffer);
            await fontFace.load();
            fontSet.add(fontFace);
          } catch (err) {
            console.warn(`[RenderWorker] Font load warning: ${f.family}`, err);
          }
        }
      }

      // 2. Instantiate OffscreenCanvas and SafeCanvas2D
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to acquire 2d context on OffscreenCanvas in worker');
      }
      const sctx = new SafeCanvas2D(ctx);

      // 3. Configure Mediabunny Output
      const target = new BufferTarget();
      const output = new Output({
        target,
        format: new Mp4OutputFormat(),
      });
      activeOutput = output;

      const totalFrames = Math.max(24, Math.round(state.durationSec * fps));
      const pixelRate = width * height * fps;
      const videoBitrate = Math.min(35_000_000, Math.max(6_000_000, Math.round(pixelRate * 0.22)));

      const canvasSource = new CanvasSource(offscreen, {
        codec: 'avc',
        bitrate: videoBitrate,
      });
      output.addVideoTrack(canvasSource);

      // 4. Multiplex audio track from raw PCM if provided
      let audioSource: AudioSampleSource | null = null;
      if (audio && audio.channels.length > 0) {
        let chosenCodec: 'aac' | 'opus' = 'aac';
        if (typeof canEncodeAudio === 'function') {
          if (await canEncodeAudio('aac')) {
            chosenCodec = 'aac';
          } else if (await canEncodeAudio('opus')) {
            chosenCodec = 'opus';
          }
        }

        try {
          audioSource = new AudioSampleSource({
            codec: chosenCodec,
            bitrate: chosenCodec === 'aac' ? 320_000 : 192_000,
          });
          output.addAudioTrack(audioSource);
        } catch (audioErr) {
          console.warn('[RenderWorker] Audio track addition failed:', audioErr);
          audioSource = null;
        }
      }

      await output.start();

      // Encode audio sample if present
      if (audioSource && audio) {
        try {
          // Interleave or format planar float32 channels
          const totalSamples = audio.length * audio.numberOfChannels;
          const interleavedData = new Float32Array(totalSamples);
          const channelViews = audio.channels.map((ch) => new Float32Array(ch));

          for (let i = 0; i < audio.length; i++) {
            for (let c = 0; c < audio.numberOfChannels; c++) {
              interleavedData[i * audio.numberOfChannels + c] = channelViews[c]![i] ?? 0;
            }
          }

          const sample = new AudioSample({
            data: interleavedData,
            format: 'f32',
            sampleRate: audio.sampleRate,
            numberOfChannels: audio.numberOfChannels,
            numberOfFrames: audio.length,
            timestamp: 0,
          });

          await audioSource.add(sample);
          sample.close();
        } catch (err) {
          console.warn('[RenderWorker] Audio sample encoding failed:', err);
        }
      }

      // 5. Frame rendering loop
      for (let f = 0; f < totalFrames; f++) {
        if (isCancelled) {
          await output.cancel().catch(() => {});
          activeOutput = null;
          return;
        }

        const progress = f / totalFrames;
        const choreo = computeChoreography(
          progress,
          state.timelineMode,
          state.hicksLawDisclosure,
          state.customKeyframes,
          state.choreoMode
        );

        renderPosterComposition(sctx, {
          width,
          height,
          state,
          frame: f,
          totalFrames,
          choreo,
          scale: 1,
        });

        await canvasSource.add(f / fps, 1 / fps);

        const pct = Math.round(((f + 1) / totalFrames) * 95);
        self.postMessage({
          type: 'PROGRESS',
          pct,
          currentFrame: f + 1,
          totalFrames,
        });
      }

      await output.finalize();
      activeOutput = null;

      const buffer = target.buffer;
      if (!buffer || buffer.byteLength === 0) {
        throw new Error('Mediabunny worker output buffer is empty');
      }

      (self as unknown as { postMessage: (msg: unknown, transfer?: Transferable[]) => void }).postMessage(
        {
          type: 'COMPLETE',
          buffer,
          durationSec: state.durationSec,
          width,
          height,
          fps,
        },
        [buffer]
      );
    } catch (err) {
      console.error('[RenderWorker] Render error:', err);
      self.postMessage({
        type: 'ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
