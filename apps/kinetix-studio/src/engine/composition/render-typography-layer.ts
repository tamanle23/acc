import type { SafeCanvas2D } from '@/lib/safe-canvas-2d';
import type { StudioState } from '@/types/studio';
import type { ChoreographyEnvelope, AudioTelemetry } from '@/types/motion';
import type { SpatialSkeletonSpec } from '@/types/spatial';
import { calculateWcagContrast } from '@/core/domain/color';
import { getFontFamilyWithFallback } from '@/lib/font-catalog';

export interface RenderTypographyLayerOptions {
  sctx: SafeCanvas2D;
  width: number;
  height: number;
  state: StudioState;
  spec: SpatialSkeletonSpec;
  theta: number;
  choreo: ChoreographyEnvelope;
  scaleFactor: number;
  marginX: number;
  marginY: number;
  topHeaderY: number;
  contentTopY: number;
  typeX: number;
  typeY: number;
  typeW: number;
  footerY: number;
  audioTelemetry?: AudioTelemetry;
  typeAlign?: 'left' | 'center' | 'right';
  typeScale?: number;
}

/**
 * Layer 2: Top Header Bar, Marquee Ticker, Kinetic Typography & Footer Lockup
 */
export function renderTypographyLayer({
  sctx,
  width: W,
  state,
  spec,
  theta,
  choreo,
  scaleFactor,
  marginX,
  topHeaderY,
  contentTopY,
  typeX,
  typeY,
  typeW,
  footerY,
  audioTelemetry,
  typeAlign,
  typeScale = 1.0,
}: RenderTypographyLayerOptions): void {
  const { palette } = state;

  // 1. TOP TELEMETRY HEADER BAR
  sctx.save();
  sctx.strokeStyle = palette.ink;
  sctx.globalAlpha = 0.18;
  sctx.beginPath();
  sctx.moveTo(marginX, topHeaderY + 8 * scaleFactor);
  sctx.lineTo(W - marginX, topHeaderY + 8 * scaleFactor);
  sctx.stroke();
  sctx.globalAlpha = 1;

  // Subhead
  const subheadFontFamily = state.subheadFont
    ? getFontFamilyWithFallback(state.subheadFont)
    : '"Space Mono", monospace';
  sctx.fillStyle = palette.ink;
  sctx.font = `700 ${Math.round(9 * scaleFactor)}px ${subheadFontFamily}`;
  sctx.textAlign = 'left';
  sctx.textBaseline = 'middle';
  sctx.fillText(state.content.subhead, marginX, topHeaderY);

  // Category Tag Badge Pill
  const tagText = state.content.tag.toUpperCase();
  sctx.font = `800 ${Math.round(8 * scaleFactor)}px "Space Mono", monospace`;
  const tagMetrics = sctx.measureText(tagText);
  const tagW = tagMetrics.width + 12 * scaleFactor;
  const tagH = 14 * scaleFactor;
  const tagX = W - marginX - tagW;
  const tagY = topHeaderY - tagH / 2;

  sctx.fillStyle = palette.accent;
  sctx.roundRect(tagX, tagY, tagW, tagH, 3 * scaleFactor);
  sctx.fill();

  sctx.fillStyle = palette.bg;
  sctx.textAlign = 'center';
  sctx.fillText(tagText, tagX + tagW / 2, topHeaderY);
  sctx.restore();

  // 2. TICKER BAND MARQUEE STRIP
  if (state.layoutId === 'ticker-band') {
    sctx.save();
    const tickerH = 16 * scaleFactor;
    sctx.fillStyle = palette.accent;
    sctx.fillRect(0, contentTopY, W, tickerH);

    sctx.fillStyle = palette.bg;
    sctx.font = `800 ${Math.round(8 * scaleFactor)}px "Space Mono", monospace`;
    sctx.textAlign = 'left';
    sctx.textBaseline = 'middle';

    const tickerText = `/// ${state.content.headline.join(' • ')} /// ${state.content.location} /// `;
    const tMetrics = sctx.measureText(tickerText);
    const scrollX = (theta * 80 * scaleFactor) % tMetrics.width;

    sctx.fillText(tickerText, -scrollX, contentTopY + tickerH / 2);
    sctx.fillText(tickerText, -scrollX + tMetrics.width, contentTopY + tickerH / 2);
    sctx.fillText(tickerText, -scrollX + tMetrics.width * 2, contentTopY + tickerH / 2);
    sctx.restore();
  }

  // 3. MAIN KINETIC TYPOGRAPHY ENGINE (12 MODES)
  sctx.save();
  const isCenterAligned = typeAlign ? typeAlign === 'center' : spec.headlineAlignClass.includes('center');
  const isRightAligned = typeAlign ? typeAlign === 'right' : spec.headlineAlignClass.includes('right');

  const baseFontSize = Math.round(
    W * 0.095 * typeScale
  );
  const lineStep = baseFontSize * 0.94;
  const lines = state.content.headline;

  const wcag = calculateWcagContrast(palette.ink, palette.bg);

  // Automatic WCAG Contrast Scrim
  if (wcag < 4.5) {
    sctx.save();
    const scrimPad = 12 * scaleFactor;
    const scrimX = isCenterAligned
      ? typeX + typeW * 0.5 - typeW * 0.48 - scrimPad
      : isRightAligned
      ? typeX + typeW - typeW * 0.85 - scrimPad
      : typeX - scrimPad;
    const scrimW = isCenterAligned ? typeW * 0.96 + scrimPad * 2 : typeW * 0.85;
    const scrimH = lineStep * 3 + scrimPad * 2;
    const scrimY = typeY - scrimPad;

    sctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    sctx.roundRect(scrimX, scrimY, scrimW, scrimH, 8 * scaleFactor);
    sctx.fill();
    sctx.restore();
  }

  // Mid-frequency audio tracking boost
  const midAudioBoost = state.audioReactive && audioTelemetry ? 1 + audioTelemetry.mid * 0.28 : 1;

  lines.forEach((lineText, lineIdx) => {
    sctx.save();
    const phaseOffset = (lineIdx * state.staggerMs) / 240;
    const wave = Math.sin(theta - phaseOffset);
    const cosWave = Math.cos(theta - phaseOffset);
    const focusMultiplier = state.primaryFocusZone === 'headline' ? 1.35 : 0.85;
    const amp = choreo.typeEnergyScale * focusMultiplier * midAudioBoost;

    // Vertical entrance animation from choreography
    const entranceY = (1 - choreo.headlineReveal) * 24 * scaleFactor;
    const curLineY = typeY + lineIdx * lineStep + entranceY;
    const curLineX = isCenterAligned
      ? typeX + typeW * 0.5
      : isRightAligned
      ? typeX + typeW
      : typeX;

    sctx.translate(curLineX, curLineY);

    // Base font configuration (incorporates user uploaded custom font or state.headlineFont)
    const activeHeadlineFamily = state.customFontFamily
      ? `"${state.customFontFamily}", sans-serif`
      : state.headlineFont
      ? getFontFamilyWithFallback(state.headlineFont)
      : '"Syne", sans-serif';
    const weight = state.headlineWeight || 900;
    sctx.font = `${weight} ${baseFontSize}px ${activeHeadlineFamily}`;
    sctx.textAlign = isCenterAligned ? 'center' : isRightAligned ? 'right' : 'left';
    sctx.textBaseline = 'top';

    if (state.letterSpacing) {
      const trackPx = state.letterSpacing * baseFontSize;
      sctx.letterSpacing = `${trackPx.toFixed(1)}px`;
    }

    let textToRender = lineText;
    if (state.textTransform === 'uppercase') {
      textToRender = lineText.toUpperCase();
    } else if (state.textTransform === 'lowercase') {
      textToRender = lineText.toLowerCase();
    } else if (state.textTransform === 'capitalize') {
      textToRender = lineText.replace(/\b\w/g, (c) => c.toUpperCase());
    }

    const textColor = lineIdx === 1 ? palette.accent : palette.ink;
    sctx.globalAlpha = choreo.headlineReveal;

    // Evaluate 16 Kinetic Typography Animation Modes
    switch (state.kineticTypeId) {
      case 'slide-shear': {
        const tx = wave * 14 * amp * scaleFactor;
        const skewAngle = (wave * -12 * amp * Math.PI) / 180;
        sctx.translate(tx, 0);
        sctx.transform(1, 0, Math.tan(skewAngle), 1, 0, 0);
        break;
      }

      case 'weight-wave': {
        const tx = wave * 6 * amp * scaleFactor;
        sctx.translate(tx, 0);
        sctx.scale(1, 1 + wave * 0.14 * amp);
        break;
      }

      case 'track-expand': {
        const extraSpacing = (0.02 + Math.abs(wave) * 0.14 * amp) * baseFontSize;
        sctx.letterSpacing = `${extraSpacing.toFixed(1)}px`;
        break;
      }

      case 'editorial-reveal': {
        const extraTrack = (0.04 + Math.abs(wave) * 0.18 * amp) * baseFontSize;
        sctx.letterSpacing = `${extraTrack.toFixed(1)}px`;
        const curtainY = (1 - choreo.headlineReveal) * (18 + lineIdx * 10) * scaleFactor;
        sctx.translate(0, curtainY);
        break;
      }

      case 'rotary-typeset': {
        const rArc = Math.max(90, W * 0.28);
        const arcSpread = Math.PI * 0.65;
        const startAng = -Math.PI / 2 - arcSpread / 2 + wave * 0.15 * amp;
        const chars = textToRender.split('');
        const charStep = arcSpread / Math.max(1, chars.length - 1);
        sctx.fillStyle = textColor;
        chars.forEach((ch, ci) => {
          const ca = startAng + ci * charStep;
          sctx.save();
          sctx.translate(Math.cos(ca) * rArc, Math.sin(ca) * rArc);
          sctx.rotate(ca + Math.PI / 2);
          sctx.fillText(ch, 0, 0);
          sctx.restore();
        });
        sctx.restore();
        return;
      }

      case 'analog-cinematic-drift': {
        const driftScale = 1.0 + Math.sin(theta * 0.5) * 0.035 * amp;
        const driftX = Math.cos(theta * 0.3) * 4 * amp * scaleFactor;
        const driftY = Math.sin(theta * 0.25) * 3 * amp * scaleFactor;
        sctx.scale(driftScale, driftScale);
        sctx.translate(driftX, driftY);
        break;
      }

      case 'swing-polyrhythm': {
        const swingDelay = 0.33 * Math.PI;
        const chars = textToRender.split('');
        sctx.fillStyle = textColor;
        let cumulativeX = 0;
        chars.forEach((ch, ci) => {
          const charWave = Math.sin(theta * 2 - (ci % 2 === 1 ? swingDelay : 0));
          const charY = charWave * 6 * amp * scaleFactor;
          sctx.save();
          sctx.translate(cumulativeX, charY);
          sctx.fillText(ch, 0, 0);
          cumulativeX +=
            sctx.measureText(ch).width +
            (state.letterSpacing ? state.letterSpacing * baseFontSize : 1);
          sctx.restore();
        });
        sctx.restore();
        return;
      }

      case 'perspective-shear': {
        const rotY = (wave * 22 * amp * Math.PI) / 180;
        const skewY = (cosWave * 4 * amp * Math.PI) / 180;
        sctx.scale(Math.cos(rotY), 1);
        sctx.transform(1, Math.tan(skewY), 0, 1, 0, 0);
        break;
      }

      case 'cylinder-3d': {
        const angle = (wave * 32 * amp * Math.PI) / 180;
        sctx.scale(1, Math.cos(angle));
        sctx.translate(0, -Math.sin(angle) * 10 * scaleFactor);
        break;
      }

      case 'rgb-glitch': {
        const split = (2.5 + Math.abs(wave) * 5) * amp * scaleFactor;
        sctx.fillStyle = palette.accent;
        sctx.fillText(textToRender, -split, 0);
        sctx.fillStyle = palette.accent2;
        sctx.fillText(textToRender, split, 0);
        break;
      }

      case 'bounce-floor': {
        const bounceY = -Math.abs(wave) * 16 * amp * scaleFactor;
        const squashY = 1 - Math.abs(cosWave) * 0.08 * amp;
        sctx.translate(0, bounceY);
        sctx.scale(1, squashY);
        break;
      }

      case 'strobe-gate': {
        sctx.globalAlpha =
          choreo.headlineReveal * (0.55 + 0.45 * Math.sin(theta * 2 - lineIdx));
        break;
      }

      case 'accordion': {
        const scaleY = 0.78 + (wave + 1) * 0.25 * amp;
        sctx.scale(1, scaleY);
        break;
      }

      case 'pendulum': {
        const rot = (wave * 5 * amp * Math.PI) / 180;
        sctx.rotate(rot);
        break;
      }

      case 'orbital-swirl': {
        const ox = wave * 8 * amp * scaleFactor;
        const oy = cosWave * 5 * amp * scaleFactor;
        sctx.translate(ox, oy);
        break;
      }

      case 'outline-breathe': {
        if (lineIdx !== 1) {
          sctx.strokeStyle = palette.ink;
          sctx.lineWidth = 2 * scaleFactor;
          sctx.shadowColor = palette.accent;
          sctx.shadowBlur = Math.abs(wave) * 14 * amp * scaleFactor;
          sctx.strokeText(textToRender, 0, 0);
          sctx.restore();
          return;
        }
        break;
      }
    }

    sctx.fillStyle = textColor;
    sctx.fillText(textToRender, 0, 0);
    sctx.restore();
  });
  sctx.restore();

  // 4. SECONDARY INFO FOOTER (DATE / LOCATION / SPONSOR & BILLING BLOCK)
  sctx.save();
  const metaY = footerY;
  sctx.globalAlpha = choreo.metaReveal;
  sctx.translate(0, (1 - choreo.metaReveal) * 5 * scaleFactor);

  // Divider Line
  sctx.strokeStyle = palette.ink;
  sctx.globalAlpha = 0.16 * choreo.metaReveal;
  sctx.beginPath();
  sctx.moveTo(marginX, metaY);
  sctx.lineTo(W - marginX, metaY);
  sctx.stroke();

  // Date & Location Row (Max half-width prevents collision)
  const maxHalfW = (W - marginX * 2) * 0.48;
  sctx.globalAlpha = choreo.metaReveal;
  sctx.font = `700 ${Math.round(9.5 * scaleFactor)}px "Space Mono", monospace`;
  sctx.textBaseline = 'top';

  sctx.fillStyle = palette.accent;
  sctx.textAlign = 'left';
  sctx.fillText(state.content.date, marginX, metaY + 6 * scaleFactor, maxHalfW);

  sctx.fillStyle = palette.ink;
  sctx.textAlign = 'right';
  sctx.fillText(state.content.location, W - marginX, metaY + 6 * scaleFactor, maxHalfW);

  // Sponsor & Billing Block Line (Bounded to full usable width)
  sctx.fillStyle = palette.ink;
  sctx.globalAlpha = 0.65 * choreo.metaReveal;
  sctx.font = `500 ${Math.round(8 * scaleFactor)}px "Space Mono", monospace`;
  sctx.textAlign = 'left';
  sctx.fillText(state.content.sponsor, marginX, metaY + 19 * scaleFactor, W - marginX * 2);

  sctx.restore();
}
