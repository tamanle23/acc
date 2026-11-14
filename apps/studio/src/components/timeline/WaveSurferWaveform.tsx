import { createEffect } from 'solid-js';
import { WebAudioEngine } from '../../lib/audio/WebAudioEngine';
import { AudioAssetCache } from '../../lib/audio/AudioAssetCache';
import { WaveformLODPyramid } from '../../lib/timeline/WaveformLODPyramid';

export interface WaveSurferWaveformProps {
  id: string;
  durationFrames: number;
  width: number;
  height: number;
  color?: string;
  audioUrl?: string;
  fps?: number;
}

// Global pyramid cache to provide multi-resolution LOD decimation with bounded LRU ceiling
const MAX_PYRAMID_CACHE_ENTRIES = 32;
const pyramidCache = new Map<string, { pyramid: WaveformLODPyramid; isDecodedPcm: boolean }>();

// Automatically invalidate procedural fallback pyramids when real audio finishes decoding
AudioAssetCache.getInstance().subscribe(() => {
  for (const [key, entry] of pyramidCache.entries()) {
    if (!entry.isDecodedPcm && AudioAssetCache.getInstance().getAudioChannels(key) !== null) {
      pyramidCache.delete(key);
    }
  }
});

export function getCachedPeaks(id: string, durationFrames: number, targetBars: number): Float32Array {
  const hasRealPcm = AudioAssetCache.getInstance().getAudioChannels(id) !== null;
  let cachedEntry = pyramidCache.get(id);

  if (!cachedEntry || (!cachedEntry.isDecodedPcm && hasRealPcm)) {
    const rawPeaks = WebAudioEngine.getInstance().getWaveformPeaks(id, durationFrames, Math.max(targetBars * 4, 320));
    const pyramid = new WaveformLODPyramid(rawPeaks);
    cachedEntry = { pyramid, isDecodedPcm: hasRealPcm };
    if (pyramidCache.size >= MAX_PYRAMID_CACHE_ENTRIES && !pyramidCache.has(id)) {
      const oldestId = pyramidCache.keys().next().value;
      if (oldestId !== undefined) {
        pyramidCache.delete(oldestId);
      }
    }
    pyramidCache.set(id, cachedEntry);
  } else {
    // Refresh LRU order
    pyramidCache.delete(id);
    pyramidCache.set(id, cachedEntry);
  }

  // Derive pixels per frame for LOD level selection and return zero-copy Float32Array view
  const pxPerFrame = targetBars > 0 && durationFrames > 0 ? (targetBars * 3) / durationFrames : 1.0;
  return cachedEntry.pyramid.selectLOD(pxPerFrame).peaks;
}

export function clearWaveSurferPeakCache(): void {
  pyramidCache.clear();
}

/**
 * WaveSurferWaveform:
 * Pure, high-performance HTML5 2D Canvas waveform renderer.
 * Eliminates heavy wavesurfer.js DOM/AudioContext overhead while preserving exact drop-in API parity.
 */
export function WaveSurferWaveform(props: WaveSurferWaveformProps) {
  let canvasRef: HTMLCanvasElement | undefined;

  createEffect(() => {
    const canvas = canvasRef;
    const width = props.width;
    const height = props.height;
    if (!canvas || width <= 0 || height <= 0) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const targetW = Math.max(1, Math.floor(width * dpr));
    const targetH = Math.max(1, Math.floor(height * dpr));

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const barWidth = 2;
    const barGap = 1;
    const barSpacing = barWidth + barGap;
    const numBars = Math.max(5, Math.floor(width / barSpacing));
    const peaks = getCachedPeaks(props.id, props.durationFrames, numBars);

    if (peaks && peaks.length > 0) {
      ctx.fillStyle = props.color ?? '#a855f7';
      const centerY = height / 2;
      const maxAmp = height * 0.42;

      for (let i = 0; i < peaks.length; i++) {
        const peak = peaks[i] || 0;
        const barH = Math.max(1, peak * maxAmp * 2);
        const x = i * barSpacing;
        if (x >= width) break;
        ctx.fillRect(x, centerY - barH / 2, barWidth, barH);
      }
    }

    ctx.restore();
  });

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${props.width}px`, height: `${props.height}px` }}
      class="absolute inset-0 pointer-events-none opacity-85 block"
    />
  );
}
