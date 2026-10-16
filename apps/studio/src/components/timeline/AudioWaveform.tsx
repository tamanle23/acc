import React, { useEffect, useRef } from 'react';
import { WebAudioEngine } from '../../lib/audio/WebAudioEngine';

interface AudioWaveformProps {
  id: string;
  durationFrames: number;
  width: number;
  height: number;
  color?: string;
}

export function AudioWaveform({
  id,
  durationFrames,
  width,
  height,
  color = 'rgba(255, 255, 255, 0.4)',
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const numBars = Math.max(10, Math.floor(width / 4));
    const peaks = WebAudioEngine.getInstance().getWaveformPeaks(id, durationFrames, numBars);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;

    const barWidth = 2;
    const gap = (width - numBars * barWidth) / Math.max(1, numBars - 1);
    const midY = height / 2;

    for (let i = 0; i < numBars; i++) {
      const peak = peaks[i];
      const barHeight = Math.max(2, peak * (height * 0.8));
      const x = i * (barWidth + gap);
      const y = midY - barHeight / 2;

      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }, [id, durationFrames, width, height, color]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none opacity-80"
    />
  );
}
