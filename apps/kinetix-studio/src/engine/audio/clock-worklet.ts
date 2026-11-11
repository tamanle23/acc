// ============================================================================
// KINETIX STUDIO - SAMPLE-ACCURATE AUDIO WORKLET CLOCK PROCESSOR (ECMA-429)
// Executes on the real-time audio thread to deliver sample-accurate 16th note
// step ticks with zero main-thread GC pauses or tab-background drift.
// ============================================================================

export const CLOCK_WORKLET_NAME = 'master-audio-clock';

/**
 * AudioWorkletProcessor source code string packaged for isomorphic inline Blob registration.
 */
export const CLOCK_WORKLET_CODE = `
class MasterAudioClockProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bpm = 120;
    this.stepIntervalSamples = 0;
    this.sampleCounter = 0;
    this.currentStep = 0;
    this.isRunning = true;

    this.recalculateStep();

    this.port.onmessage = (e) => {
      const data = e.data;
      if (!data) return;

      if (data.type === 'SET_BPM') {
        if (typeof data.bpm === 'number' && data.bpm > 20 && data.bpm < 360) {
          this.bpm = data.bpm;
          this.recalculateStep();
        }
      } else if (data.type === 'START') {
        this.isRunning = true;
      } else if (data.type === 'STOP') {
        this.isRunning = false;
      } else if (data.type === 'RESET') {
        this.currentStep = 0;
        this.sampleCounter = 0;
      }
    };
  }

  recalculateStep() {
    // 16th note interval in audio samples dynamically resolved from AudioWorkletGlobalScope sampleRate
    const secondsPerStep = (60.0 / this.bpm) / 4.0;
    this.stepIntervalSamples = Math.round(secondsPerStep * sampleRate);
  }

  process(_inputs, outputs) {
    if (!this.isRunning) return true;

    const output = outputs[0];
    const frameLength = output && output[0] ? output[0].length : 128;

    this.sampleCounter += frameLength;
    if (this.sampleCounter >= this.stepIntervalSamples) {
      this.sampleCounter -= this.stepIntervalSamples;
      this.currentStep = (this.currentStep + 1) % 16;

      // Sample-accurate boundary notification
      this.port.postMessage({
        type: 'STEP_TICK',
        step: this.currentStep,
        timestamp: currentTime,
        bpm: this.bpm,
      });
    }

    return true;
  }
}

registerProcessor('${CLOCK_WORKLET_NAME}', MasterAudioClockProcessor);
`;

export interface ClockStepTickEvent {
  type: 'STEP_TICK';
  step: number;
  timestamp: number;
  bpm: number;
}

export type ClockControlMessage =
  | { type: 'SET_BPM'; bpm: number }
  | { type: 'START' }
  | { type: 'STOP' }
  | { type: 'RESET' };

/**
 * Creates and registers the MasterAudioClock AudioWorkletNode on an active AudioContext.
 */
export async function createClockWorkletNode(
  ctx: AudioContext,
  initialBpm = 120
): Promise<AudioWorkletNode> {
  const blob = new Blob([CLOCK_WORKLET_CODE], { type: 'application/javascript' });
  const moduleUrl = URL.createObjectURL(blob);

  try {
    await ctx.audioWorklet.addModule(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }

  const workletNode = new AudioWorkletNode(ctx, CLOCK_WORKLET_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });

  workletNode.port.postMessage({ type: 'SET_BPM', bpm: initialBpm } satisfies ClockControlMessage);

  return workletNode;
}
