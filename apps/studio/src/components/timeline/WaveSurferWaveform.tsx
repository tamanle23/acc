import React, { useEffect, useRef } from 'react';
import { WebAudioEngine } from '../../lib/audio/WebAudioEngine';
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
const pyramidCache = new Map<string, WaveformLODPyramid>();

export function getCachedPeaks(id: string, durationFrames: number, targetBars: number): number[] {
  let pyramid = pyramidCache.get(id);
  if (!pyramid) {
    const rawPeaks = WebAudioEngine.getInstance().getWaveformPeaks(id, durationFrames, Math.max(targetBars * 4, 320));
    pyramid = new WaveformLODPyramid(rawPeaks);
    if (pyramidCache.size >= MAX_PYRAMID_CACHE_ENTRIES && !pyramidCache.has(id)) {
      const oldestId = pyramidCache.keys().next().value;
      if (oldestId !== undefined) {
        pyramidCache.delete(oldestId);
      }
    }
    pyramidCache.set(id, pyramid);
  } else {
    // Refresh LRU order
    pyramidCache.delete(id);
    pyramidCache.set(id, pyramid);
  }

  // Derive pixels per frame for LOD level selection
  const pxPerFrame = targetBars > 0 && durationFrames > 0 ? (targetBars * 3) / durationFrames : 1.0;
  const lod = pyramid.selectLOD(pxPerFrame);
  return Array.from(lod.peaks);
}

export function clearWaveSurferPeakCache(): void {
  pyramidCache.clear();
}

/**
 * WaveSurferWaveform:
 * Pure, high-performance HTML5 2D Canvas waveform renderer.
 * Eliminates heavy wavesurfer.js DOM/AudioContext overhead while preserving exact drop-in API parity.
 */
export function WaveSurferWaveform({
  id,
  durationFrames,
  width,
  height,
  color = '#a855f7',
  fps = 30,
}: WaveSurferWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
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
    const peaks = getCachedPeaks(id, durationFrames, numBars);

    if (peaks && peaks.length > 0) {
      ctx.fillStyle = color;
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
  }, [id, durationFrames, width, height, color, fps]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="absolute inset-0 pointer-events-none opacity-85 block"
    />
  );
}
