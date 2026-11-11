import type { SpatialLayoutItem, LayoutEngineType, LayoutEngineMeta, SpatialLayoutId } from '@/types/spatial';

export const LAYOUT_ENGINES: Record<LayoutEngineType, LayoutEngineMeta> = {
  GridEngine: {
    type: 'GridEngine',
    name: 'Modular Grid Engine',
    tag: 'GRID',
    desc: 'Mathematical matrix of rows, columns, gutters, and Swiss baseline plumb lines',
    mathPrinciple: 'Rigid column matrices, Swiss crosshairs, and modular Bento containment.',
    defaultVariant: 'crosshair',
    variants: [
      {
        id: 'crosshair',
        name: 'Swiss Crosshair',
        tag: 'CROSS',
        desc: 'Precision calibration crosshairs & optical target grid',
        badgeText: 'SWISS // CROSSHAIR',
        legacyLayoutId: 'swiss-crosshair',
      },
      {
        id: 'bento',
        name: 'Modular Bento',
        tag: 'BENTO',
        desc: '4-compartment Bento cards with spec pill tags',
        badgeText: 'MODULAR // BENTO',
        legacyLayoutId: 'modular-bento',
      },
      {
        id: 'columns',
        name: 'Columnar Broadsheet',
        tag: '3-COL',
        desc: 'Editorial 3-column divider rules & masthead header',
        badgeText: 'BROADSHEET // 3-COL',
        legacyLayoutId: 'broadsheet-3col',
      },
    ],
  },
  SplitEngine: {
    type: 'SplitEngine',
    name: 'Dual-Chamber Split Engine',
    tag: 'SPLIT',
    desc: 'Exact bi-sectional canvas partition with dual-channel visual balance',
    mathPrinciple: 'Exact bi-sectional viewport split with decoupled hero and typography compartments.',
    defaultVariant: 'split-vertical',
    variants: [
      {
        id: 'split-vertical',
        name: 'Split Vertical',
        tag: '50/50',
        desc: 'Exact 50/50 vertical division between hero stage and headline',
        badgeText: '50/50 // SPLIT-VERTICAL',
        legacyLayoutId: 'split-screen',
      },
      {
        id: 'split-horizontal',
        name: 'Split Horizontal',
        tag: 'DUAL',
        desc: 'Balanced dual-chamber horizontal partitioning',
        badgeText: '50/50 // SPLIT-STAGE',
        legacyLayoutId: 'split-stage',
      },
    ],
  },
  StackTierEngine: {
    type: 'StackTierEngine',
    name: 'Sequential Stack & Tier Engine',
    tag: 'TIER',
    desc: 'Sequential vertical flow, 70/30 mass polarization, and massive kinetic typography',
    mathPrinciple: '70/30 extreme visual mass, billboard marquee headers, and cinematic billing blocks.',
    defaultVariant: 'marquee-header',
    variants: [
      {
        id: 'marquee-header',
        name: 'Billboard Marquee',
        tag: 'MARQUEE',
        desc: 'Top ticker band marquee with monumental kinetic headline',
        badgeText: 'MARQUEE // TICKER',
        legacyLayoutId: 'ticker-band',
      },
      {
        id: 'cinema-billing',
        name: 'Cinema One-Sheet',
        tag: 'BILLING',
        desc: 'Theatrical billing block credits with Dolby Atmos audio emblems',
        badgeText: 'CINEMA // ONE-SHEET',
        legacyLayoutId: 'cinema-one-sheet',
      },
      {
        id: 'extreme-mass',
        name: '70/30 Extreme Mass',
        tag: 'MASS',
        desc: 'Polarized 70/30 vertical visual weight hierarchy',
        badgeText: 'TIER // 70-30-MASS',
        legacyLayoutId: 'top-heavy',
      },
    ],
  },
  FrameInsetEngine: {
    type: 'FrameInsetEngine',
    name: 'Architectural Frame & Inset Engine',
    tag: 'FRAME',
    desc: 'Passe-partout matting, museum plinths, stadium arches, and suspended plaques',
    mathPrinciple: 'Concentric frame boundaries, gallery plinth pedestals, and tactical HUD brackets.',
    defaultVariant: 'gallery-pedestal',
    variants: [
      {
        id: 'gallery-pedestal',
        name: 'Gallery Pedestal',
        tag: 'PLINTH',
        desc: 'Museum foundation baseline plinth bar with catalog label',
        badgeText: 'EXHIBIT // PLINTH',
        legacyLayoutId: 'gallery-pedestal',
      },
      {
        id: 'cyber-hud',
        name: 'Cyber HUD',
        tag: 'HUD',
        desc: 'Tactical corner L-brackets with locked telemetry readout',
        badgeText: 'HUD // SYS-LOCKED',
        legacyLayoutId: 'cyber-hud',
      },
      {
        id: 'floating-plaque',
        name: 'Floating Plaque',
        tag: 'PLAQUE',
        desc: 'Frosted acrylic standoff mounting pins with metallic rims',
        badgeText: 'SUSPENDED // PLAQUE',
        legacyLayoutId: 'floating-plaque',
      },
    ],
  },
  LayeredStackEngine: {
    type: 'LayeredStackEngine',
    name: 'Stratified Z-Layer Engine',
    tag: 'LAYER',
    desc: 'Cascading depth planes, raw industrial cages, Obi spines, and edge-to-edge immersion',
    mathPrinciple: 'Tri-plane depth cards, Japanese Obi-strips, and brutalist structural cages.',
    defaultVariant: 'tri-plane',
    variants: [
      {
        id: 'tri-plane',
        name: 'Tri-Plane Depth',
        tag: '3D-CARD',
        desc: 'Cascading dual paper depth cards with physical offset shadows',
        badgeText: 'TRI-PLANE // DEPTH',
        legacyLayoutId: 'tri-plane',
      },
      {
        id: 'neo-tokyo-strip',
        name: 'Neo-Tokyo Obi',
        tag: 'OBI-STRIP',
        desc: 'Japanese vertical Obi-strip along left flank with katakana',
        badgeText: 'NEO-TOKYO // OBI',
        legacyLayoutId: 'neo-tokyo-strip',
      },
      {
        id: 'brutalist-cage',
        name: 'Brutalist Cage',
        tag: 'RAW-CAGE',
        desc: 'Heavy exposed industrial cage borders with corner cross-ticks',
        badgeText: 'BRUTALIST // CAGE',
        legacyLayoutId: 'brutalist-cage',
      },
    ],
  },
  TransformEngine: {
    type: 'TransformEngine',
    name: 'Matrix & Polar Transform Engine',
    tag: 'TRANSFORM',
    desc: 'Affine angle shears, non-affine rotations, concentric radial hubs, and logarithmic spirals',
    mathPrinciple: 'Non-zero angular rotation (-12° to +6°), radial hubs, and cognitive scan paths (Z, F, Funnel).',
    defaultVariant: 'radial-burst',
    variants: [
      {
        id: 'radial-burst',
        name: 'Radial Burst',
        tag: 'RADIAL',
        desc: 'Concentric range rings with 8 radiating spoke lines centered on focal hero',
        badgeText: 'RADIAL // BURST',
        legacyLayoutId: 'radial-burst',
      },
      {
        id: 'diagonal-slanted',
        name: 'Constructivist Angle',
        tag: 'ANGULAR',
        desc: '-12° constructivist slab beam with rotated stage & hero',
        badgeText: 'CONSTRUCTIVIST // -12°',
        legacyLayoutId: 'constructivist',
      },
      {
        id: 'golden-spiral',
        name: 'Golden Spiral',
        tag: 'SPIRAL',
        desc: 'Fibonacci golden spiral trajectory & focal logarithmic arc',
        badgeText: 'FIBONACCI // SPIRAL',
        legacyLayoutId: 'golden-spiral',
      },
    ],
  },
};

// Complete legacy mapping: All 45 old layout IDs deterministically map to { engine, variant }
export const LEGACY_LAYOUT_MAP: Record<string, { engine: LayoutEngineType; variant: string }> = {
  // 1. GridEngine
  'modular-grid': { engine: 'GridEngine', variant: 'bento' },
  'columnar-flow': { engine: 'GridEngine', variant: 'columns' },
  'asymmetric-tension': { engine: 'GridEngine', variant: 'crosshair' },
  'rule-of-thirds': { engine: 'GridEngine', variant: 'crosshair' },
  'comic-paneled': { engine: 'GridEngine', variant: 'bento' },
  'modular-bento': { engine: 'GridEngine', variant: 'bento' },
  'swiss-asymmetric': { engine: 'GridEngine', variant: 'crosshair' },
  'corner-anchor': { engine: 'GridEngine', variant: 'crosshair' },
  'broadsheet-3col': { engine: 'GridEngine', variant: 'columns' },
  'swiss-crosshair': { engine: 'GridEngine', variant: 'crosshair' },

  // 2. SplitEngine
  'split-screen': { engine: 'SplitEngine', variant: 'split-vertical' },
  'split-stage': { engine: 'SplitEngine', variant: 'split-horizontal' },

  // 3. StackTierEngine
  'manuscript': { engine: 'StackTierEngine', variant: 'marquee-header' },
  'hierarchical-flow': { engine: 'StackTierEngine', variant: 'marquee-header' },
  'top-heavy': { engine: 'StackTierEngine', variant: 'extreme-mass' },
  'bottom-heavy': { engine: 'StackTierEngine', variant: 'extreme-mass' },
  'typography-first': { engine: 'StackTierEngine', variant: 'marquee-header' },
  'minimalist-void': { engine: 'StackTierEngine', variant: 'extreme-mass' },
  'z-flow-top-headline': { engine: 'StackTierEngine', variant: 'marquee-header' },
  'ticker-band': { engine: 'StackTierEngine', variant: 'marquee-header' },
  'streetwear-manifesto': { engine: 'StackTierEngine', variant: 'cinema-billing' },
  'cinema-one-sheet': { engine: 'StackTierEngine', variant: 'cinema-billing' },

  // 4. FrameInsetEngine
  'frame-in-frame': { engine: 'FrameInsetEngine', variant: 'gallery-pedestal' },
  'capsule-portal': { engine: 'FrameInsetEngine', variant: 'gallery-pedestal' },
  'floating-plaque': { engine: 'FrameInsetEngine', variant: 'floating-plaque' },
  'cyber-hud': { engine: 'FrameInsetEngine', variant: 'cyber-hud' },
  'cassette-futurist': { engine: 'FrameInsetEngine', variant: 'cyber-hud' },
  'gallery-pedestal': { engine: 'FrameInsetEngine', variant: 'gallery-pedestal' },

  // 5. LayeredStackEngine
  'full-bleed': { engine: 'LayeredStackEngine', variant: 'brutalist-cage' },
  'brutalist-cage': { engine: 'LayeredStackEngine', variant: 'brutalist-cage' },
  'tri-plane': { engine: 'LayeredStackEngine', variant: 'tri-plane' },
  'neo-tokyo-strip': { engine: 'LayeredStackEngine', variant: 'neo-tokyo-strip' },
  'chaotic-grunge': { engine: 'LayeredStackEngine', variant: 'brutalist-cage' },
  'collage-cutout': { engine: 'LayeredStackEngine', variant: 'tri-plane' },

  // 6. TransformEngine
  'symmetric-monolith': { engine: 'TransformEngine', variant: 'radial-burst' },
  'golden-spiral': { engine: 'TransformEngine', variant: 'golden-spiral' },
  'diagonal-slanted': { engine: 'TransformEngine', variant: 'diagonal-slanted' },
  'radial-burst': { engine: 'TransformEngine', variant: 'radial-burst' },
  'z-pattern': { engine: 'TransformEngine', variant: 'golden-spiral' },
  'f-pattern': { engine: 'TransformEngine', variant: 'golden-spiral' },
  'inverted-triangle': { engine: 'TransformEngine', variant: 'golden-spiral' },
  'center-monolith': { engine: 'TransformEngine', variant: 'radial-burst' },
  'diagonal-tension': { engine: 'TransformEngine', variant: 'diagonal-slanted' },
  'kinetic-slice': { engine: 'TransformEngine', variant: 'diagonal-slanted' },
  'constructivist': { engine: 'TransformEngine', variant: 'diagonal-slanted' },
};

export function resolveLegacyLayout(layoutId?: string): { engine: LayoutEngineType; variant: string } {
  if (!layoutId) {
    return { engine: 'StackTierEngine', variant: 'marquee-header' };
  }
  const match = LEGACY_LAYOUT_MAP[layoutId];
  if (match) {
    return match;
  }
  // Fallback heuristic if unknown layout
  return { engine: 'GridEngine', variant: 'crosshair' };
}

export function getLegacyLayoutId(engine: LayoutEngineType, variant: string): SpatialLayoutId {
  const eng = LAYOUT_ENGINES[engine];
  if (eng) {
    const v = eng.variants.find((item) => item.id === variant);
    if (v) return v.legacyLayoutId;
  }
  return 'swiss-crosshair';
}

// 17 Primary Spatial Layout Items
export const SPATIAL_LAYOUTS: SpatialLayoutItem[] = Object.values(LAYOUT_ENGINES).flatMap((eng) =>
  eng.variants.map((v) => ({
    id: v.legacyLayoutId,
    name: v.name,
    tag: v.tag,
    desc: v.desc,
    category: 'studio-curated',
    engine: eng.type,
    variantId: v.id,
  }))
);
