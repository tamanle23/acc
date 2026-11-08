import { createMemo, createEffect, Show } from 'solid-js';
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
  class?: string;
}

/**
 * TrackWaveformVirtualCanvas:
 * Unified, virtualized 2D Canvas lane for audio tracks.
 * Replaces O(N) per-clip WaveSurfer DOM/Canvas instances with a single sticky viewport-sized <canvas>.
 * Implements deterministic frustum culling, LOD pyramid decimation, and single-path batch drawing.
 */
export function TrackWaveformVirtualCanvas(props: TrackWaveformVirtualCanvasProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  const laneHeight = () => props.laneHeight ?? 36;
  const color = () => props.color ?? 'rgba(52, 211, 153, 0.45)';

  // 1. Frustum Culling: Slices visible sequences in timeline viewport [F_start, F_end]
  const visibleSequences = createMemo(() => {
    if (props.pixelsPerFrame <= 0 || props.viewportWidth <= 0) return [];
    const fStart = Math.max(0, Math.floor(props.scrollLeft / props.pixelsPerFrame));
    const fEnd = Math.ceil((props.scrollLeft + props.viewportWidth) / props.pixelsPerFrame);

    return props.sequences.filter((seq) => {
      const seqStart = seq.startFrame;
      const seqEnd = seqStart + seq.durationFrames;
      return seqEnd >= fStart && seqStart <= fEnd;
    });
  });

  // 2. High-Performance Batched 2D Canvas Draw Loop
  createEffect(() => {
    const canvas = canvasRef;
    const vWidth = props.viewportWidth;
    const lHeight = laneHeight();
    const ppf = props.pixelsPerFrame;
    const sLeft = props.scrollLeft;
    const seqs = visibleSequences();

    if (!canvas || vWidth <= 0 || lHeight <= 0) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const targetWidth = Math.max(1, Math.floor(vWidth * dpr));
    const targetHeight = Math.max(1, Math.floor(lHeight * dpr));

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, vWidth, lHeight);

    if (seqs.length === 0 || ppf <= 0) {
      ctx.restore();
      return;
    }

    ctx.strokeStyle = color();
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();

    const centerY = lHeight / 2;
    const maxAmplitude = lHeight * 0.42;
    const barSpacing = Math.max(2, Math.floor(2 * dpr));

    for (const seq of seqs) {
      const clipStartPx = seq.startFrame * ppf;
      const clipWidthPx = seq.durationFrames * ppf;
      const screenStartPx = clipStartPx - sLeft;
      const screenEndPx = screenStartPx + clipWidthPx;

      const drawStart = Math.max(0, Math.floor(screenStartPx));
      const drawEnd = Math.min(vWidth, Math.ceil(screenEndPx));

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
  });

  return (
    <Show when={props.viewportWidth > 0}>
      <div
        style={{
          position: 'sticky',
          left: 0,
          width: `${props.viewportWidth}px`,
          height: `${laneHeight()}px`,
          'pointer-events': 'none',
        }}
        class={`absolute inset-y-0 z-0 overflow-hidden ${props.class || ''}`}
        data-testid={`track-waveform-canvas-${props.trackId}`}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: `${props.viewportWidth}px`,
            height: `${laneHeight()}px`,
          }}
          class="block"
        />
      </div>
    </Show>
  );
}
