// ============================================================================
// KINETIX STUDIO - DRIVEN PORT: VECTOR DOCUMENT PORT (ECMA-429)
// Pure architectural interface decoupling vector pre-press document generation
// (PDF 1.7 / PDF/X-4 / PDF/X-1a, SVG) from layout engines and UI presentation.
// ============================================================================

import type { StudioState } from '@/types/studio';

export interface VectorDocumentBuildOptions {
  state: StudioState;
  presetId?: string;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  cmykStandard?: 'FOGRA39' | 'SWOP2006';
  includeSpotPlate?: boolean;
  rasterUnderlayBlob?: Blob | null;
}

export interface VectorDocumentResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly mimeType: string;
  readonly pageCount: number;
  readonly hasSpotPlate: boolean;
}

export interface IVectorDocumentPort {
  readonly format: 'pdf' | 'svg';
  generateDocument(options: VectorDocumentBuildOptions): Promise<VectorDocumentResult>;
}
