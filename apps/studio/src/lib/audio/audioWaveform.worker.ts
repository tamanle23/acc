// Defensive worker environment polyfill to avoid runtime errors from Vite HMR / React Refresh
if (typeof self !== 'undefined' && typeof (self as any).window === 'undefined') {
  (self as any).window = self;
}

/**
 * AudioWaveformWorker:
 * Dedicated background worker for asynchronous PCM decoding and multi-resolution LOD peak extraction.
 * Offloads CPU-intensive min/max decimation and sample iteration from the main thread.
 */

export interface WaveformWorkerRequest {
  id: string;
  durationFrames: number;
  targetBars: number;
  channelData?: Float32Array;
}

export interface WaveformWorkerResponse {
  id: string;
  durationFrames?: number;
  targetBars: number;
  peaks: Float32Array;
}

/**
 * Computes min/max decimated peaks from raw PCM Float32Array channel data.
 */
export function computePeaksFromPcm(channel: Float32Array, targetBars: number): Float32Array {
  const peaks = new Float32Array(targetBars);
  if (channel.length === 0 || targetBars <= 0) return peaks;

  const samplesPerBar = Math.floor(channel.length / targetBars);
  if (samplesPerBar <= 0) {
    // If fewer samples than bars, interpolate
    for (let i = 0; i < targetBars; i++) {
      const idx = Math.min(channel.length - 1, Math.floor((i / targetBars) * channel.length));
      peaks[i] = Math.max(0.05, Math.min(1.0, Math.abs(channel[idx])));
    }
    return peaks;
  }

  for (let i = 0; i < targetBars; i++) {
    let maxVal = 0;
    const start = i * samplesPerBar;
    const end = Math.min(channel.length, start + samplesPerBar);
    for (let s = start; s < end; s++) {
      const v = Math.abs(channel[s]);
      if (v > maxVal) maxVal = v;
    }
    peaks[i] = Math.max(0.05, Math.min(1.0, maxVal));
  }

  return peaks;
}

/**
 * Procedural fallback envelope generation when raw audio is loading or offline.
 */
export function generateProceduralEnvelope(id: string, targetBars: number): Float32Array {
  const peaks = new Float32Array(targetBars);
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }

  for (let i = 0; i < targetBars; i++) {
    const x = i / targetBars;
    const primaryEnvelope = Math.sin(x * Math.PI) * 0.7;
    const cadence = Math.abs(Math.sin(x * 12 + hash)) * 0.4;
    const noise = ((Math.sin(i * 997 + hash) + 1) / 2) * 0.2;
    peaks[i] = Math.max(0.1, Math.min(1.0, primaryEnvelope + cadence + noise));
  }

  return peaks;
}

// In Web Worker context: listen for incoming requests
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = (event: MessageEvent<WaveformWorkerRequest>) => {
    const { id, durationFrames, targetBars, channelData } = event.data;
    const peaks = channelData && channelData.length > 0
      ? computePeaksFromPcm(channelData, targetBars)
      : generateProceduralEnvelope(id, targetBars);

    const response: WaveformWorkerResponse = {
      id,
      durationFrames,
      targetBars,
      peaks,
    };

    // Transfer Float32Array buffer for zero-copy IPC
    (self as any).postMessage(response, [peaks.buffer]);
  };
}
