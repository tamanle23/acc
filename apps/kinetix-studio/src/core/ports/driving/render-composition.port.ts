// ============================================================================
// KINETIX STUDIO - DRIVING PORT: RENDER COMPOSITION USE CASE (ECMA-429)
// Inbound port defining poster rendering and frame evaluation requests.
// ============================================================================

import type { StudioState, LayerVisibility } from '@/types/studio';
import type { ChoreographyEnvelope, AudioTelemetry } from '@/types/motion';
import type { IRenderTargetPort } from '../driven/render-target.port';

export interface RenderPosterFrameRequest {
  target: IRenderTargetPort;
  width: number;
  height: number;
  state: StudioState;
  frame: number;
  totalFrames: number;
  choreo?: ChoreographyEnvelope;
  scale?: number;
  layerVisibility?: LayerVisibility;
  audioTelemetry?: AudioTelemetry;
}

export interface IRenderCompositionUseCase {
  execute(request: RenderPosterFrameRequest): void;
}
