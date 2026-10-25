import React from 'react';
import { WaveSurferWaveform } from './WaveSurferWaveform';

export interface AudioWaveformProps {
  id: string;
  durationFrames: number;
  width: number;
  height: number;
  color?: string;
  audioUrl?: string;
  fps?: number;
}

/**
 * AudioWaveform:
 * Uses WaveSurferWaveform (wavesurfer.js) with peak caching for audio visualization.
 */
export function AudioWaveform({
  id,
  durationFrames,
  width,
  height,
  color = 'rgba(255, 255, 255, 0.45)',
  audioUrl,
  fps = 30,
}: AudioWaveformProps) {
  return (
    <WaveSurferWaveform
      id={id}
      durationFrames={durationFrames}
      width={width}
      height={height}
      color={color}
      audioUrl={audioUrl}
      fps={fps}
    />
  );
}

export { WaveSurferWaveform };
