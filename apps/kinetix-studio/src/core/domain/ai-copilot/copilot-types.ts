// ============================================================================
// KINETIX STUDIO v6.0 - AI CREATIVE CO-PILOT TYPES (ECMA-429)
// Contracts for natural language brief parsing, 3-take auditions, and design guards.
// ============================================================================

import type { StudioState, PaletteTokens } from '@/types/studio';
import type { SpatialLayoutId } from '@/types/spatial';
import type { ShaderId } from '@/types/shader';
import type { HeroId } from '@/types/hero';
import type { BackgroundGraphicId } from '@/types/studio';

export type DirectorTakeStyle = 'minimalist' | 'avant-garde' | 'kinetic-chaos';

export interface DirectorTake {
  readonly id: string;
  readonly title: string;
  readonly style: DirectorTakeStyle;
  readonly rationale: string;
  readonly archetypeId: string;
  readonly layoutId: SpatialLayoutId;
  readonly shaderId: ShaderId;
  readonly heroId: HeroId;
  readonly bgGraphicId: BackgroundGraphicId;
  readonly palette: PaletteTokens;
  readonly bpm: number;
  readonly headline: [string, string, string];
  readonly subhead: string;
  readonly date: string;
  readonly location: string;
  readonly tag: string;
  readonly wcagContrastRatio: number;
  readonly cmykTacPct: number;
  readonly statePatch: Partial<StudioState>;
}

export interface CreativeBrief {
  readonly prompt: string;
  readonly detectedSphere?: string;
  readonly targetVibe?: string;
  readonly targetTempoBpm?: number;
}

export interface CopilotPipelineContext {
  readonly brief: CreativeBrief;
  baseState: StudioState;
  takes: DirectorTake[];
  errors: string[];
}

export interface ICopilotPipelineStep {
  readonly name: string;
  execute(context: CopilotPipelineContext): Promise<void> | void;
}
