import type { BackgroundGraphicId } from '@/types/studio';
import type { BackgroundGeneratorOptions } from './render-duotone-mesh';

import { renderDuotoneMesh } from './render-duotone-mesh';
import { renderHalftoneDots } from './render-halftone-dots';
import { renderRisographGrain } from './render-risograph-grain';
import { renderBlueprintGrid } from './render-blueprint-grid';
import { renderBauhausGeo } from './render-bauhaus-geo';
import { renderTopoContours } from './render-topo-contours';
import { renderHexMesh } from './render-hex-mesh';
import { renderMinimalNoise } from './render-minimal-noise';
import { renderAcidMarbling } from './render-acid-marbling';
import { renderSeigaihaWaves } from './render-seigaiha-waves';
import { renderCautionStripes } from './render-caution-stripes';

export * from './render-duotone-mesh';
export * from './render-halftone-dots';
export * from './render-risograph-grain';
export * from './render-blueprint-grid';
export * from './render-bauhaus-geo';
export * from './render-topo-contours';
export * from './render-hex-mesh';
export * from './render-minimal-noise';
export * from './render-acid-marbling';
export * from './render-seigaiha-waves';
export * from './render-caution-stripes';
export * from './duotone-filter';

export const PROCEDURAL_BACKGROUND_STRATEGIES: Record<
  Exclude<BackgroundGraphicId, 'solid' | 'custom-image'>,
  (options: BackgroundGeneratorOptions) => void
> = {
  'duotone-mesh': renderDuotoneMesh,
  'halftone-dots': renderHalftoneDots,
  'risograph-grain': renderRisographGrain,
  'blueprint-grid': renderBlueprintGrid,
  'bauhaus-geo': renderBauhausGeo,
  'topo-contours': renderTopoContours,
  'hex-mesh': renderHexMesh,
  'minimal-noise': renderMinimalNoise,
  'acid-marbling': renderAcidMarbling,
  'seigaiha-waves': renderSeigaihaWaves,
  'caution-stripes': renderCautionStripes,
};
