// ============================================================================
// KINETIX STUDIO v4.1 - SPATIAL LAYOUT GEOMETRY & 6-ENGINE SOLVER
// Deterministic geometry and layout attributes for the 6 Layout Engines
//  ├── 1. GridEngine          --> [Swiss Crosshair, Modular Bento, Columnar Broadsheet]
//  ├── 2. SplitEngine         --> [Split Vertical, Split Horizontal]
//  ├── 3. StackTierEngine     --> [Billboard Marquee, Cinema One-Sheet, 70/30 Extreme Mass]
//  ├── 4. FrameInsetEngine    --> [Gallery Pedestal, Cyber HUD, Floating Plaque]
//  ├── 5. LayeredStackEngine  --> [Tri-Plane Depth, Neo-Tokyo Obi, Brutalist Cage]
//  └── 6. TransformEngine     --> [Radial Burst, Constructivist Angle, Golden Spiral]
// ============================================================================

import type { SpatialLayoutId, LayoutEngineType } from '@/types/spatial';
import type { StageShape } from '@/types/studio';
import { resolveLegacyLayout } from '@/constants/spatial-layouts';

export interface LayoutGeometry {
  stageX: number;
  stageY: number;
  stageW: number;
  stageH: number;
  stageShape: StageShape;
  stageCornerRadius: number;
  stageRotation: number; // in radians
  typeX: number;
  typeY: number;
  typeW: number;
  typeAlign: 'left' | 'center' | 'right';
  typeScale: number; // multiplier for baseFontSize
  heroPosition: 'center' | 'top' | 'bottom' | 'offset-right' | 'offset-left' | 'radial';
  badgeText: string;
  engine: LayoutEngineType;
}

export interface ResolveLayoutGeometryOptions {
  layoutId?: SpatialLayoutId;
  engine?: LayoutEngineType;
  variant?: string;
  width: number;
  height: number;
  scaleFactor: number;
  marginX: number;
  marginY: number;
  contentTopY: number;
  footerY: number;
  usableH: number;
  topHeadlineFlow: boolean;
  isLandscape: boolean;
  manualStageShape?: StageShape;
  manualStageCornerRadius?: number;
}

/**
 * Returns the formal Layout Engine responsible for a given layout identifier or archetype.
 */
export function getLayoutEngine(layoutId?: SpatialLayoutId): LayoutEngineType {
  return resolveLegacyLayout(layoutId).engine;
}

// ============================================================================
// 1. GRID ENGINE SOLVER (Cartesian columns, Swiss baseline, Bento matrix)
// ============================================================================
function solveGridEngine(
  variant: string,
  opt: ResolveLayoutGeometryOptions
): Omit<LayoutGeometry, 'engine'> {
  const { width: W, usableH, contentTopY, marginX, topHeadlineFlow } = opt;

  // 1b. Bento 4-Compartment Grid
  if (variant === 'bento' || variant === 'modular-bento' || variant === 'comic-paneled') {
    const stageW = W - marginX * 2;
    const stageH = usableH * 0.46;
    const stageX = marginX;
    const stageY = contentTopY + usableH * 0.08;

    return {
      stageX,
      stageY,
      stageW,
      stageH,
      stageShape: 'rounded-rect',
      stageCornerRadius: 14,
      stageRotation: 0,
      typeX: marginX,
      typeY: stageY + stageH + 16,
      typeW: stageW,
      typeAlign: 'left',
      typeScale: 0.95,
      heroPosition: 'center',
      badgeText: 'MODULAR // BENTO',
    };
  }

  // 1c. Columnar Broadsheet
  if (variant === 'columns' || variant === 'broadsheet-3col' || variant === 'columnar-flow') {
    const colWidth = (W - marginX * 2) * 0.64;
    const stageW = colWidth;
    const stageH = usableH * 0.46;
    const stageX = marginX + (W - marginX * 2) * 0.36;
    const stageY = contentTopY + usableH * 0.08;

    return {
      stageX,
      stageY,
      stageW,
      stageH,
      stageShape: 'sharp-rect',
      stageCornerRadius: 0,
      stageRotation: 0,
      typeX: marginX,
      typeY: stageY,
      typeW: (W - marginX * 2) * 0.32,
      typeAlign: 'left',
      typeScale: 0.88,
      heroPosition: 'center',
      badgeText: 'BROADSHEET // 3-COL',
    };
  }

  // 1a. Default: Swiss Crosshair & Optical Calibration
  const stageW = W - marginX * 2;
  const stageH = usableH * 0.44;
  const stageX = marginX;
  const stageY = topHeadlineFlow ? contentTopY + usableH * 0.22 : contentTopY;

  return {
    stageX,
    stageY,
    stageW,
    stageH,
    stageShape: 'sharp-rect',
    stageCornerRadius: 0,
    stageRotation: 0,
    typeX: marginX,
    typeY: topHeadlineFlow ? contentTopY : stageY + stageH + 16,
    typeW: stageW,
    typeAlign: 'left',
    typeScale: 1.05,
    heroPosition: 'center',
    badgeText: 'SWISS // CROSSHAIR',
  };
}

// ============================================================================
// 2. SPLIT ENGINE SOLVER (50/50 Dual-Chamber Partition)
// ============================================================================
function solveSplitEngine(
  variant: string,
  opt: ResolveLayoutGeometryOptions
): Omit<LayoutGeometry, 'engine'> {
  const { width: W, usableH, contentTopY, marginX } = opt;

  if (variant === 'split-horizontal' || variant === 'split-stage') {
    const stageW = W - marginX * 2;
    const stageH = usableH * 0.46;
    const stageX = marginX;
    const stageY = contentTopY + usableH * 0.48;

    return {
      stageX,
      stageY,
      stageW,
      stageH,
      stageShape: 'rounded-rect',
      stageCornerRadius: 10,
      stageRotation: 0,
      typeX: marginX,
      typeY: contentTopY + 10,
      typeW: stageW,
      typeAlign: 'left',
      typeScale: 1.0,
      heroPosition: 'center',
      badgeText: '50/50 // SPLIT-STAGE',
    };
  }

  // Default: Split Vertical (50/50 stage top, headline bottom)
  const stageW = W - marginX * 2;
  const stageH = usableH * 0.48;
  const stageX = marginX;
  const stageY = contentTopY;

  return {
    stageX,
    stageY,
    stageW,
    stageH,
    stageShape: 'sharp-rect',
    stageCornerRadius: 0,
    stageRotation: 0,
    typeX: marginX,
    typeY: contentTopY + usableH * 0.52,
    typeW: stageW,
    typeAlign: 'left',
    typeScale: 1.0,
    heroPosition: 'center',
    badgeText: '50/50 // SPLIT-VERTICAL',
  };
}

// ============================================================================
// 3. STACK TIER ENGINE SOLVER (Sequential vertical flow, 70/30 mass, marquee)
// ============================================================================
function solveStackTierEngine(
  variant: string,
  opt: ResolveLayoutGeometryOptions
): Omit<LayoutGeometry, 'engine'> {
  const { width: W, usableH, contentTopY, marginX } = opt;

  // 3b. Theatrical Cinema One-Sheet Billing Block
  if (variant === 'cinema-billing' || variant === 'cinema-one-sheet' || variant === 'streetwear-manifesto') {
    const stageW = W - marginX * 2;
    const stageH = usableH * 0.48;
    const stageX = marginX;
    const stageY = contentTopY + usableH * 0.08;

    return {
      stageX,
      stageY,
      stageW,
      stageH,
      stageShape: 'sharp-rect',
      stageCornerRadius: 0,
      stageRotation: 0,
      typeX: marginX,
      typeY: stageY + stageH + 18,
      typeW: stageW,
      typeAlign: 'center',
      typeScale: 1.0,
      heroPosition: 'center',
      badgeText: 'CINEMA // ONE-SHEET',
    };
  }

  // 3c. 70/30 Extreme Mass Shifts
  if (variant === 'extreme-mass' || variant === 'top-heavy' || variant === 'bottom-heavy' || variant === 'minimalist-void') {
    const stageW = W - marginX * 2;
    const stageH = usableH * 0.58;
    const stageX = marginX;
    const stageY = contentTopY;

    return {
      stageX,
      stageY,
      stageW,
      stageH,
      stageShape: 'rounded-rect',
      stageCornerRadius: 8,
      stageRotation: 0,
      typeX: marginX,
      typeY: contentTopY + usableH * 0.62,
      typeW: stageW,
      typeAlign: 'left',
      typeScale: 1.1,
      heroPosition: 'top',
      badgeText: 'TIER // 70-30-MASS',
    };
  }

  // 3a. Default: Billboard Marquee Ticker Header
  const stageW = W - marginX * 2;
  const stageH = usableH * 0.50;
  const stageX = marginX;
  const stageY = contentTopY + usableH * 0.22;

  return {
    stageX,
    stageY,
    stageW,
    stageH,
    stageShape: 'rounded-rect',
    stageCornerRadius: 10,
    stageRotation: 0,
    typeX: marginX,
    typeY: contentTopY + 8,
    typeW: stageW,
    typeAlign: 'left',
    typeScale: 1.25,
    heroPosition: 'center',
    badgeText: 'MARQUEE // TICKER',
  };
}

// ============================================================================
// 4. FRAME INSET ENGINE SOLVER (Architectural Inset Portals & Plinths)
// ============================================================================
function solveFrameInsetEngine(
  variant: string,
  opt: ResolveLayoutGeometryOptions
): Omit<LayoutGeometry, 'engine'> {
  const { width: W, usableH, contentTopY, marginX } = opt;

  // 4b. Tactical Cyber HUD
  if (variant === 'cyber-hud' || variant === 'cassette-futurist') {
    const stageW = W - marginX * 2 - 12;
    const stageH = usableH * 0.44;
    const stageX = marginX + 6;
    const stageY = contentTopY + usableH * 0.10;

    return {
      stageX,
      stageY,
      stageW,
      stageH,
      stageShape: 'chamfer',
      stageCornerRadius: 16,
      stageRotation: 0,
      typeX: marginX,
      typeY: stageY + stageH + 18,
      typeW: W - marginX * 2,
      typeAlign: 'left',
      typeScale: 0.95,
      heroPosition: 'center',
      badgeText: 'HUD // SYS-LOCKED',
    };
  }

  // 4c. Floating Plaque Standoffs
  if (variant === 'floating-plaque') {
    const stageW = W - marginX * 2 - 20;
    const stageH = usableH * 0.44;
    const stageX = marginX + 10;
    const stageY = contentTopY + usableH * 0.10;

    return {
      stageX,
      stageY,
      stageW,
      stageH,
      stageShape: 'rounded-rect',
      stageCornerRadius: 14,
      stageRotation: 0,
      typeX: marginX,
      typeY: stageY + stageH + 18,
      typeW: W - marginX * 2,
      typeAlign: 'center',
      typeScale: 1.0,
      heroPosition: 'center',
      badgeText: 'SUSPENDED // PLAQUE',
    };
  }

  // 4a. Default: Gallery Museum Pedestal Plinth
  const stageW = W - marginX * 2 - 16;
  const stageH = usableH * 0.42;
  const stageX = marginX + 8;
  const stageY = contentTopY + usableH * 0.12;

  return {
    stageX,
    stageY,
    stageW,
    stageH,
    stageShape: 'rounded-rect',
    stageCornerRadius: 8,
    stageRotation: 0,
    typeX: marginX,
    typeY: stageY + stageH + 20,
    typeW: W - marginX * 2,
    typeAlign: 'left',
    typeScale: 1.0,
    heroPosition: 'center',
    badgeText: 'EXHIBIT // PLINTH',
  };
}

// ============================================================================
// 5. LAYERED STACK ENGINE SOLVER (Z-Plane Depth, Obi-Strips, Brutalist Cages)
// ============================================================================
function solveLayeredStackEngine(
  variant: string,
  opt: ResolveLayoutGeometryOptions
): Omit<LayoutGeometry, 'engine'> {
  const { width: W, usableH, contentTopY, marginX } = opt;

  // 5b. Japanese Neo-Tokyo Obi-Strip
  if (variant === 'neo-tokyo-strip') {
    const stageW = W - marginX * 2 - 24;
    const stageH = usableH * 0.46;
    const stageX = marginX + 24;
    const stageY = contentTopY + usableH * 0.08;

    return {
      stageX,
      stageY,
      stageW,
      stageH,
      stageShape: 'sharp-rect',
      stageCornerRadius: 0,
      stageRotation: 0,
      typeX: marginX + 24,
      typeY: stageY + stageH + 16,
      typeW: stageW,
      typeAlign: 'left',
      typeScale: 1.0,
      heroPosition: 'center',
      badgeText: 'NEO-TOKYO // OBI',
    };
  }

  // 5c. Raw Industrial Brutalist Cage
  if (variant === 'brutalist-cage' || variant === 'full-bleed' || variant === 'chaotic-grunge') {
    const stageW = W - marginX * 2;
    const stageH = usableH * 0.48;
    const stageX = marginX;
    const stageY = contentTopY + usableH * 0.06;

    return {
      stageX,
      stageY,
      stageW,
      stageH,
      stageShape: 'sharp-rect',
      stageCornerRadius: 0,
      stageRotation: 0,
      typeX: marginX,
      typeY: stageY + stageH + 16,
      typeW: stageW,
      typeAlign: 'left',
      typeScale: 1.15,
      heroPosition: 'center',
      badgeText: 'BRUTALIST // CAGE',
    };
  }

  // 5a. Default: Tri-Plane Depth Cards
  const stageW = W - marginX * 2 - 16;
  const stageH = usableH * 0.44;
  const stageX = marginX + 8;
  const stageY = contentTopY + usableH * 0.10;

  return {
    stageX,
    stageY,
    stageW,
    stageH,
    stageShape: 'rounded-rect',
    stageCornerRadius: 10,
    stageRotation: 0,
    typeX: marginX,
    typeY: stageY + stageH + 18,
    typeW: W - marginX * 2,
    typeAlign: 'left',
    typeScale: 1.0,
    heroPosition: 'center',
    badgeText: 'TRI-PLANE // DEPTH',
  };
}

// ============================================================================
// 6. TRANSFORM ENGINE SOLVER (Rotations, Radial Hubs, Scan Vectors)
// ============================================================================
function solveTransformEngine(
  variant: string,
  opt: ResolveLayoutGeometryOptions
): Omit<LayoutGeometry, 'engine'> {
  const { width: W, usableH, contentTopY, marginX } = opt;

  // 6b. Constructivist Angular Slab
  if (variant === 'diagonal-slanted' || variant === 'constructivist' || variant === 'diagonal-tension' || variant === 'kinetic-slice') {
    const stageW = W - marginX * 2 - 16;
    const stageH = usableH * 0.42;
    const stageX = marginX + 8;
    const stageY = contentTopY + usableH * 0.10;

    return {
      stageX,
      stageY,
      stageW,
      stageH,
      stageShape: 'chamfer',
      stageCornerRadius: 12,
      stageRotation: -6 * (Math.PI / 180), // -6 deg physical rotation
      typeX: marginX,
      typeY: stageY + stageH + 20,
      typeW: W - marginX * 2,
      typeAlign: 'left',
      typeScale: 1.1,
      heroPosition: 'center',
      badgeText: 'CONSTRUCTIVIST // -12°',
    };
  }

  // 6c. Fibonacci Golden Spiral Vector
  if (variant === 'golden-spiral' || variant === 'z-pattern' || variant === 'f-pattern' || variant === 'inverted-triangle') {
    const spiralDim = Math.min(W * 0.62, usableH * 0.42);
    const stageW = spiralDim;
    const stageH = spiralDim;
    const stageX = marginX + (W - marginX * 2) * 0.38 - stageW / 2;
    const stageY = contentTopY + usableH * 0.14;

    return {
      stageX,
      stageY,
      stageW,
      stageH,
      stageShape: 'rounded-rect',
      stageCornerRadius: 16,
      stageRotation: 0,
      typeX: marginX,
      typeY: stageY + stageH + 20,
      typeW: W - marginX * 2,
      typeAlign: 'left',
      typeScale: 1.0,
      heroPosition: 'center',
      badgeText: 'FIBONACCI // SPIRAL',
    };
  }

  // 6a. Default: Radial Burst Hub (Concentric Spoke Rings)
  const diameter = Math.min(W * 0.62, usableH * 0.42);
  const stageW = diameter;
  const stageH = diameter;
  const stageX = (W - stageW) / 2;
  const stageY = contentTopY + (usableH * 0.50 - stageH) / 2;

  return {
    stageX,
    stageY,
    stageW,
    stageH,
    stageShape: 'circle',
    stageCornerRadius: diameter / 2,
    stageRotation: 0,
    typeX: marginX,
    typeY: stageY + stageH + 24,
    typeW: W - marginX * 2,
    typeAlign: 'center',
    typeScale: 1.0,
    heroPosition: 'radial',
    badgeText: 'RADIAL // BURST',
  };
}

// ============================================================================
// MASTER SOLVER DISPATCHER
// ============================================================================
export function resolveLayoutGeometry(options: ResolveLayoutGeometryOptions): LayoutGeometry {
  const {
    width: W,
    usableH,
    contentTopY,
    marginX,
    isLandscape,
    manualStageShape = 'auto',
    manualStageCornerRadius,
  } = options;

  // Resolve active engine and variant (handling both direct and legacy layoutId)
  let engine = options.engine;
  let variant = options.variant;
  if (!engine || !variant) {
    const resolved = resolveLegacyLayout(options.layoutId);
    engine = engine || resolved.engine;
    variant = variant || resolved.variant;
  }

  let rawGeom: Omit<LayoutGeometry, 'engine'>;

  // Widescreen Landscape 16:9 Reflow
  if (isLandscape) {
    let defaultShape: StageShape = 'rounded-rect';
    let defaultCornerRadius = 10;
    let heroPosition: 'center' | 'top' | 'bottom' | 'offset-right' | 'offset-left' | 'radial' = 'center';
    let typeScale = 1.0;

    let stageW = W * 0.46;
    let stageH = usableH * 0.84;
    let stageX = W * 0.48;
    const stageY = contentTopY + usableH * 0.08;

    if (variant === 'radial-burst') {
      defaultShape = 'circle';
      heroPosition = 'radial';
      stageW = Math.min(stageW, stageH);
      stageH = stageW;
      stageX = W * 0.48 + (W * 0.46 - stageW) / 2;
    } else if (variant === 'cyber-hud') {
      defaultShape = 'chamfer';
      defaultCornerRadius = 16;
    } else if (variant === 'crosshair' || variant === 'columns' || variant === 'brutalist-cage') {
      defaultShape = 'sharp-rect';
      defaultCornerRadius = 0;
    } else if (variant === 'marquee-header') {
      typeScale = 1.15;
    }

    rawGeom = {
      stageX,
      stageY,
      stageW,
      stageH,
      stageShape: defaultShape,
      stageCornerRadius: defaultCornerRadius,
      stageRotation: 0,
      typeX: marginX,
      typeY: contentTopY + usableH * 0.14,
      typeW: W * 0.44,
      typeAlign: 'left',
      typeScale,
      heroPosition,
      badgeText: variant.toUpperCase(),
    };
  } else {
    // Dispatch to specific Layout Engine based on variant
    switch (engine) {
      case 'GridEngine':
        rawGeom = solveGridEngine(variant, options);
        break;
      case 'SplitEngine':
        rawGeom = solveSplitEngine(variant, options);
        break;
      case 'StackTierEngine':
        rawGeom = solveStackTierEngine(variant, options);
        break;
      case 'FrameInsetEngine':
        rawGeom = solveFrameInsetEngine(variant, options);
        break;
      case 'LayeredStackEngine':
        rawGeom = solveLayeredStackEngine(variant, options);
        break;
      case 'TransformEngine':
        rawGeom = solveTransformEngine(variant, options);
        break;
    }
  }

  // Allow explicit manual stageShape or cornerRadius overrides
  const resolvedShape = manualStageShape !== 'auto' ? manualStageShape : rawGeom.stageShape;
  const resolvedCornerRadius =
    typeof manualStageCornerRadius === 'number'
      ? manualStageCornerRadius
      : rawGeom.stageCornerRadius;

  return {
    ...rawGeom,
    stageShape: resolvedShape,
    stageCornerRadius: resolvedCornerRadius,
    engine,
  };
}
