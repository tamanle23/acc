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
export function AudioWaveform(props: AudioWaveformProps) {
  return (
    <WaveSurferWaveform
      id={props.id}
      durationFrames={props.durationFrames}
      width={props.width}
      height={props.height}
      color={props.color ?? 'rgba(255, 255, 255, 0.45)'}
      audioUrl={props.audioUrl}
      fps={props.fps ?? 30}
    />
  );
}

export { WaveSurferWaveform };
