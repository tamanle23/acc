// ============================================================================
// KINETIX STUDIO - DRIVING PORT: MANIPULATE TIMELINE USE CASE (ECMA-429)
// Inbound port defining non-linear spline and keyframe mutations.
// ============================================================================

import type { CustomKeyframeTracks, TangentMode } from '@/types/motion';

export interface SetKnotTangentRequest {
  trackKey: keyof CustomKeyframeTracks;
  knotIndex: number;
  cpIn?: [number, number];
  cpOut?: [number, number];
  tangentMode?: TangentMode;
}

export interface IManipulateTimelineUseCase {
  insertKnot(trackKey: keyof CustomKeyframeTracks, t: number, val: number): CustomKeyframeTracks;
  removeKnot(trackKey: keyof CustomKeyframeTracks, knotIndex: number): CustomKeyframeTracks;
  updateKnotTangents(request: SetKnotTangentRequest): CustomKeyframeTracks;
  applyPresetToSegment(trackKey: keyof CustomKeyframeTracks, segmentIndex: number, presetName: string): CustomKeyframeTracks;
}
