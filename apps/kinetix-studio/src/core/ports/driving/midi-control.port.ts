// ============================================================================
// KINETIX STUDIO - DRIVING PORT: MIDI CONTROL USE CASE (ECMA-429)
// Inbound port defining hardware MIDI event ingestion and parameter binding.
// ============================================================================

import type { StudioState } from '@/types/studio';

export interface MidiMappingRule {
  id: string;
  channel: number;
  controller: number;
  parameterKey: string;
  min: number;
  max: number;
  step?: number;
}

export interface IMapMidiControlUseCase {
  bindController(rule: MidiMappingRule): void;
  unbindController(ruleId: string): void;
  applyControlChange(channel: number, controller: number, normalizedValue: number, state: StudioState): Partial<StudioState>;
  getMappings(): readonly MidiMappingRule[];
}
