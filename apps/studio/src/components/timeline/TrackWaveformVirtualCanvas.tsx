import React, { useEffect, useRef, useMemo } from 'react';
import type { StudioSequence } from '../../lib/ir/studioTypes';
import { getCachedPeaks } from './WaveSurferWaveform';

export interface TrackWaveformVirtualCanvasProps {
  trackId: string;
  sequences: readonly StudioSequence[];
  viewportWidth: number;
  laneHeight?: number;
  scrollLeft: number;
  pixelsPerFrame: number;
  fps?: number;
  color?: string;
  className?: string;
}

/**
 * TrackWaveformVirtualCanvas:
 * Unified, virtualized 2D Canvas lane for audio tracks.
 * Replaces O(N) per-clip WaveSurfer DOM/Canvas instances with a single sticky viewport-sized <canvas>.
 * Implements deterministic frustum culling, LOD pyramid decimation, and single-path batch drawing.
 */
export function TrackWaveformVirtualCanvas({
  trackId,
  sequences,
  viewportWidth,
  laneHeight = 36,
  scrollLeft,
  pixelsPerFrame,
  fps = 30,
  color = 'rgba(52, 211, 153, 0.45)', // Emerald-400 theme
  className,
}: TrackWaveformVirtualCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Frustum Culling: Slices visible sequences in timeline viewport [F_start, F_end]
  const visibleSequences = useMemo(() => {
    if (pixelsPerFrame <= 0 || viewportWidth <= 0) return [];
    const fStart = Math.max(0, Math.floor(scrollLeft / pixelsPerFrame));
    const fEnd = Math.ceil((scrollLeft + viewportWidth) / pixelsPerFrame);

    return sequences.filter((seq) => {
      const seqStart = seq.startFrame;
      const seqEnd = seqStart + seq.durationFrames;
      return seqEnd >= fStart && seqStart <= fEnd;
    });
  }, [sequences, scrollLeft, viewportWidth, pixelsPerFrame]);

  // 2. High-Performance Batched 2D Canvas Draw Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewportWidth <= 0 || laneHeight <= 0) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const targetWidth = Math.max(1, Math.floor(viewportWidth * dpr));
    const targetHeight = Math.max(1, Math.floor(laneHeight * dpr));

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, viewportWidth, laneHeight);

    if (visibleSequences.length === 0 || pixelsPerFrame <= 0) {
      ctx.restore();
      return;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();

    const centerY = laneHeight / 2;
    const maxAmplitude = laneHeight * 0.42;
    const barSpacing = Math.max(2, Math.floor(2 * dpr));

    for (const seq of visibleSequences) {
      const clipStartPx = seq.startFrame * pixelsPerFrame;
      const clipWidthPx = seq.durationFrames * pixelsPerFrame;
      const screenStartPx = clipStartPx - scrollLeft;
      const screenEndPx = screenStartPx + clipWidthPx;

      const drawStart = Math.max(0, Math.floor(screenStartPx));
      const drawEnd = Math.min(viewportWidth, Math.ceil(screenEndPx));

      if (drawEnd <= drawStart) continue;

      const numBars = Math.max(10, Math.floor(clipWidthPx / barSpacing));
      const assetKey = seq.assetId || seq.id;
      const peaks = getCachedPeaks(assetKey, seq.durationFrames, numBars);

      if (!peaks || peaks.length === 0) continue;

      // Draw peaks mapped to visible screen interval
      for (let x = drawStart; x < drawEnd; x += barSpacing) {
        const progress = (x - screenStartPx) / clipWidthPx;
        const peakIndex = Math.min(peaks.length - 1, Math.max(0, Math.floor(progress * peaks.length)));
        const peak = peaks[peakIndex] || 0;
        const barHeight = Math.max(1, peak * maxAmplitude);

        ctx.moveTo(x, centerY - barHeight);
        ctx.lineTo(x, centerY + barHeight);
      }
    }

    ctx.stroke();
    ctx.restore();
  }, [visibleSequences, viewportWidth, laneHeight, scrollLeft, pixelsPerFrame, color, fps]);

  if (viewportWidth <= 0) return null;

  return (
    <div
      style={{
        position: 'sticky',
        left: 0,
        width: `${viewportWidth}px`,
        height: `${laneHeight}px`,
        pointerEvents: 'none',
      }}
      className={`absolute inset-y-0 z-0 overflow-hidden ${className || ''}`}
      data-testid={`track-waveform-canvas-${trackId}`}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${viewportWidth}px`,
          height: `${laneHeight}px`,
        }}
        className="block"
      />
    </div>
  );
}
