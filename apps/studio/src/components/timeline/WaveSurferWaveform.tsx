import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { WebAudioEngine } from '../../lib/audio/WebAudioEngine';

export interface WaveSurferWaveformProps {
  id: string;
  durationFrames: number;
  width: number;
  height: number;
  color?: string;
  audioUrl?: string;
  fps?: number;
}

// Global decoded peak cache to eliminate redundant audio peak decoding during scroll/zoom
const peakCache = new Map<string, number[]>();

export function getCachedPeaks(id: string, durationFrames: number, targetBars: number): number[] {
  const cacheKey = `${id}:${durationFrames}:${targetBars}`;
  if (peakCache.has(cacheKey)) {
    return peakCache.get(cacheKey)!;
  }

  const rawPeaks = WebAudioEngine.getInstance().getWaveformPeaks(id, durationFrames, targetBars);
  const peaksArray = Array.from(rawPeaks);
  peakCache.set(cacheKey, peaksArray);
  return peaksArray;
}

export function clearWaveSurferPeakCache(): void {
  peakCache.clear();
}

export function WaveSurferWaveform({
  id,
  durationFrames,
  width,
  height,
  color = '#a855f7',
  audioUrl,
  fps = 30,
}: WaveSurferWaveformProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || width <= 0 || height <= 0) return;

    const numBars = Math.max(10, Math.floor(width / 3));
    const peaks = getCachedPeaks(id, durationFrames, numBars);
    const durationSec = durationFrames / Math.max(1, fps);

    // Clean up prior instance if width/height changed
    if (waveSurferRef.current) {
      waveSurferRef.current.destroy();
      waveSurferRef.current = null;
    }

    try {
      const ws = WaveSurfer.create({
        container,
        waveColor: color,
        progressColor: color,
        height,
        width,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        peaks: [peaks],
        duration: durationSec,
        interact: false,
      });

      waveSurferRef.current = ws;
    } catch (err) {
      console.warn('WaveSurferWaveform: instantiation fallback:', err);
    }

    return () => {
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
    };
  }, [id, durationFrames, width, height, color, fps]);

  return (
    <div
      ref={containerRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="absolute inset-0 pointer-events-none opacity-85 overflow-hidden flex items-center"
    />
  );
}
