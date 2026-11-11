import type { BackgroundGraphicId } from '@/types/studio';

export interface BackgroundGraphicItem {
  id: BackgroundGraphicId;
  name: string;
  category: 'Modernist' | 'Tactile' | 'Geometric' | 'Generative' | 'Minimalist';
  desc: string;
}

export const BACKGROUND_GRAPHICS_CATALOG: BackgroundGraphicItem[] = [
  {
    id: 'solid',
    name: 'Solid Plate',
    category: 'Minimalist',
    desc: 'Pure architectural flat ink fill',
  },
  {
    id: 'duotone-mesh',
    name: 'Duotone Mesh',
    category: 'Generative',
    desc: 'Multi-stop organic gradient blend',
  },
  {
    id: 'halftone-dots',
    name: 'Halftone Screen',
    category: 'Tactile',
    desc: 'Screenprint variable-radius dot raster',
  },
  {
    id: 'risograph-grain',
    name: 'Risograph Stipple',
    category: 'Tactile',
    desc: 'Tactile paper tooth & stipple ink grain',
  },
  {
    id: 'blueprint-grid',
    name: 'Blueprint Grid',
    category: 'Geometric',
    desc: 'Drafting coordinate crosshairs & sub-ticks',
  },
  {
    id: 'bauhaus-geo',
    name: 'Bauhaus Geo',
    category: 'Modernist',
    desc: 'Constructivist diagonal bars & circular wedges',
  },
  {
    id: 'topo-contours',
    name: 'Topo Contours',
    category: 'Generative',
    desc: 'Elevation isolines undulating smoothly',
  },
  {
    id: 'hex-mesh',
    name: 'Hex Matrix',
    category: 'Geometric',
    desc: 'Cybernetic honeycomb tessellation grid',
  },
  {
    id: 'minimal-noise',
    name: 'Film Grain Veil',
    category: 'Minimalist',
    desc: 'Subtle optical cinema grain texture',
  },
  {
    id: 'acid-marbling',
    name: 'Acid Marbling',
    category: 'Generative',
    desc: 'Fluid psychedelic paper marbling ribbon swirls',
  },
  {
    id: 'seigaiha-waves',
    name: 'Seigaiha Waves',
    category: 'Modernist',
    desc: 'Traditional Japanese geometric fan wave arches',
  },
  {
    id: 'caution-stripes',
    name: 'Caution Stripes',
    category: 'Geometric',
    desc: 'Brutalist high-contrast hazard diagonal stripes',
  },
];
