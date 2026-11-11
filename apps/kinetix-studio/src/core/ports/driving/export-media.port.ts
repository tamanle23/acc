// ============================================================================
// KINETIX STUDIO - DRIVING PORT: EXPORT MEDIA USE CASE (ECMA-429)
// Inbound port defining composite media export workflows.
// ============================================================================

import type { StudioState } from '@/types/studio';

export type ExportMediaFormat = 'mp4' | 'webm' | 'gif' | 'png' | 'svg' | 'pdf';

export interface ExportMediaRequest {
  format: ExportMediaFormat;
  state: StudioState;
  scale?: number;
  fps?: number;
  autoDownload?: boolean;
  fileHandle?: unknown;
  onProgress?: (pct: number, currentFrame: number, totalFrames: number) => void;
  abortSignal?: AbortSignal;
}

export interface ExportMediaResult {
  blob: Blob;
  filename: string;
  mimeType: string;
}

export interface IExportMediaUseCase {
  execute(request: ExportMediaRequest): Promise<ExportMediaResult | null>;
}
