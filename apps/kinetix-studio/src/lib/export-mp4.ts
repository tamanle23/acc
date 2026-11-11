// ============================================================================
// KINETIX STUDIO v5.0 - HARDWARE-ACCELERATED MP4 EXPORTER VIA MEDIABUNNY / WEBCODECS
// Synchronously renders canvas frames and multiplexes with audio into a universally
// compatible H.264/AAC .mp4 file entirely in browser memory.
// ============================================================================

import type { StudioState } from '@/types/studio';
import { getBaseExportDimensions, downloadBlob } from './export-video';
import { computeChoreography } from '@/engine/choreography';
import { renderPosterComposition } from '@/engine/composition-engine';
import { userAudioTrack } from '@/engine/audio-user-track';
import { resolveExportAudioBuffer } from './export-audio';
export { resolveExportAudioBuffer } from './export-audio';
import {
  Output,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  AudioBufferSource,
  canEncodeAudio,
} from 'mediabunny';
import { WorkerExportAdapter } from '@/adapters/driven/worker-export-adapter';

export interface ExportMp4Options {
  state: StudioState;
  abortController: AbortController;
  fileHandle?: any;
  scale?: number;
  fps?: number;
  autoDownload?: boolean;
  useWorker?: boolean;
  onProgress: (pct: number, currentFrame?: number, totalFrames?: number) => void;
  onSuccess: (blob: Blob) => void;
  onCancel: () => void;
}

export async function exportCompositeVideoMp4(options: ExportMp4Options): Promise<Blob | null> {
  const { state, abortController, onProgress, onSuccess, onCancel } = options;

  const { width: targetW, height: targetH } = getBaseExportDimensions(state.aspectRatio);

  // Studio-grade resolution (1x = 1080p, 2x = 4K UHD); ensure even macroblock dimensions for AVC
  const scale = Math.max(0.25, Math.min(4, options.scale ?? 1));
  const compW = Math.round((targetW * scale) / 2) * 2;
  const compH = Math.round((targetH * scale) / 2) * 2;
  const fps = options.fps ?? state.fps ?? 30;
  const totalFrames = Math.max(24, Math.round(state.durationSec * fps));

  // Attempt background Web Worker hardware encoding if supported and requested
  const workerAdapter = new WorkerExportAdapter();
  if (options.useWorker !== false && workerAdapter.isSupported()) {
    try {
      const audioBuf = await resolveExportAudioBuffer(state);
      const audioChannels: Float32Array[] = [];
      if (audioBuf) {
        for (let c = 0; c < audioBuf.numberOfChannels; c++) {
          audioChannels.push(audioBuf.getChannelData(c));
        }
      }

      const result = await workerAdapter.encodeVideo({
        state,
        width: compW,
        height: compH,
        fps,
        scale,
        audioChannels,
        audioSampleRate: audioBuf?.sampleRate ?? 44100,
        onProgress: (pct, cur, tot) => onProgress(pct, cur, tot),
        abortSignal: abortController.signal,
      });

      if (result && result.blob) {
        const filename = `${state.posterId}-${state.aspectRatio.replace(':', 'x')}.mp4`;
        if (options.fileHandle) {
          try {
            const writable = await options.fileHandle.createWritable();
            await writable.write(result.blob);
            await writable.close();
          } catch (fileErr) {
            console.warn('Failed saving to file handle:', fileErr);
          }
        } else if (options.autoDownload !== false) {
          downloadBlob(result.blob, filename);
        }
        onProgress(100, totalFrames, totalFrames);
        onSuccess(result.blob);
        return result.blob;
      }
    } catch (workerErr) {
      console.warn('Worker export fell back to main thread:', workerErr);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = compW;
  canvas.height = compH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    onCancel();
    return null;
  }

  // Dynamic video bitrate proportional to pixel area and frame rate
  const pixelRate = compW * compH * fps;
  const videoBitrate = Math.min(35_000_000, Math.max(6_000_000, Math.round(pixelRate * 0.22)));

  // Check WebCodecs availability
  const hasWebCodecs =
    typeof window !== 'undefined' &&
    'VideoEncoder' in window &&
    typeof VideoFrame !== 'undefined';

  try {
    // Attempt Mediabunny WebCodecs hardware encoding pipeline
    if (hasWebCodecs) {
      try {
        const output = new Output({
          target: new BufferTarget(),
          format: new Mp4OutputFormat(),
        });

        const canvasSource = new CanvasSource(canvas, {
          codec: 'avc',
          bitrate: videoBitrate,
        });
        output.addVideoTrack(canvasSource);

        // Multiplex user audio or deterministic offline synth track
        const audioBuf = await resolveExportAudioBuffer(state);
        let audioSource: AudioBufferSource | null = null;
        if (audioBuf) {
          let chosenCodec: 'aac' | 'opus' | null = null;
          if (typeof canEncodeAudio === 'function') {
            if (await canEncodeAudio('aac')) {
              chosenCodec = 'aac';
            } else if (await canEncodeAudio('opus')) {
              chosenCodec = 'opus';
            }
          } else {
            chosenCodec = 'aac';
          }

          if (chosenCodec) {
            try {
              audioSource = new AudioBufferSource({
                codec: chosenCodec,
                bitrate: chosenCodec === 'aac' ? 320_000 : 192_000,
              });
              output.addAudioTrack(audioSource);
            } catch (trackErr) {
              console.warn(`Could not add ${chosenCodec} track to Mediabunny:`, trackErr);
              audioSource = null;
            }
          }

          // If audio exists but WebCodecs cannot encode it in MP4, throw to trigger high-fidelity MediaRecorder pipeline
          if (!audioSource) {
            throw new Error('Platform WebCodecs AudioEncoder unavailable for MP4; cascading to MediaRecorder');
          }
        }

        await output.start();

        if (audioSource && audioBuf) {
          await audioSource.add(audioBuf);
        }

        for (let f = 0; f < totalFrames; f++) {
          if (abortController.signal.aborted) {
            await output.cancel().catch(() => {});
            onCancel();
            return null;
          }

          const progress = f / totalFrames;
          const choreo = computeChoreography(
            progress,
            state.timelineMode,
            state.hicksLawDisclosure,
            state.customKeyframes,
            state.choreoMode
          );
          const timeSec = progress * state.durationSec;
          const telemetry =
            state.audioSource === 'user-file'
              ? userAudioTrack.getTelemetryAtTime(timeSec)
              : undefined;

          renderPosterComposition(ctx, {
            width: compW,
            height: compH,
            state,
            frame: f,
            totalFrames,
            choreo,
            scale: 1,
            audioTelemetry: telemetry,
          });

          await canvasSource.add(f / fps, 1 / fps);
          onProgress(Math.round(((f + 1) / totalFrames) * 95), f + 1, totalFrames);
        }

        await output.finalize();
        const buffer = (output.target as BufferTarget).buffer;
        if (!buffer || buffer.byteLength === 0) {
          throw new Error('Mediabunny output buffer is empty');
        }

        const mp4Blob = new Blob([buffer], { type: 'video/mp4' });
        const filename = `${state.posterId}-${state.aspectRatio.replace(':', 'x')}.mp4`;
        onProgress(100, totalFrames, totalFrames);

        if (options.fileHandle) {
          try {
            const writable = await options.fileHandle.createWritable();
            await writable.write(mp4Blob);
            await writable.close();
            onSuccess(mp4Blob);
            return mp4Blob;
          } catch (writeErr) {
            console.warn('Writing to fileHandle failed, falling back to downloadBlob:', writeErr);
          }
        }

        if (options.autoDownload) {
          downloadBlob(mp4Blob, filename);
        }
        onSuccess(mp4Blob);
        return mp4Blob;
      } catch (e) {
        console.warn('Mediabunny WebCodecs MP4 pipeline failed, falling back to MediaRecorder:', e);
      }
    }

    // High-Compatibility Fallback: MediaRecorder pipeline with MIME parity
    return await fallbackMediaRecorderMp4(canvas, ctx, options, compW, compH);
  } catch (err) {
    console.error('MP4 Export failed:', err);
    onCancel();
    return null;
  }
}

async function fallbackMediaRecorderMp4(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: ExportMp4Options,
  w: number,
  h: number
): Promise<Blob | null> {
  const { state, abortController, onProgress, onSuccess, onCancel } = options;
  const fps = options.fps ?? state.fps ?? 30;
  const totalFrames = Math.max(24, Math.round(state.durationSec * fps));

  // Mount hidden canvas (not opacity:0, but tiny in viewport so compositor updates)
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.bottom = '0px';
  container.style.right = '0px';
  container.style.width = '2px';
  container.style.height = '2px';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-999';
  container.appendChild(canvas);
  document.body.appendChild(container);

  try {
    const isMp4Aac =
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2');
    const isMp4 =
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1');
    const isWebmH264Opus =
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus');
    const isWebmH264 =
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('video/webm;codecs=h264');
    const isWebmOpus =
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus');
    const isWebmVp9 =
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('video/webm;codecs=vp9');

    const mimeType = isMp4Aac
      ? 'video/mp4;codecs=avc1,mp4a.40.2'
      : isMp4
      ? 'video/mp4;codecs=avc1'
      : isWebmH264Opus
      ? 'video/webm;codecs=h264,opus'
      : isWebmOpus
      ? 'video/webm;codecs=vp9,opus'
      : isWebmH264
      ? 'video/webm;codecs=h264'
      : isWebmVp9
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';

    // Multiplex user audio or synthetic silent track if present
    let audioStreamTrack: MediaStreamTrack | null = null;
    let audioSourceNode: AudioBufferSourceNode | null = null;
    let liveAudioCtx: AudioContext | null = null;

    const audioBuf = await resolveExportAudioBuffer(state);
    if (typeof window !== 'undefined') {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        try {
          liveAudioCtx = new AudioCtxClass();
          if (liveAudioCtx.state === 'suspended') {
            await liveAudioCtx.resume().catch(() => {});
          }
          const audioDest = liveAudioCtx.createMediaStreamDestination();
          if (audioBuf) {
            audioSourceNode = liveAudioCtx.createBufferSource();
            audioSourceNode.buffer = audioBuf;
            audioSourceNode.loop = true;
            audioSourceNode.connect(audioDest);
          } else {
            const silentBuf = liveAudioCtx.createBuffer(
              1,
              liveAudioCtx.sampleRate * Math.max(1, state.durationSec),
              liveAudioCtx.sampleRate
            );
            audioSourceNode = liveAudioCtx.createBufferSource();
            audioSourceNode.buffer = silentBuf;
            audioSourceNode.connect(audioDest);
          }
          audioStreamTrack = audioDest.stream.getAudioTracks()[0] ?? null;
        } catch {}
      }
    }

    const canvasStream = canvas.captureStream(fps);
    const streamTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
    if (audioStreamTrack) {
      streamTracks.push(audioStreamTrack);
    }
    const combinedStream = new MediaStream(streamTracks);

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const completionPromise = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.onerror = (e) => reject(e);
    });

    recorder.start(100);
    if (audioSourceNode) {
      try {
        audioSourceNode.start(0);
      } catch {}
    }

    const frameIntervalMs = 1000 / fps;

    for (let f = 0; f < totalFrames; f++) {
      if (abortController.signal.aborted) {
        if (recorder.state === 'recording') recorder.stop();
        if (audioSourceNode) {
          try {
            audioSourceNode.stop();
          } catch {}
        }
        if (liveAudioCtx) {
          liveAudioCtx.close().catch(() => {});
        }
        onCancel();
        return null;
      }

      const progress = f / totalFrames;
      const choreo = computeChoreography(
        progress,
        state.timelineMode,
        state.hicksLawDisclosure,
        state.customKeyframes,
        state.choreoMode
      );
      const timeSec = progress * state.durationSec;
      const telemetry =
        state.audioSource === 'user-file'
          ? userAudioTrack.getTelemetryAtTime(timeSec)
          : undefined;

      renderPosterComposition(ctx, {
        width: w,
        height: h,
        state,
        frame: f,
        totalFrames,
        choreo,
        scale: 1,
        audioTelemetry: telemetry,
      });

      onProgress(Math.round(((f + 1) / totalFrames) * 95), f + 1, totalFrames);
      await new Promise((r) => setTimeout(r, frameIntervalMs));
    }

    await new Promise((r) => setTimeout(r, 150));

    if (recorder.state === 'recording') {
      recorder.stop();
    }
    if (audioSourceNode) {
      try {
        audioSourceNode.stop();
      } catch {}
    }
    if (liveAudioCtx) {
      liveAudioCtx.close().catch(() => {});
    }

    const blob = await completionPromise;
    const filename = `${state.posterId}-${state.aspectRatio.replace(':', 'x')}.${ext}`;
    onProgress(100, totalFrames, totalFrames);

    if (options.fileHandle) {
      try {
        const writable = await options.fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        onSuccess(blob);
        return blob;
      } catch (writeErr) {
        console.warn('Writing to fileHandle failed, falling back to downloadBlob:', writeErr);
      }
    }

    if (options.autoDownload) {
      downloadBlob(blob, filename);
    }
    onSuccess(blob);
    return blob;
  } catch (err) {
    console.error('MP4 Fallback failed:', err);
    onCancel();
    return null;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
