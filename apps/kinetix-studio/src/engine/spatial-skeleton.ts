import type { StudioState } from '@/types/studio';
import type { SpatialSkeletonSpec, CSSProperties } from '@/types/spatial';
import { getLayoutEngine } from './composition/layout-geometry';
import { resolveLegacyLayout } from '@/constants/spatial-layouts';

function setUniformBorderWidth(style: CSSProperties, width: string): void {
  style.borderTopWidth = width;
  style.borderRightWidth = width;
  style.borderBottomWidth = width;
  style.borderLeftWidth = width;
}

export function getSpatialSkeletonSpec(state: StudioState): SpatialSkeletonSpec {
  const { layoutId, palette, stageBlurPx, stageBorderOpacity, collageEdges, topHeadlineFlow } = state;
  const borderAlphaHex = Math.round(stageBorderOpacity * 255)
    .toString(16)
    .padStart(2, '0');

  const spec: SpatialSkeletonSpec = {
    outerClass: 'border border-border/80',
    outerStyle: {},
    middleClass: `flex-1 flex ${topHeadlineFlow ? 'flex-col' : 'flex-col-reverse'} justify-around my-2 gap-2`,
    middleStyle: {},
    headlineAlignClass: 'text-left',
    heroStageClass: 'w-full flex-1 min-h-[155px] max-h-[245px]',
    heroStageStyle: {
      backgroundColor: palette.surface + '66',
      backdropFilter: `blur(${stageBlurPx}px)`,
      borderColor: palette.accent + borderAlphaHex,
      borderTopWidth: '1px',
      borderRightWidth: '1px',
      borderBottomWidth: '1px',
      borderLeftWidth: '1px',
      borderStyle: 'solid',
      borderRadius:
        state.stageShape === 'circle' || state.stageShape === 'pill'
          ? '9999px'
          : state.stageShape === 'sharp-rect'
          ? '0px'
          : `${state.stageCornerRadius ?? 10}px`,
      clipPath: collageEdges
        ? 'polygon(2% 0%, 98% 3%, 100% 96%, 94% 100%, 4% 98%, 0% 6%)'
        : 'none',
    },
    badgeText: (state.layoutVariant || layoutId || 'LAYOUT').toUpperCase(),
    gridGuides: 'none',
    heroPosition: 'center',
    engine: state.layoutEngine || getLayoutEngine(layoutId),
    variant: state.layoutVariant || resolveLegacyLayout(layoutId).variant,
  };

  const activeKey = state.layoutVariant || layoutId;

  switch (activeKey) {
    // ------------------------------------------------------------------------
    // 1. STRUCTURAL & GRID-BASED LAYOUTS
    // ------------------------------------------------------------------------
    case 'manuscript':
      spec.headlineAlignClass = 'text-center items-center';
      spec.middleClass = 'flex-1 flex flex-col justify-between my-4 px-3 gap-3';
      spec.heroStageClass = 'w-11/12 mx-auto flex-1 min-h-[180px] max-h-[260px] shadow-2xl';
      spec.heroStageStyle.borderRadius = '4px';
      setUniformBorderWidth(spec.heroStageStyle, '1px');
      spec.heroStageStyle.borderColor = palette.ink + '44';
      spec.badgeText = 'MANUSCRIPT // SINGLE-COL';
      break;

    case 'modular-grid':
      spec.middleClass = `flex-1 grid grid-cols-2 grid-rows-2 p-2 rounded-xl border bg-black/35 gap-2 my-2`;
      spec.middleStyle = { borderColor: palette.ink + '2e' };
      spec.heroStageClass = 'col-span-2 row-span-1 w-full h-full min-h-[140px]';
      spec.heroStageStyle.borderRadius = '8px';
      spec.gridGuides = 'quad';
      spec.badgeText = 'MODULAR // MATRIX';
      break;

    case 'columnar-flow':
      spec.middleClass = `flex-1 flex ${topHeadlineFlow ? 'flex-col' : 'flex-col-reverse'} justify-between my-2 py-2 border-y-2 gap-2`;
      spec.middleStyle = { borderColor: palette.ink + '66' };
      spec.heroStageClass = 'w-full flex-1 min-h-[160px] max-h-[235px]';
      spec.gridGuides = 'columns-3';
      spec.badgeText = 'COLUMNAR // 3-COL';
      break;

    case 'hierarchical-flow':
      spec.middleClass = 'flex-1 flex flex-col justify-between my-2 gap-2';
      spec.headlineAlignClass = 'text-left scale-105 origin-left';
      spec.heroStageClass = 'w-full flex-1 min-h-[170px] max-h-[240px] shadow-xl';
      spec.heroStageStyle.borderRadius = '16px 4px 16px 4px';
      spec.heroStageStyle.borderLeftWidth = '4px';
      spec.badgeText = 'HIERARCHICAL';
      break;

    case 'asymmetric-tension':
      spec.middleClass = `flex-1 flex ${topHeadlineFlow ? 'flex-col' : 'flex-col-reverse'} justify-between my-2 pl-4 border-l-4 gap-2`;
      spec.middleStyle = { borderColor: palette.accent };
      spec.heroStageClass = 'w-4/5 ml-auto flex-1 min-h-[160px] max-h-[235px]';
      spec.heroStageStyle.borderRadius = '0px';
      spec.heroStageStyle.borderLeftWidth = '4px';
      spec.heroPosition = 'offset-right';
      spec.badgeText = 'ASYMMETRIC // TENSION';
      break;

    case 'symmetric-monolith':
      spec.headlineAlignClass = 'text-center items-center';
      spec.middleClass = 'flex-1 flex flex-col items-center justify-between my-2 gap-2';
      spec.heroStageClass = 'w-4/5 mx-auto flex-1 min-h-[170px] max-h-[240px]';
      spec.heroStageStyle.borderRadius = '12px';
      setUniformBorderWidth(spec.heroStageStyle, '2px');
      spec.heroStageStyle.borderStyle = 'double';
      spec.badgeText = 'SYMMETRIC // MONOLITH';
      break;

    // ------------------------------------------------------------------------
    // 2. COMPOSITIONAL & GEOMETRIC LAYOUTS
    // ------------------------------------------------------------------------
    case 'split-screen':
      spec.middleClass = 'flex-1 grid grid-cols-2 items-center gap-2.5 my-2';
      spec.heroStageClass = 'w-full h-full min-h-[185px]';
      spec.heroStageStyle.borderRadius = '8px';
      setUniformBorderWidth(spec.heroStageStyle, '2px');
      spec.badgeText = '50/50 // SPLIT-SCREEN';
      break;

    case 'rule-of-thirds':
      spec.gridGuides = 'thirds';
      spec.middleClass = `flex-1 flex ${topHeadlineFlow ? 'flex-col' : 'flex-col-reverse'} justify-between my-2 gap-2`;
      spec.heroStageClass = 'w-5/6 ml-auto flex-1 min-h-[155px] max-h-[230px]';
      spec.heroStageStyle.borderRadius = '8px';
      spec.heroPosition = 'offset-right';
      spec.badgeText = 'RULE OF THIRDS';
      break;

    case 'golden-spiral':
      spec.gridGuides = 'golden-spiral';
      spec.headlineAlignClass = 'text-left';
      spec.middleClass = 'flex-1 flex flex-col justify-between my-2 gap-2';
      spec.heroStageClass = 'w-3/4 mr-auto flex-1 min-h-[160px] max-h-[235px]';
      spec.heroStageStyle.borderRadius = '24px 4px 4px 24px';
      spec.badgeText = 'FIBONACCI // SPIRAL';
      break;

    case 'diagonal-slanted':
      spec.middleStyle = { transform: 'skewY(-6deg)' };
      spec.heroStageStyle.borderRadius = '4px';
      setUniformBorderWidth(spec.heroStageStyle, '2.5px');
      spec.heroStageStyle.borderColor = palette.accent2;
      spec.badgeText = 'DIAGONAL // SLANTED';
      break;

    case 'radial-burst':
      spec.headlineAlignClass = 'text-center items-center';
      spec.heroStageClass = 'w-48 h-48 mx-auto my-auto shrink-0 shadow-[0_0_40px_rgba(0,0,0,0.5)]';
      spec.heroStageStyle.borderRadius = '9999px';
      setUniformBorderWidth(spec.heroStageStyle, '2.5px');
      spec.heroPosition = 'radial';
      spec.badgeText = 'RADIAL // BURST';
      break;

    case 'frame-in-frame':
      spec.outerClass = 'border-4';
      spec.outerStyle = { borderColor: palette.accent };
      spec.middleClass = 'flex-1 flex flex-col justify-between my-2 p-3 border-2 bg-black/30 gap-2';
      spec.middleStyle = { borderColor: palette.ink + '44' };
      spec.heroStageStyle.borderRadius = '6px';
      setUniformBorderWidth(spec.heroStageStyle, '2px');
      spec.badgeText = 'FRAME-IN-FRAME';
      break;

    // ------------------------------------------------------------------------
    // 3. SCANNABILITY & FLOW LAYOUTS
    // ------------------------------------------------------------------------
    case 'z-pattern':
      spec.middleClass = 'flex-1 flex flex-col justify-between my-2 gap-2';
      spec.headlineAlignClass = 'text-left';
      spec.heroStageClass = 'w-full flex-1 min-h-[160px] max-h-[235px]';
      spec.heroStageStyle.borderRadius = '14px';
      setUniformBorderWidth(spec.heroStageStyle, '2px');
      spec.badgeText = 'Z-PATTERN // FLOW';
      break;

    case 'f-pattern':
      spec.gridGuides = 'f-stem';
      spec.middleClass = 'flex-1 flex flex-col justify-between my-2 pl-3 border-l-4 gap-2';
      spec.middleStyle = { borderColor: palette.accent };
      spec.headlineAlignClass = 'text-left';
      spec.heroStageClass = 'w-full flex-1 min-h-[155px] max-h-[225px]';
      spec.badgeText = 'F-PATTERN // SCAN';
      break;

    case 'inverted-triangle':
      spec.headlineAlignClass = 'text-center items-center scale-110 origin-top';
      spec.middleClass = 'flex-1 flex flex-col justify-between my-2 gap-2';
      spec.heroStageClass = 'w-3/5 mx-auto flex-1 min-h-[145px] max-h-[210px]';
      spec.heroStageStyle.borderRadius = '8px 8px 32px 32px';
      spec.badgeText = 'INVERTED // TRIANGLE';
      break;

    case 'top-heavy':
      spec.middleClass = 'flex-1 flex flex-col justify-start my-2 gap-3';
      spec.headlineAlignClass = 'text-left scale-115 origin-top-left my-2';
      spec.heroStageClass = 'w-full flex-1 min-h-[130px] max-h-[185px] mt-auto';
      spec.heroStageStyle.borderRadius = '6px';
      spec.badgeText = 'TOP-HEAVY // 70%';
      break;

    case 'bottom-heavy':
      spec.middleClass = 'flex-1 flex flex-col-reverse justify-start my-2 gap-3';
      spec.headlineAlignClass = 'text-left scale-115 origin-bottom-left my-2';
      spec.heroStageClass = 'w-full flex-1 min-h-[130px] max-h-[185px] mb-auto';
      spec.heroStageStyle.borderRadius = '6px';
      spec.badgeText = 'BOTTOM-HEAVY // 70%';
      break;

    // ------------------------------------------------------------------------
    // 4. CONTENT-SPECIFIC LAYOUTS
    // ------------------------------------------------------------------------
    case 'typography-first':
      spec.headlineAlignClass = 'text-left scale-125 origin-top-left font-black tracking-tighter my-2';
      spec.heroStageClass = 'w-28 h-28 ml-auto my-auto shrink-0 opacity-45';
      spec.heroStageStyle.backgroundColor = 'transparent';
      spec.heroStageStyle.borderColor = 'transparent';
      spec.heroStageStyle.backdropFilter = 'none';
      spec.badgeText = 'SWISS // TYPOGRAPHY';
      break;

    case 'minimalist-void':
      spec.middleClass = 'flex-1 flex flex-col items-center justify-center my-6 gap-6';
      spec.headlineAlignClass = 'text-center items-center tracking-widest';
      spec.heroStageClass = 'w-32 h-32 mx-auto shrink-0 shadow-sm';
      spec.heroStageStyle.borderRadius = '9999px';
      setUniformBorderWidth(spec.heroStageStyle, '1px');
      spec.heroStageStyle.borderColor = palette.accent;
      spec.badgeText = 'MINIMALIST // VOID 80%';
      break;

    case 'chaotic-grunge':
      spec.outerClass = 'border-4 border-dashed';
      spec.outerStyle = { borderColor: palette.ink };
      spec.middleStyle = { transform: 'rotate(2deg)' };
      spec.heroStageStyle.clipPath =
        'polygon(0% 4%, 96% 0%, 100% 92%, 88% 100%, 8% 96%, 2% 8%)';
      setUniformBorderWidth(spec.heroStageStyle, '3px');
      spec.heroStageStyle.borderColor = palette.accent;
      spec.badgeText = 'CHAOTIC // GRUNGE';
      break;

    case 'comic-paneled':
      spec.middleClass = 'flex-1 grid grid-cols-2 grid-rows-2 p-2 border-2 bg-black/40 gap-1.5 my-2';
      spec.middleStyle = { borderColor: palette.ink };
      spec.heroStageClass = 'col-span-2 row-span-1 w-full h-full min-h-[145px]';
      spec.heroStageStyle.borderRadius = '0px';
      setUniformBorderWidth(spec.heroStageStyle, '2px');
      spec.heroStageStyle.borderColor = palette.ink;
      spec.badgeText = 'COMIC // PANELED';
      break;

    // ------------------------------------------------------------------------
    // 5. STUDIO CURATED SKELETONS (LEGACY CANONICAL)
    // ------------------------------------------------------------------------
    case 'z-flow-top-headline':
      spec.middleClass = 'flex-1 flex flex-col justify-between my-2 gap-2';
      setUniformBorderWidth(spec.heroStageStyle, '2px');
      spec.heroStageStyle.borderRadius = '14px';
      spec.badgeText = 'TOP-1/3 // Z-FLOW';
      break;

    case 'modular-bento':
      spec.middleClass = `flex-1 flex ${topHeadlineFlow ? 'flex-col' : 'flex-col-reverse'} justify-between my-2 p-2 rounded-xl border bg-black/25 gap-2`;
      spec.middleStyle = { borderColor: palette.ink + '28' };
      spec.heroStageStyle.borderRadius = '14px';
      setUniformBorderWidth(spec.heroStageStyle, '1.5px');
      spec.gridGuides = 'bento';
      spec.badgeText = 'MODULAR // BENTO';
      break;

    case 'swiss-asymmetric':
      spec.middleClass = `flex-1 flex ${topHeadlineFlow ? 'flex-col' : 'flex-col-reverse'} justify-between my-2 pl-3 border-l-4 gap-2`;
      spec.middleStyle = { borderColor: palette.accent };
      spec.heroStageClass = 'w-4/5 ml-auto flex-1 min-h-[150px] max-h-[225px]';
      spec.heroStageStyle.borderRadius = '0px';
      spec.heroStageStyle.borderLeftWidth = '4px';
      spec.heroPosition = 'offset-right';
      spec.badgeText = 'SWISS // ASYMMETRIC';
      break;

    case 'split-stage':
      spec.middleClass = 'flex-1 grid grid-cols-2 items-center gap-2.5 my-2';
      spec.heroStageClass = 'w-full h-full min-h-[180px]';
      spec.heroStageStyle.borderRadius = '8px';
      spec.badgeText = '50/50 // SPLIT-STAGE';
      break;

    case 'full-bleed':
      spec.heroStageStyle.backgroundColor = 'transparent';
      spec.heroStageStyle.backdropFilter = 'none';
      spec.heroStageStyle.borderColor = 'transparent';
      spec.badgeText = 'FULL-BLEED // IMMERSION';
      break;

    case 'brutalist-cage':
      spec.outerClass = 'border-4';
      spec.outerStyle = { borderColor: palette.accent };
      spec.middleClass = `flex-1 flex ${topHeadlineFlow ? 'flex-col' : 'flex-col-reverse'} justify-between my-2 p-2 border-2 bg-black/45 gap-2`;
      spec.middleStyle = { borderColor: palette.accent2 };
      spec.heroStageStyle.borderRadius = '0px';
      setUniformBorderWidth(spec.heroStageStyle, '2px');
      spec.heroStageStyle.borderColor = palette.ink;
      spec.badgeText = 'BRUTALIST // CAGE';
      break;

    case 'center-monolith':
      spec.headlineAlignClass = 'text-center items-center';
      spec.heroStageClass = 'w-44 h-44 mx-auto my-auto shrink-0';
      spec.heroStageStyle.borderRadius = '9999px';
      setUniformBorderWidth(spec.heroStageStyle, '2px');
      spec.heroPosition = 'radial';
      spec.badgeText = 'CENTER // MONOLITH';
      break;

    case 'capsule-portal':
      spec.headlineAlignClass = 'text-center items-center';
      spec.heroStageClass = 'w-4/5 mx-auto flex-1 min-h-[165px] max-h-[235px]';
      spec.heroStageStyle.borderRadius = '9999px 9999px 18px 18px';
      setUniformBorderWidth(spec.heroStageStyle, '2px');
      spec.badgeText = 'CAPSULE // PORTAL';
      break;

    case 'diagonal-tension':
      spec.middleStyle = { transform: 'skewY(-5deg)' };
      spec.heroStageStyle.borderRadius = '4px';
      setUniformBorderWidth(spec.heroStageStyle, '2px');
      spec.heroStageStyle.borderColor = palette.accent2;
      spec.badgeText = 'DIAGONAL // TENSION';
      break;

    case 'ticker-band':
      spec.heroStageStyle.borderRadius = '0px';
      spec.heroStageStyle.borderTopWidth = '4px';
      spec.heroStageStyle.borderBottomWidth = '4px';
      spec.heroStageStyle.borderLeftWidth = '0px';
      spec.heroStageStyle.borderRightWidth = '0px';
      spec.badgeText = 'TICKER // BAND';
      break;

    case 'corner-anchor':
      spec.heroStageClass = 'w-3/4 ml-auto flex-1 min-h-[155px] max-h-[220px]';
      spec.heroStageStyle.borderRadius = '0px 0px 0px 28px';
      spec.heroStageStyle.borderLeftWidth = '3px';
      spec.heroStageStyle.borderBottomWidth = '3px';
      spec.heroPosition = 'offset-right';
      spec.badgeText = 'CORNER // ANCHOR';
      break;

    case 'swiss-crosshair':
      spec.headlineAlignClass = 'text-center';
      spec.heroStageStyle.borderRadius = '0px';
      spec.heroStageStyle.borderStyle = 'dashed';
      spec.gridGuides = 'crosshair';
      spec.badgeText = 'SWISS // CROSSHAIR';
      break;

    case 'floating-plaque':
      spec.middleClass = `flex-1 flex ${topHeadlineFlow ? 'flex-col' : 'flex-col-reverse'} justify-between my-3 p-3.5 rounded-2xl border shadow-2xl gap-2`;
      spec.middleStyle = {
        backgroundColor: palette.surface + 'b8',
        backdropFilter: 'blur(12px)',
        borderColor: palette.ink + '33',
      };
      spec.heroStageStyle.backgroundColor = 'transparent';
      spec.heroStageStyle.borderColor = 'transparent';
      spec.headlineAlignClass = 'text-center';
      spec.badgeText = 'FLOATING // PLAQUE';
      break;

    case 'cyber-hud':
      spec.heroStageStyle.borderRadius = '2px';
      spec.heroStageStyle.borderStyle = 'dashed';
      setUniformBorderWidth(spec.heroStageStyle, '2px');
      spec.heroStageStyle.boxShadow = `inset 0 0 18px ${palette.accent}33`;
      spec.badgeText = 'CYBER // HUD';
      break;

    case 'broadsheet-3col':
      spec.middleClass = `flex-1 flex ${topHeadlineFlow ? 'flex-col' : 'flex-col-reverse'} justify-between my-2 py-2 border-y-2 gap-2`;
      spec.middleStyle = { borderColor: palette.ink };
      spec.heroStageStyle.borderRadius = '0px';
      spec.gridGuides = 'columns-3';
      spec.badgeText = 'BROADSHEET // 3-COL';
      break;

    case 'cassette-futurist':
      spec.outerClass = 'border-2';
      spec.outerStyle = { borderColor: palette.accent2 };
      spec.headlineAlignClass = 'text-center';
      spec.heroStageClass = 'w-11/12 mx-auto flex-1 min-h-[155px] max-h-[225px]';
      spec.heroStageStyle.borderRadius = '20px';
      setUniformBorderWidth(spec.heroStageStyle, '3px');
      spec.heroStageStyle.borderColor = palette.accent2;
      spec.badgeText = 'CASSETTE // FUTURIST';
      break;

    case 'kinetic-slice':
      spec.heroStageStyle.clipPath = 'polygon(0 8%, 100% 0%, 100% 92%, 0% 100%)';
      setUniformBorderWidth(spec.heroStageStyle, '2px');
      spec.badgeText = 'KINETIC // SLICE';
      break;

    case 'gallery-pedestal':
      spec.headlineAlignClass = 'text-center';
      spec.heroStageClass = 'w-4/5 mx-auto flex-1 min-h-[160px] max-h-[225px]';
      spec.heroStageStyle.borderRadius = '4px 4px 0 0';
      spec.heroStageStyle.borderBottomWidth = '8px';
      spec.heroStageStyle.borderColor = palette.accent;
      spec.badgeText = 'GALLERY // PEDESTAL';
      break;

    case 'tri-plane':
      spec.heroStageStyle.borderRadius = '16px';
      spec.heroStageStyle.boxShadow = `0 10px 0 -4px ${palette.accent}66, 0 20px 0 -8px ${palette.accent2}55`;
      spec.badgeText = 'TRI-PLANE // DEPTH';
      break;

    case 'neo-tokyo-strip':
      spec.middleClass = `flex-1 flex ${topHeadlineFlow ? 'flex-col' : 'flex-col-reverse'} justify-between my-2 pl-7 relative gap-2`;
      spec.heroStageStyle.borderLeftWidth = '4px';
      spec.heroStageStyle.borderRadius = '0 12px 12px 0';
      spec.badgeText = 'NEO-TOKYO // OBI';
      break;

    case 'constructivist':
      spec.outerClass = 'border-4';
      spec.outerStyle = { borderColor: palette.ink };
      spec.middleStyle = { transform: 'rotate(-1.5deg)' };
      spec.heroStageStyle.borderRadius = '0px';
      setUniformBorderWidth(spec.heroStageStyle, '3px');
      spec.heroStageStyle.borderColor = palette.accent;
      spec.badgeText = 'CONSTRUCTIVIST // AVANT';
      break;

    case 'streetwear-manifesto':
      spec.middleClass = 'flex-1 flex flex-col justify-between my-1 gap-1';
      spec.heroStageClass = 'w-full flex-1 min-h-[135px] max-h-[195px]';
      spec.heroStageStyle.borderBottomWidth = '4px';
      spec.heroStageStyle.borderRadius = '0px';
      spec.badgeText = 'STREETWEAR // DROP';
      break;

    case 'collage-cutout':
      spec.middleStyle = { transform: 'rotate(1deg)' };
      spec.heroStageStyle.clipPath =
        'polygon(2% 0%, 98% 3%, 100% 96%, 94% 100%, 4% 98%, 0% 6%)';
      setUniformBorderWidth(spec.heroStageStyle, '3px');
      spec.heroStageStyle.borderColor = palette.ink;
      spec.badgeText = 'COLLAGE // 12FPS';
      break;

    case 'cinema-one-sheet':
      spec.headlineAlignClass = 'text-center';
      spec.heroStageClass = 'w-full flex-1 min-h-[175px] max-h-[250px]';
      spec.heroStageStyle.borderRadius = '2px';
      spec.heroStageStyle.borderTopWidth = '3px';
      spec.heroStageStyle.borderBottomWidth = '3px';
      spec.badgeText = 'CINEMA // ONE-SHEET';
      break;

    default:
      break;
  }

  return spec;
}
