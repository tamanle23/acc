export type CSSProperties = Record<string, string | number | undefined>;

export type AspectRatio = '9:16' | '4:5' | '1:1' | '16:9';

export type LayoutEngineType =
  | 'GridEngine'
  | 'SplitEngine'
  | 'StackTierEngine'
  | 'FrameInsetEngine'
  | 'LayeredStackEngine'
  | 'TransformEngine';

export interface LayoutEngineVariant {
  id: string;
  name: string;
  tag: string;
  desc: string;
  badgeText: string;
  legacyLayoutId: SpatialLayoutId;
}

export interface LayoutEngineMeta {
  type: LayoutEngineType;
  name: string;
  tag: string;
  desc: string;
  mathPrinciple: string;
  icon?: string;
  defaultVariant: string;
  variants: LayoutEngineVariant[];
}

export type SpatialLayoutCategory =
  | 'structural-grid'
  | 'compositional-geometric'
  | 'scannability-flow'
  | 'content-specific'
  | 'studio-curated';

export type SpatialLayoutId =
  // Structural & Grid-Based Layouts
  | 'manuscript'
  | 'modular-grid'
  | 'columnar-flow'
  | 'hierarchical-flow'
  | 'asymmetric-tension'
  | 'symmetric-monolith'
  // Compositional & Geometric Layouts
  | 'split-screen'
  | 'rule-of-thirds'
  | 'golden-spiral'
  | 'diagonal-slanted'
  | 'radial-burst'
  | 'frame-in-frame'
  // Scannability & Flow Layouts
  | 'z-pattern'
  | 'f-pattern'
  | 'inverted-triangle'
  | 'top-heavy'
  | 'bottom-heavy'
  // Content-Specific Layouts
  | 'typography-first'
  | 'minimalist-void'
  | 'chaotic-grunge'
  | 'comic-paneled'
  // Studio Curated Skeletons (Backwards-compatible canonical library)
  | 'modular-bento'
  | 'swiss-asymmetric'
  | 'split-stage'
  | 'full-bleed'
  | 'brutalist-cage'
  | 'center-monolith'
  | 'capsule-portal'
  | 'diagonal-tension'
  | 'ticker-band'
  | 'corner-anchor'
  | 'swiss-crosshair'
  | 'floating-plaque'
  | 'cyber-hud'
  | 'broadsheet-3col'
  | 'cassette-futurist'
  | 'kinetic-slice'
  | 'gallery-pedestal'
  | 'tri-plane'
  | 'neo-tokyo-strip'
  | 'constructivist'
  | 'z-flow-top-headline'
  | 'streetwear-manifesto'
  | 'collage-cutout'
  | 'cinema-one-sheet';

export interface SpatialSkeletonSpec {
  outerClass: string;
  outerStyle: CSSProperties;
  middleClass: string;
  middleStyle: CSSProperties;
  headlineAlignClass: string;
  heroStageStyle: CSSProperties;
  heroStageClass: string;
  badgeText: string;
  gridGuides?:
    | 'none'
    | 'thirds'
    | 'quad'
    | 'columns-3'
    | 'golden-spiral'
    | 'f-stem'
    | 'crosshair'
    | 'radial'
    | 'z-path'
    | 'funnel'
    | 'bento'
    | string;
  heroPosition?: 'center' | 'top' | 'bottom' | 'offset-right' | 'offset-left' | 'radial';
  engine?: LayoutEngineType;
  variant?: string;
}

export interface SpatialLayoutItem {
  id: SpatialLayoutId;
  name: string;
  tag: string;
  desc: string;
  category: SpatialLayoutCategory;
  engine: LayoutEngineType;
  variantId?: string;
}
