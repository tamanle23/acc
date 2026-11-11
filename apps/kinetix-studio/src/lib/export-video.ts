// ============================================================================
// KINETIX STUDIO v4.0 - DETERMINISTIC EXPORT PIPELINE
// High-DPI Snapshots (1x, 2x 4K Retina, 4x Print Master 300 DPI)
// WebCodecs / MediaRecorder Video Capture with Synchronous Web Audio Multiplexing
// ============================================================================

import type { StudioState } from '@/types/studio';
import { renderPosterComposition } from '@/engine/composition-engine';
import { computeChoreography } from '@/engine/choreography';
import { AnalogAudioSynth } from '@/engine/audio-synth';
import { userAudioTrack } from '@/engine/audio-user-track';
import { resolveExportAudioBuffer } from './export-audio';

export type ExportResolutionScale = 1 | 2 | 4;

export interface ExportSnapshotOptions {
  state: StudioState;
  ambientCanvas?: HTMLCanvasElement;
  heroCanvas?: HTMLCanvasElement;
  masterCanvas?: HTMLCanvasElement;
  scale?: ExportResolutionScale; // 1x = 1080p, 2x = 4K, 4x = Print Master
  frame?: number;
  fileHandle?: any;
  autoDownload?: boolean;
}

export interface VideoRecordOptions {
  state: StudioState;
  ambientCanvas?: HTMLCanvasElement;
  heroCanvas?: HTMLCanvasElement;
  masterCanvas?: HTMLCanvasElement;
  synth?: AnalogAudioSynth;
  bitrate?: number;
  scale?: number;
  fileHandle?: any;
  autoDownload?: boolean;
  onProgress: (pct: number) => void;
  onSuccess: (blob?: Blob) => void;
  onCancel: () => void;
  abortController: AbortController;
}

/**
 * Returns canonical pixel dimensions for any aspect ratio.
 */
export function getBaseExportDimensions(ratio: string): { width: number; height: number } {
  switch (ratio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '4:5':
      return { width: 1080, height: 1350 };
    case '16:9':
      return { width: 1920, height: 1080 };
    case '1:1':
    default:
      return { width: 1080, height: 1080 };
  }
}

/**
 * Multi-Resolution High-DPI Composite Snapshot Exporter (PNG)
 * 100% Pixel-for-Pixel Identical to Live Studio Viewport Stage
 */
export async function exportSnapshotPng(
  stateOrOptions: StudioState | ExportSnapshotOptions,
  _ambientCanvasArg?: HTMLCanvasElement,
  _heroCanvasArg?: HTMLCanvasElement
): Promise<Blob | null> {
  let state: StudioState;
  let scale: ExportResolutionScale = 1;
  let frame = 0;

  if ('state' in stateOrOptions) {
    state = stateOrOptions.state;
    scale = stateOrOptions.scale ?? 1;
    frame = stateOrOptions.frame ?? 0;
  } else {
    state = stateOrOptions;
  }

  // Ensure fonts are ready before rasterizing
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  const { width: baseWidth, height: baseHeight } = getBaseExportDimensions(state.aspectRatio);
  const out = document.createElement('canvas');
  out.width = baseWidth * scale;
  out.height = baseHeight * scale;
  const rawCtx = out.getContext('2d');
  if (!rawCtx) return null;

  const totalFrames = Math.max(24, Math.round(state.durationSec * state.fps));
  const progress = totalFrames > 0 ? (frame % totalFrames) / totalFrames : 0;
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

  renderPosterComposition(rawCtx, {
    width: baseWidth,
    height: baseHeight,
    state,
    frame,
    totalFrames,
    choreo,
    scale,
    audioTelemetry: telemetry,
  });

  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  const scaleSuffix = scale > 1 ? `@${scale}x` : '';
  const filename = `${state.posterId}-${state.aspectRatio.replace(':', 'x')}${scaleSuffix}.png`;

  if (!blob) {
    const dataUrl = out.toDataURL('image/png');
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 10000);
    return null;
  }

  const autoDownload =
    typeof stateOrOptions === 'object' && 'autoDownload' in stateOrOptions
      ? Boolean(stateOrOptions.autoDownload)
      : false;

  const fileHandle =
    typeof stateOrOptions === 'object' && 'fileHandle' in stateOrOptions
      ? stateOrOptions.fileHandle
      : null;

  if (fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return blob;
    } catch {
      // Fall through to autoDownload check
    }
  }

  if (autoDownload) {
    downloadBlob(blob, filename);
  }
  return blob;
}

/**
 * Universally triggers a browser download by temporarily mounting an anchor element to the DOM.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 15000);
}

export interface SaveFilePickerOptions {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

/**
 * Prompts the native OS Save File modal dialog via the File System Access API
 * during a user gesture. Returns the file handle, 'cancelled' if aborted by user,
 * or null if the API is unsupported.
 */
export async function requestSaveFileHandle(
  options: SaveFilePickerOptions
): Promise<any | null | 'cancelled'> {
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: options.suggestedName,
        types: options.types,
      });
      return handle;
    } catch (err: any) {
      if (err && err.name === 'AbortError') {
        return 'cancelled';
      }
      return null;
    }
  }
  return null;
}

/**
 * Safely escapes arbitrary text for embedding into XML/SVG text nodes or attributes.
 * Strips invalid XML 1.0 control characters and encodes &, <, >, ", and '.
 * Conforms to W3C XML 1.0 section 2.4 standards.
 */
export function escapeXml(str: unknown): string {
  if (str == null) return '';
  return String(str)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u0084\u0086-\u009F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates pure self-contained Scalable Vector Graphics (SVG) markup
 */
export function generatePosterSvgString(state: StudioState): string {
  const { width: w, height: h } = getBaseExportDimensions(state.aspectRatio);

  const bg = escapeXml(state.palette?.bg || '#08090c');
  const surface = escapeXml(state.palette?.surface || '#12151c');
  const ink = escapeXml(state.palette?.ink || '#f4f5f8');
  const accent = escapeXml(state.palette?.accent || '#00f0ff');
  const accent2 = escapeXml(state.palette?.accent2 || '#ff0055');

  const subheadText = escapeXml(state.content?.subhead || '');
  const dateLocationText = escapeXml(`${state.content?.date || ''} // ${state.content?.location || ''}`);
  const sponsorText = escapeXml(state.content?.sponsor || '');
  const tagText = state.content?.tag ? escapeXml(state.content.tag.toUpperCase()) : '';

  const headlineYStart = state.topHeadlineFlow ? 180 : Math.round(h * 0.65);
  const headlineLineHeight = Math.round(w * 0.088);
  const headlineFontSize = Math.round(w * 0.085);

  const headlineLines = Array.isArray(state.content?.headline) ? state.content.headline : [];
  const headlineSvg = headlineLines
    .map(
      (line, i) =>
        `<text x="72" y="${headlineYStart + i * headlineLineHeight}" font-family="'Syne', sans-serif" font-weight="900" font-size="${headlineFontSize}" fill="${
          i === 1 ? accent : ink
        }" letter-spacing="-1">${escapeXml(line)}</text>`
    )
    .join('\n    ');

  // Tag Badge Pill
  const tagBadgeSvg = tagText
    ? `
  <!-- CTA Badge Pill -->
  <g id="cta-badge">
    <rect x="${w - 72 - 140}" y="58" width="140" height="28" rx="6" fill="${accent}"/>
    <text x="${w - 72 - 70}" y="77" font-family="'Space Mono', monospace" font-size="12" font-weight="700" fill="${bg}" text-anchor="middle" letter-spacing="1.5">${tagText}</text>
  </g>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <style type="text/css"><![CDATA[
      @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&family=Syne:wght@700;800;900&display=swap');
      text {
        user-select: none;
      }
    ]]></style>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${surface}"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bgGrad)"/>
  
  <!-- Outer Margin Frame & Grid -->
  <rect x="36" y="36" width="${w - 72}" height="${h - 72}" fill="none" stroke="${ink}" stroke-opacity="0.15" stroke-dasharray="8 6"/>
  <line x1="72" y1="104" x2="${w - 72}" y2="104" stroke="${ink}" stroke-opacity="0.12" stroke-width="1"/>
  
  <!-- Subhead Header Lockup -->
  <text x="72" y="80" font-family="'Space Mono', monospace" font-size="20" font-weight="700" fill="${accent}" letter-spacing="3">${subheadText}</text>
  ${tagBadgeSvg}

  <!-- Geometric Decorative Motifs -->
  <circle cx="${w / 2}" cy="${Math.round(h * 0.44)}" r="180" fill="none" stroke="${accent2}" stroke-opacity="0.3" stroke-width="2" stroke-dasharray="4 4"/>
  <circle cx="${w / 2}" cy="${Math.round(h * 0.44)}" r="12" fill="${accent}"/>
  <line x1="${w / 2 - 200}" y1="${Math.round(h * 0.44)}" x2="${w / 2 + 200}" y2="${Math.round(h * 0.44)}" stroke="${ink}" stroke-opacity="0.08" stroke-width="1"/>
  <line x1="${w / 2}" y1="${Math.round(h * 0.44) - 200}" x2="${w / 2}" y2="${Math.round(h * 0.44) + 200}" stroke="${ink}" stroke-opacity="0.08" stroke-width="1"/>

  <!-- Headline Kinetic Lockup -->
  <g id="headline-lockup">
    ${headlineSvg}
  </g>

  <!-- Footer Metadata & Billing Block -->
  <line x1="72" y1="${h - 130}" x2="${w - 72}" y2="${h - 130}" stroke="${ink}" stroke-opacity="0.12" stroke-width="1"/>
  <text x="72" y="${h - 96}" font-family="'Space Mono', monospace" font-size="24" font-weight="700" fill="${ink}">${dateLocationText}</text>
  <text x="72" y="${h - 58}" font-family="'Space Mono', monospace" font-size="16" font-weight="500" fill="${accent}">${sponsorText}</text>
</svg>`;
}

/**
 * Scalable Vector Graphics (SVG) Snapshot Exporter
 */
export async function exportPosterSvg(
  state: StudioState,
  fileHandle?: any,
  autoDownload = false
): Promise<Blob> {
  const svgContent = generatePosterSvgString(state);
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const filename = `${state.posterId}-${state.aspectRatio.replace(':', 'x')}.svg`;

  if (fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return blob;
    } catch {
      // Fall through to downloadBlob check
    }
  }

  if (autoDownload) {
    downloadBlob(blob, filename);
  }
  return blob;
}

/**
 * 1-Click Deterministic Composite Video Renderer with Synchronous Audio Multiplexing
 * (WinterTC / WHATWG MediaRecorder + AudioBufferSourceNode + Canvas2D Composition)
 */
export async function recordCompositeVideoWebm(options: VideoRecordOptions): Promise<Blob | null> {
  const {
    state,
    synth: _synth,
    bitrate = 8_000_000,
    onProgress,
    onSuccess,
    onCancel,
    abortController,
  } = options;

  // Await web font decoders
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  const { width: targetW, height: targetH } = getBaseExportDimensions(state.aspectRatio);

  // Scaled recording resolution: studio-grade unconstrained 1080p/4K even dimensions
  const scale = Math.max(0.25, Math.min(4, options.scale ?? 1));
  const compW = Math.round((targetW * scale) / 2) * 2;
  const compH = Math.round((targetH * scale) / 2) * 2;

  const compCanvas = document.createElement('canvas');
  compCanvas.width = compW;
  compCanvas.height = compH;
  const compCtx = compCanvas.getContext('2d');
  if (!compCtx) {
    onCancel();
    return null;
  }

  // Fallback to PNG snapshot if MediaRecorder is unavailable
  if (
    typeof compCanvas.captureStream !== 'function' ||
    typeof MediaRecorder === 'undefined'
  ) {
    const snapBlob = await exportSnapshotPng({
      state,
      scale: 1,
      fileHandle: options.fileHandle,
      autoDownload: options.autoDownload,
    });
    onSuccess(snapBlob ?? undefined);
    return snapBlob;
  }

  // Mount in a tiny non-culled container so Chromium compositor paints frames
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.bottom = '0px';
  container.style.right = '0px';
  container.style.width = '2px';
  container.style.height = '2px';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-999';
  container.appendChild(compCanvas);
  document.body.appendChild(container);

  // 1. Prepare Synchronous Audio Track via user audio file or offline analog synth
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
      } catch (err) {
        console.warn('AudioContext destination setup failed:', err);
      }
    }
  }

  return new Promise<Blob | null>((resolve) => {
    const totalFrames = Math.max(24, Math.round(state.durationSec * state.fps));
    const videoFps = state.fps;

    // 2. Prepare Combined MediaStream (Video + Audio)
    const canvasStream = compCanvas.captureStream(videoFps);
    const streamTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
    if (audioStreamTrack) {
      streamTracks.push(audioStreamTrack);
    }
    const combinedStream = new MediaStream(streamTracks);

    // Determine optimal codec (VP9 with Opus audio, fallback to VP8/WebM)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: bitrate || 8_000_000,
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
      if (audioSourceNode) {
        try {
          audioSourceNode.stop();
        } catch { }
      }
      if (liveAudioCtx) {
        liveAudioCtx.close().catch(() => { });
      }

      if (abortController.signal.aborted) {
        onCancel();
        resolve(null);
        return;
      }

      const blob = new Blob(chunks, { type: mimeType });
      const filename = `${state.posterId}-${state.aspectRatio.replace(':', 'x')}-loop.webm`;

      if (options.fileHandle) {
        options.fileHandle
          .createWritable()
          .then(async (writable: any) => {
            await writable.write(blob);
            await writable.close();
            onSuccess(blob);
            resolve(blob);
          })
          .catch(() => {
            if (options.autoDownload) {
              downloadBlob(blob, filename);
            }
            onSuccess(blob);
            resolve(blob);
          });
      } else {
        if (options.autoDownload) {
          downloadBlob(blob, filename);
        }
        onSuccess(blob);
        resolve(blob);
      }
    };

    recorder.start(100);
    if (audioSourceNode) {
      audioSourceNode.start(0);
    }

    // 3. Deterministic Frame-Stepping Loop
    const frameIntervalMs = 1000 / videoFps;
    let currentFrameIdx = 0;

    const renderFrameStep = () => {
      if (abortController.signal.aborted) {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
        if (recorder.state === 'recording') recorder.stop();
        resolve(null);
        return;
      }

      if (currentFrameIdx >= totalFrames) {
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }, 150);
        return;
      }

      // Render frame currentFrameIdx deterministically
      const progress = currentFrameIdx / totalFrames;
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

      renderPosterComposition(compCtx, {
        width: compW,
        height: compH,
        state,
        frame: currentFrameIdx,
        totalFrames,
        choreo,
        scale: 1,
        audioTelemetry: telemetry,
      });

      currentFrameIdx++;
      onProgress(Math.min(100, Math.round((currentFrameIdx / totalFrames) * 100)));

      setTimeout(renderFrameStep, frameIntervalMs);
    };

    // Begin first frame render
    renderFrameStep();
  });
}
