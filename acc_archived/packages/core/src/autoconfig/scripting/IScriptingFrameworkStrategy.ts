import type { PipelineIR } from '@acc/ir';

export type ScriptAudioRole = 'hook' | 'friction' | 'metaphor' | 'turn' | 'climax' | 'resolution';
export type ScriptVisualPacing = 'rapid_cut' | 'slow_burn' | 'kinetic_motion' | 'intimate_hold';

export interface ScriptBeat {
  name: string;
  timingSec: [number, number]; // [startSec, endSec]
  audioRole: ScriptAudioRole;
  visualPacing: ScriptVisualPacing;
  sfxCue?: string;
  cameraPreset?: string;
  typographyStyle?: string;
  description?: string;
  narrationTemplate?: string;
}

export interface ScriptPromptPayload {
  topic: string;
  targetDurationSec?: number;
  rawContent?: string;
  styleId?: string;
}

export interface IScriptingFrameworkStrategy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly targetStyles: string[];
  readonly aliases?: string[];
  generateBeats(input: ScriptPromptPayload): Promise<ScriptBeat[]>;
  generateBeatsSync?(input: ScriptPromptPayload): ScriptBeat[];
  applyToPipelineIR(ir: PipelineIR, beats: ScriptBeat[]): PipelineIR;
}
