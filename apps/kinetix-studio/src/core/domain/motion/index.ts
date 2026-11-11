// ============================================================================
// KINETIX STUDIO - CORE DOMAIN: MOTION & CHOREOGRAPHY (ECMA-429)
// Pure business logic with zero DOM or browser window dependencies.
// ============================================================================

export * from './bezier-solver';
export * from './choreography';

export type {
  BezierKnot,
  CustomKeyframeTracks,
  TangentMode,
  ChoreoMode,
  ChoreographyEnvelope,
  AudioTelemetry,
  EasingId,
  TimelineMode,
  FpsCadence,
} from '@/types/motion';
