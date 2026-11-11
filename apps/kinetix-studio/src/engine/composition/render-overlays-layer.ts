// ============================================================================
// KINETIX STUDIO v4.1 - ARCHITECTURAL OVERLAYS & BLUEPRINT LAYER
// Distinct visual structural skeletons, blueprints & graphic marks for all 45 layouts
// ============================================================================

import type { SafeCanvas2D } from '@/lib/safe-canvas-2d';
import type { StudioState } from '@/types/studio';
import type { SpatialSkeletonSpec } from '@/types/spatial';
import type { LayoutGeometry } from './layout-geometry';
import { resolveLegacyLayout } from '@/constants/spatial-layouts';

export interface RenderOverlaysLayerOptions {
  sctx: SafeCanvas2D;
  width: number;
  height: number;
  state: StudioState;
  spec: SpatialSkeletonSpec;
  geom: LayoutGeometry;
  scaleFactor: number;
  marginX: number;
  bottomMargin: number;
  rightMargin: number;
  contentTopY: number;
  footerY: number;
  usableH: number;
  theta?: number;
}

/**
 * Layer 4: Blueprint Grid, Architectural Structural Skeletal Overlays & Safe Zones.
 * Renders both intrinsic graphic layout marks and expanded technical blueprint guides.
 */
export function renderOverlaysLayer(options: RenderOverlaysLayerOptions): void {
  const {
    sctx,
    width: W,
    height: H,
    state,
    geom,
    scaleFactor,
    marginX,
    bottomMargin,
    rightMargin,
    contentTopY,
    footerY,
    usableH,
  } = options;

  const { palette, layoutId, layoutVariant } = state;
  const isBlueprint = state.blueprintGrid;
  const { stageX, stageY, stageW, stageH } = geom;

  // Resolve active variant
  const activeVariant = layoutVariant || resolveLegacyLayout(layoutId).variant;

  // --------------------------------------------------------------------------
  // SECTION 1: INTRINSIC ARCHITECTURAL LAYOUT SKELETON MARKS (Always Visible)
  // --------------------------------------------------------------------------
  sctx.save();

  switch (activeVariant) {
    // 1. Neo-Tokyo Vertical Obi-Strip Spine
    case 'neo-tokyo-strip': {
      const obiW = 22 * scaleFactor;
      sctx.fillStyle = palette.accent;
      sctx.fillRect(0, 0, obiW, H);

      sctx.save();
      sctx.translate(obiW / 2, H / 2);
      sctx.rotate(-Math.PI / 2);
      sctx.fillStyle = palette.bg;
      sctx.font = `900 ${Math.round(8 * scaleFactor)}px "Space Mono", monospace`;
      sctx.textAlign = 'center';
      sctx.textBaseline = 'middle';
      sctx.letterSpacing = `${2 * scaleFactor}px`;
      sctx.fillText('NEO-TOKYO // AUDIOVISUAL OBI-STRIP 2026', 0, 0);
      sctx.restore();
      break;
    }

    // 2. Cyber HUD Tactical Reticles & Telemetry Brackets
    case 'cyber-hud': {
      sctx.strokeStyle = palette.accent;
      sctx.lineWidth = 1.5 * scaleFactor;
      const bLen = 14 * scaleFactor;
      const pad = 6 * scaleFactor;

      const x0 = stageX - pad;
      const y0 = stageY - pad;
      const x1 = stageX + stageW + pad;
      const y1 = stageY + stageH + pad;

      // Top-Left Bracket
      sctx.beginPath();
      sctx.moveTo(x0, y0 + bLen);
      sctx.lineTo(x0, y0);
      sctx.lineTo(x0 + bLen, y0);
      // Top-Right Bracket
      sctx.moveTo(x1 - bLen, y0);
      sctx.lineTo(x1, y0);
      sctx.lineTo(x1, y0 + bLen);
      // Bottom-Left Bracket
      sctx.moveTo(x0, y1 - bLen);
      sctx.lineTo(x0, y1);
      sctx.lineTo(x0 + bLen, y1);
      // Bottom-Right Bracket
      sctx.moveTo(x1 - bLen, y1);
      sctx.lineTo(x1, y1);
      sctx.lineTo(x1, y1 - bLen);
      sctx.stroke();

      // HUD Status readout
      sctx.fillStyle = palette.accent;
      sctx.font = `700 ${Math.round(7 * scaleFactor)}px "Space Mono", monospace`;
      sctx.textAlign = 'right';
      sctx.fillText('[HUD.SYS: LOCKED // 60FPS]', x1, y0 - 3 * scaleFactor);
      break;
    }

    // 3. Broadsheet 3-Column Editorial Grid Rules
    case 'columns':
    case 'broadsheet-3col': {
      sctx.strokeStyle = palette.ink;
      sctx.globalAlpha = 0.25;
      sctx.lineWidth = 1;
      const colW = (W - marginX * 2) / 3;

      sctx.beginPath();
      sctx.moveTo(marginX + colW, contentTopY);
      sctx.lineTo(marginX + colW, footerY);
      sctx.moveTo(marginX + colW * 2, contentTopY);
      sctx.lineTo(marginX + colW * 2, footerY);
      sctx.stroke();

      // Masthead rule
      sctx.globalAlpha = 0.4;
      sctx.beginPath();
      sctx.moveTo(marginX, contentTopY);
      sctx.lineTo(W - marginX, contentTopY);
      sctx.stroke();
      break;
    }

    // 4. Columnar Flow Editorial Tabs
    case 'columnar-flow': {
      sctx.strokeStyle = palette.ink;
      sctx.globalAlpha = 0.22;
      sctx.lineWidth = 1;
      const colW = (W - marginX * 2) / 3;

      sctx.beginPath();
      sctx.moveTo(marginX + colW, contentTopY);
      sctx.lineTo(marginX + colW, footerY);
      sctx.moveTo(marginX + colW * 2, contentTopY);
      sctx.lineTo(marginX + colW * 2, footerY);
      sctx.stroke();

      // Column Header Tabs
      sctx.globalAlpha = 0.7;
      sctx.fillStyle = palette.ink;
      sctx.font = `700 ${Math.round(7 * scaleFactor)}px "Space Mono", monospace`;
      sctx.textAlign = 'left';
      sctx.fillText('COL.01', marginX + 2, contentTopY - 2 * scaleFactor);
      sctx.fillText('COL.02', marginX + colW + 4, contentTopY - 2 * scaleFactor);
      sctx.fillText('COL.03', marginX + colW * 2 + 4, contentTopY - 2 * scaleFactor);
      break;
    }

    // 5. Cassette Futurist Magnetic Media Chassis & Spools
    case 'cassette-futurist': {
      const spoolY = stageY + stageH / 2;
      const spoolRadius = 14 * scaleFactor;
      const leftSpoolX = stageX + stageW * 0.26;
      const rightSpoolX = stageX + stageW * 0.74;

      sctx.save();
      sctx.strokeStyle = palette.accent2;
      sctx.lineWidth = 1.5 * scaleFactor;
      sctx.globalAlpha = 0.6;

      // Left Tape Spool
      sctx.beginPath();
      sctx.arc(leftSpoolX, spoolY, spoolRadius, 0, Math.PI * 2);
      sctx.arc(leftSpoolX, spoolY, spoolRadius * 0.45, 0, Math.PI * 2);
      // Right Tape Spool
      sctx.arc(rightSpoolX, spoolY, spoolRadius, 0, Math.PI * 2);
      sctx.arc(rightSpoolX, spoolY, spoolRadius * 0.45, 0, Math.PI * 2);
      sctx.stroke();

      // Tape Bridge Window
      sctx.strokeRect(
        leftSpoolX + spoolRadius + 4 * scaleFactor,
        spoolY - 7 * scaleFactor,
        rightSpoolX - leftSpoolX - spoolRadius * 2 - 8 * scaleFactor,
        14 * scaleFactor
      );

      // Tape Counter Readout
      sctx.fillStyle = palette.accent;
      sctx.font = `800 ${Math.round(7 * scaleFactor)}px "Space Mono", monospace`;
      sctx.textAlign = 'center';
      sctx.fillText('[SIDE-A // 04:20]', W / 2, spoolY + 18 * scaleFactor);
      sctx.restore();
      break;
    }

    // 6. Tri-Plane Cascading Card Depth Shadows
    case 'tri-plane': {
      sctx.save();
      sctx.strokeStyle = palette.accent2;
      sctx.lineWidth = 1.2 * scaleFactor;
      sctx.globalAlpha = 0.28;
      // Underlying Plane 3 (Back)
      sctx.strokeRect(stageX + 8 * scaleFactor, stageY + 8 * scaleFactor, stageW, stageH);
      // Underlying Plane 2 (Middle)
      sctx.strokeStyle = palette.accent;
      sctx.globalAlpha = 0.45;
      sctx.strokeRect(stageX + 4 * scaleFactor, stageY + 4 * scaleFactor, stageW, stageH);
      sctx.restore();
      break;
    }

    // 7. Comic Paneled Sequential Narrative Frames
    case 'comic-paneled': {
      sctx.strokeStyle = palette.ink;
      sctx.lineWidth = 2 * scaleFactor;
      sctx.globalAlpha = 0.8;

      // Bottom narrative secondary frame
      const botPanelH = footerY - (stageY + stageH) - 8 * scaleFactor;
      if (botPanelH > 20 * scaleFactor) {
        sctx.strokeRect(stageX, stageY + stageH + 6 * scaleFactor, stageW, botPanelH);
        sctx.fillStyle = palette.accent;
        sctx.font = `800 ${Math.round(8 * scaleFactor)}px "Space Mono", monospace`;
        sctx.fillText('PANEL // 02', stageX + 6 * scaleFactor, stageY + stageH + 18 * scaleFactor);
      }
      break;
    }

    // 8. Modular Bento 4-Cell Compartment Guides
    case 'bento':
    case 'modular-bento': {
      sctx.strokeStyle = palette.ink;
      sctx.globalAlpha = 0.35;
      sctx.lineWidth = 1.2 * scaleFactor;

      // Companion cell to the right of stage
      const rightCellX = stageX + stageW + 6 * scaleFactor;
      const rightCellW = W - marginX - rightCellX;
      if (rightCellW > 30 * scaleFactor) {
        sctx.roundRect(rightCellX, stageY, rightCellW, stageH, 10 * scaleFactor);
        sctx.stroke();

        sctx.fillStyle = palette.accent;
        sctx.font = `700 ${Math.round(7 * scaleFactor)}px "Space Mono", monospace`;
        sctx.fillText('[02 SPECS]', rightCellX + 6 * scaleFactor, stageY + 14 * scaleFactor);
      }
      break;
    }

    // 9. Constructivist Avant-Garde Diagonal Slab Beams
    case 'diagonal-slanted':
    case 'constructivist': {
      sctx.save();
      sctx.translate(W / 2, H / 2);
      sctx.rotate((-12 * Math.PI) / 180);
      sctx.fillStyle = palette.accent + '24';
      sctx.fillRect(-W, -14 * scaleFactor, W * 2, 28 * scaleFactor);

      // Red/accent wedge triangle
      sctx.fillStyle = palette.accent2;
      sctx.beginPath();
      sctx.moveTo(W * 0.28, -20 * scaleFactor);
      sctx.lineTo(W * 0.38, 20 * scaleFactor);
      sctx.lineTo(W * 0.18, 20 * scaleFactor);
      sctx.closePath();
      sctx.fill();
      sctx.restore();
      break;
    }

    // 10. Gallery Pedestal Foundation Plinth
    case 'gallery-pedestal': {
      sctx.save();
      const plinthY = stageY + stageH;
      const plinthW = stageW * 1.06;
      const plinthX = stageX - (plinthW - stageW) / 2;

      // Heavy museum plinth line
      sctx.fillStyle = palette.accent;
      sctx.fillRect(plinthX, plinthY, plinthW, 6 * scaleFactor);

      // Exhibition metadata plate
      sctx.fillStyle = palette.ink;
      sctx.font = `700 ${Math.round(7 * scaleFactor)}px "Space Mono", monospace`;
      sctx.textAlign = 'center';
      sctx.fillText('EXHIBIT // NO. 045 [PLINTH STAGE]', W / 2, plinthY + 16 * scaleFactor);
      sctx.restore();
      break;
    }

    // 11. Streetwear Manifesto Barcode & Quotation Rail
    case 'streetwear-manifesto': {
      sctx.save();
      // Barcode lines at bottom
      const barY = footerY - 14 * scaleFactor;
      const barH = 12 * scaleFactor;
      const barStartX = marginX;
      sctx.fillStyle = palette.ink;
      sctx.globalAlpha = 0.7;

      for (let i = 0; i < 32; i++) {
        const bx = barStartX + i * 4 * scaleFactor;
        const bw = (i % 3 === 0 ? 2.5 : 1) * scaleFactor;
        sctx.fillRect(bx, barY, bw, barH);
      }
      sctx.font = `700 ${Math.round(6 * scaleFactor)}px "Space Mono", monospace`;
      sctx.fillText('*KX-DROP-2026*', barStartX + 135 * scaleFactor, barY + barH - 2);
      sctx.restore();
      break;
    }

    // 12. Cinema One-Sheet Theatrical Billing Block
    case 'cinema-billing':
    case 'cinema-one-sheet': {
      sctx.save();
      const billingY = footerY - 18 * scaleFactor;
      sctx.fillStyle = palette.ink;
      sctx.globalAlpha = 0.55;
      sctx.font = `700 ${Math.round(6.5 * scaleFactor)}px "Space Mono", monospace`;
      sctx.textAlign = 'center';

      sctx.fillText('A KINETIX ORIGINAL MOTION POSTER // PRODUCED BY THE STUDIO CORE', W / 2, billingY, W - marginX * 2);
      sctx.fillText('[ DOLBY ATMOS ]   [ 70MM IMAX ]   [ RATED AV-AA ]', W / 2, billingY + 9 * scaleFactor, W - marginX * 2);
      sctx.restore();
      break;
    }

    // 13. Radial Burst Concentric Range Rings
    case 'radial-burst': {
      sctx.save();
      sctx.strokeStyle = palette.accent;
      sctx.lineWidth = 1;
      sctx.globalAlpha = 0.28;
      const cx = stageX + stageW / 2;
      const cy = stageY + stageH / 2;
      const maxR = Math.max(stageW, stageH) * 0.75;

      // Concentric rings
      sctx.beginPath();
      sctx.arc(cx, cy, maxR * 0.45, 0, Math.PI * 2);
      sctx.arc(cx, cy, maxR * 0.75, 0, Math.PI * 2);
      sctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      sctx.stroke();

      // 8 Spokes
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        sctx.beginPath();
        sctx.moveTo(cx + Math.cos(ang) * (maxR * 0.35), cy + Math.sin(ang) * (maxR * 0.35));
        sctx.lineTo(cx + Math.cos(ang) * maxR, cy + Math.sin(ang) * maxR);
        sctx.stroke();
      }
      sctx.restore();
      break;
    }

    // 14. Floating Plaque Standoff Pins
    case 'floating-plaque': {
      sctx.save();
      const pinR = 3.5 * scaleFactor;
      const pinOffset = 10 * scaleFactor;
      const pins = [
        [stageX + pinOffset, stageY + pinOffset],
        [stageX + stageW - pinOffset, stageY + pinOffset],
        [stageX + pinOffset, stageY + stageH - pinOffset],
        [stageX + stageW - pinOffset, stageY + stageH - pinOffset],
      ];

      sctx.fillStyle = palette.accent;
      sctx.strokeStyle = palette.bg;
      sctx.lineWidth = 1;
      pins.forEach(([px, py]) => {
        sctx.beginPath();
        sctx.arc(px, py, pinR, 0, Math.PI * 2);
        sctx.fill();
        sctx.stroke();
      });
      sctx.restore();
      break;
    }

    // 15. Swiss Crosshair Precision Reticle
    case 'crosshair':
    case 'swiss-crosshair': {
      sctx.save();
      sctx.strokeStyle = palette.accent;
      sctx.lineWidth = 1;
      sctx.globalAlpha = 0.35;
      const cx = W / 2;
      const cy = stageY + stageH / 2;

      // Center crosshair lines
      sctx.beginPath();
      sctx.moveTo(cx - 30 * scaleFactor, cy);
      sctx.lineTo(cx + 30 * scaleFactor, cy);
      sctx.moveTo(cx, cy - 30 * scaleFactor);
      sctx.lineTo(cx, cy + 30 * scaleFactor);
      sctx.arc(cx, cy, 18 * scaleFactor, 0, Math.PI * 2);
      sctx.stroke();
      sctx.restore();
      break;
    }

    // 16. Manuscript Book Folio Header
    case 'manuscript': {
      sctx.save();
      sctx.fillStyle = palette.ink;
      sctx.globalAlpha = 0.45;
      sctx.font = `700 ${Math.round(7 * scaleFactor)}px "Space Mono", monospace`;
      sctx.textAlign = 'center';
      sctx.fillText('— FOLIO 045 // ARCHIVE —', W / 2, contentTopY - 2 * scaleFactor);
      sctx.restore();
      break;
    }

    // 17. Brutalist Cage Exposed Cross Ticks
    case 'brutalist-cage': {
      sctx.save();
      sctx.strokeStyle = palette.accent;
      sctx.lineWidth = 2 * scaleFactor;
      const tLen = 8 * scaleFactor;
      const ticks = [
        [marginX, contentTopY],
        [W - marginX, contentTopY],
        [marginX, footerY],
        [W - marginX, footerY],
      ];
      ticks.forEach(([tx, ty]) => {
        sctx.beginPath();
        sctx.moveTo(tx - tLen, ty);
        sctx.lineTo(tx + tLen, ty);
        sctx.moveTo(tx, ty - tLen);
        sctx.lineTo(tx, ty + tLen);
        sctx.stroke();
      });
      sctx.restore();
      break;
    }
  }

  sctx.restore();

  // --------------------------------------------------------------------------
  // SECTION 2: TECHNICAL BLUEPRINT GRID GUIDELINES (Active on blueprintGrid)
  // --------------------------------------------------------------------------
  if (isBlueprint) {
    sctx.save();
    sctx.strokeStyle = palette.accent;
    sctx.lineWidth = 1;
    sctx.setLineDash([4 * scaleFactor, 4 * scaleFactor]);
    sctx.globalAlpha = 0.24;

    // Center Crosshairs
    sctx.beginPath();
    sctx.moveTo(W * 0.5, 0);
    sctx.lineTo(W * 0.5, H);
    sctx.moveTo(0, H * 0.5);
    sctx.lineTo(W, H * 0.5);
    sctx.stroke();

    // Golden Spiral Curve
    if (layoutId === 'golden-spiral' || activeVariant === 'golden-spiral') {
      sctx.beginPath();
      const centerX = W * 0.62;
      const centerY = H * 0.44;
      const a = 3.5 * scaleFactor;
      const b = 0.30635;
      for (let t = 0; t <= 12; t += 0.1) {
        const r = a * Math.exp(b * t);
        const sx = centerX + r * Math.cos(t);
        const sy = centerY + r * Math.sin(t);
        if (t === 0) sctx.moveTo(sx, sy);
        else sctx.lineTo(sx, sy);
      }
      sctx.stroke();
    }

    // Rule of Thirds Matrix & Power Points
    if (layoutId === 'rule-of-thirds') {
      sctx.beginPath();
      sctx.moveTo(W * 0.333, 0);
      sctx.lineTo(W * 0.333, H);
      sctx.moveTo(W * 0.666, 0);
      sctx.lineTo(W * 0.666, H);
      sctx.moveTo(0, H * 0.333);
      sctx.lineTo(W, H * 0.333);
      sctx.moveTo(0, H * 0.666);
      sctx.lineTo(W, H * 0.666);
      sctx.stroke();

      // Power Point Reticles
      const points = [
        [W * 0.333, H * 0.333],
        [W * 0.666, H * 0.333],
        [W * 0.333, H * 0.666],
        [W * 0.666, H * 0.666],
      ];
      points.forEach(([px, py]) => {
        sctx.beginPath();
        sctx.arc(px, py, 6 * scaleFactor, 0, Math.PI * 2);
        sctx.stroke();
      });
    }

    // Z-Pattern Cognitive Scanning Vector Path
    if (layoutId === 'z-pattern') {
      sctx.setLineDash([6 * scaleFactor, 4 * scaleFactor]);
      sctx.lineWidth = 1.5 * scaleFactor;
      sctx.beginPath();
      sctx.moveTo(marginX, contentTopY + 12 * scaleFactor);
      sctx.lineTo(W - marginX, contentTopY + 12 * scaleFactor);
      sctx.lineTo(marginX, footerY - 14 * scaleFactor);
      sctx.lineTo(W - marginX, footerY - 14 * scaleFactor);
      sctx.stroke();
    }

    // F-Pattern Left Vertical Anchor Spine & Horizontal Shelves
    if (layoutId === 'f-pattern') {
      const spineX = marginX + 16 * scaleFactor;
      sctx.setLineDash([]);
      sctx.lineWidth = 2 * scaleFactor;
      sctx.beginPath();
      sctx.moveTo(spineX, contentTopY);
      sctx.lineTo(spineX, footerY);
      sctx.moveTo(spineX, contentTopY + 20 * scaleFactor);
      sctx.lineTo(W - marginX, contentTopY + 20 * scaleFactor);
      sctx.moveTo(spineX, contentTopY + usableH * 0.38);
      sctx.lineTo(W * 0.65, contentTopY + usableH * 0.38);
      sctx.stroke();
    }

    // Inverted Triangle Convergence Funnel Guides
    if (layoutId === 'inverted-triangle') {
      sctx.beginPath();
      sctx.moveTo(marginX, contentTopY + 10 * scaleFactor);
      sctx.lineTo(W / 2, footerY - 10 * scaleFactor);
      sctx.moveTo(W - marginX, contentTopY + 10 * scaleFactor);
      sctx.lineTo(W / 2, footerY - 10 * scaleFactor);
      sctx.stroke();
    }

    sctx.restore();
  }

  // --------------------------------------------------------------------------
  // SECTION 3: SAFE ZONE 9:16 GUIDELINES
  // --------------------------------------------------------------------------
  if (state.safeZone916) {
    sctx.save();
    sctx.strokeStyle = '#f43f5e';
    sctx.lineWidth = 1.2;
    sctx.setLineDash([6 * scaleFactor, 4 * scaleFactor]);
    sctx.globalAlpha = 0.55;

    // Bottom safe line
    sctx.beginPath();
    sctx.moveTo(0, H - bottomMargin);
    sctx.lineTo(W, H - bottomMargin);
    sctx.stroke();

    // Right safe line
    sctx.beginPath();
    sctx.moveTo(W - rightMargin, 0);
    sctx.lineTo(W - rightMargin, H);
    sctx.stroke();

    // Safe zone label
    sctx.fillStyle = '#f43f5e';
    sctx.font = `700 ${Math.round(8 * scaleFactor)}px "Space Mono", monospace`;
    sctx.fillText('9:16 SAFE ZONE // REELS & TIKTOK', marginX, H - bottomMargin - 6);
    sctx.restore();
  }
}
