// ============================================================================
// KINETIX STUDIO v5.0 - PUBLISHING PRINT MASTER & 300 DPI ENGINE
// International ISO 216 & US Print Presets with Bleed, Crop Marks & Calibration Wedges
// ============================================================================

import type { StudioState } from '@/types/studio';
import { renderPosterComposition } from '@/engine/composition-engine';
import { computeChoreography } from '@/engine/choreography';
import { userAudioTrack } from '@/engine/audio-user-track';
import { downloadBlob } from '@/lib/export-video';
import { PdfVectorGeneratorAdapter } from '@/adapters/driven/pdf-vector-generator.adapter';

export interface PrintPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  ratio: string;
  description: string;
}

export const PRINT_PRESETS: PrintPreset[] = [
  { id: 'iso-a1', name: 'ISO A1 (594 × 841 mm)', widthMm: 594, heightMm: 841, ratio: '1:1.414', description: 'European Exhibition & Gallery Master' },
  { id: 'iso-a2', name: 'ISO A2 (420 × 594 mm)', widthMm: 420, heightMm: 594, ratio: '1:1.414', description: 'Standard Retail & Gallery Exhibition Print' },
  { id: 'iso-a3', name: 'ISO A3 (297 × 420 mm)', widthMm: 297, heightMm: 420, ratio: '1:1.414', description: 'Small-Run Monograph, Zine & Broadsheet' },
  { id: 'us-poster', name: 'US Standard Poster (18 × 24 in)', widthMm: 457.2, heightMm: 609.6, ratio: '3:4', description: 'American Gig Poster & Screenprint Standard' },
  { id: 'us-one-sheet', name: 'US Theatrical One-Sheet (27 × 40 in)', widthMm: 685.8, heightMm: 1016, ratio: '1:1.48', description: 'Cinema Release Poster Standard' },
];

/**
 * Calculates safe export resolution considering mobile device memory ceilings.
 */
export function getSafeExportScale(
  widthMm: number,
  heightMm: number,
  targetDpi = 300
): { dpi: number; scale: number; isClamped: boolean; totalMegapixels: number } {
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  // iOS Safari hard canvas allocation limit is 16 Megapixels
  const maxPixels = isIOS ? 16_000_000 : 100_000_000;

  const targetW = Math.round((widthMm / 25.4) * targetDpi);
  const targetH = Math.round((heightMm / 25.4) * targetDpi);
  const totalPixels = targetW * targetH;
  const totalMegapixels = Number((totalPixels / 1_000_000).toFixed(1));

  if (totalPixels <= maxPixels) {
    return { dpi: targetDpi, scale: 1.0, isClamped: false, totalMegapixels };
  }

  const scale = Math.sqrt(maxPixels / totalPixels);
  const clampedDpi = Math.floor(targetDpi * scale);
  return { dpi: clampedDpi, scale, isClamped: true, totalMegapixels };
}

/**
 * Renders professional physical print production marks into the bleed margin:
 * - Corner crop/trim marks
 * - Midpoint registration crosshairs
 * - 6-step CMYK density verification wedge
 * - Production job slug line
 */
export function renderPrintMarks(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  bleedPx: number,
  markColor = '#09090b',
  slugText = 'KINETIX STUDIO // PRINT MASTER 300 DPI'
): void {
  ctx.save();
  ctx.strokeStyle = markColor;
  ctx.fillStyle = markColor;
  ctx.lineWidth = Math.max(1, Math.round(bleedPx * 0.08));

  const markLen = bleedPx * 0.85;
  const gap = bleedPx * 0.15;

  // Trim Box Coordinates
  const trimX1 = bleedPx;
  const trimY1 = bleedPx;
  const trimX2 = canvasW - bleedPx;
  const trimY2 = canvasH - bleedPx;

  // 1. CORNER CROP MARKS
  // Top-Left
  ctx.beginPath();
  ctx.moveTo(trimX1 - gap - markLen, trimY1);
  ctx.lineTo(trimX1 - gap, trimY1);
  ctx.moveTo(trimX1, trimY1 - gap - markLen);
  ctx.lineTo(trimX1, trimY1 - gap);

  // Top-Right
  ctx.moveTo(trimX2 + gap, trimY1);
  ctx.lineTo(trimX2 + gap + markLen, trimY1);
  ctx.moveTo(trimX2, trimY1 - gap - markLen);
  ctx.lineTo(trimX2, trimY1 - gap);

  // Bottom-Left
  ctx.moveTo(trimX1 - gap - markLen, trimY2);
  ctx.lineTo(trimX1 - gap, trimY2);
  ctx.moveTo(trimX1, trimY2 + gap);
  ctx.lineTo(trimX1, trimY2 + gap + markLen);

  // Bottom-Right
  ctx.moveTo(trimX2 + gap, trimY2);
  ctx.lineTo(trimX2 + gap + markLen, trimY2);
  ctx.moveTo(trimX2, trimY2 + gap);
  ctx.lineTo(trimX2, trimY2 + gap + markLen);
  ctx.stroke();

  // 2. MIDPOINT REGISTRATION CROSSHAIRS
  const midX = canvasW / 2;
  const midY = canvasH / 2;
  const regRadius = bleedPx * 0.35;

  const drawRegTarget = (cx: number, cy: number) => {
    ctx.beginPath();
    ctx.arc(cx, cy, regRadius, 0, Math.PI * 2);
    ctx.moveTo(cx - regRadius * 1.4, cy);
    ctx.lineTo(cx + regRadius * 1.4, cy);
    ctx.moveTo(cx, cy - regRadius * 1.4);
    ctx.lineTo(cx, cy + regRadius * 1.4);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, regRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  };

  drawRegTarget(midX, bleedPx * 0.45); // Top
  drawRegTarget(midX, canvasH - bleedPx * 0.45); // Bottom
  drawRegTarget(bleedPx * 0.45, midY); // Left
  drawRegTarget(canvasW - bleedPx * 0.45, midY); // Right

  // 3. CMYK DENSITY CALIBRATION WEDGE
  const wedgeW = bleedPx * 0.4;
  const wedgeH = bleedPx * 0.25;
  const wedgeY = canvasH - bleedPx * 0.65;
  const densities = [
    '#00ffff', // Cyan
    '#ff00ff', // Magenta
    '#ffff00', // Yellow
    '#000000', // Key Black
    'rgba(0,0,0,0.5)', // 50% K
    'rgba(0,0,0,0.25)', // 25% K
  ];

  densities.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(midX - (densities.length * wedgeW) / 2 + i * wedgeW, wedgeY, wedgeW, wedgeH);
    ctx.strokeRect(midX - (densities.length * wedgeW) / 2 + i * wedgeW, wedgeY, wedgeW, wedgeH);
  });

  // 4. PRODUCTION SLUG LINE
  ctx.fillStyle = markColor;
  ctx.font = `600 ${Math.max(9, Math.round(bleedPx * 0.24))}px "Space Mono", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(slugText, trimX1, bleedPx * 0.45);

  ctx.restore();
}

export interface ExportPrintMasterOptions {
  state: StudioState;
  presetId?: string;
  includeMarks?: boolean;
  bleedMm?: number;
  frame?: number;
  fileHandle?: any;
  autoDownload?: boolean;
}

/**
 * Renders and exports a 300 DPI master print deck with bleed margins and crop marks.
 */
export async function exportPrintMasterDeck(
  options: ExportPrintMasterOptions
): Promise<Blob | null> {
  const {
    state,
    presetId = 'iso-a1',
    includeMarks = true,
    bleedMm = 3,
    frame = 0,
    fileHandle,
  } = options;

  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  const preset = PRINT_PRESETS.find((p) => p.id === presetId) || PRINT_PRESETS[0];

  const totalWidthMm = preset.widthMm + (includeMarks ? bleedMm * 2 : 0);
  const totalHeightMm = preset.heightMm + (includeMarks ? bleedMm * 2 : 0);

  const { dpi } = getSafeExportScale(totalWidthMm, totalHeightMm, 300);

  const canvasW = Math.round((totalWidthMm / 25.4) * dpi);
  const canvasH = Math.round((totalHeightMm / 25.4) * dpi);
  const bleedPx = includeMarks ? Math.round((bleedMm / 25.4) * dpi) : 0;
  const contentW = canvasW - bleedPx * 2;
  const contentH = canvasH - bleedPx * 2;

  const out = document.createElement('canvas');
  out.width = canvasW;
  out.height = canvasH;
  const ctx = out.getContext('2d');
  if (!ctx) return null;

  // Fill canvas with background color for bleed area
  ctx.fillStyle = state.palette.bg;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const totalFrames = Math.max(24, Math.round(state.durationSec * state.fps));
  const progress = totalFrames > 0 ? (frame % totalFrames) / totalFrames : 0;
  const choreo = computeChoreography(
    progress,
    state.timelineMode,
    state.hicksLawDisclosure,
    state.customKeyframes,
    state.choreoMode
  );
  const timeSec = progress * state.durationSec;
  const telemetry =
    state.audioSource === 'user-file'
      ? userAudioTrack.getTelemetryAtTime(timeSec)
      : undefined;

  ctx.save();
  ctx.translate(bleedPx, bleedPx);

  const baseScale = contentW / 1080;
  const baseH = contentH / baseScale;

  renderPosterComposition(ctx, {
    width: 1080,
    height: baseH,
    state,
    frame,
    totalFrames,
    choreo,
    scale: baseScale,
    audioTelemetry: telemetry,
  });
  ctx.restore();

  if (includeMarks) {
    const slug = `KINETIX STUDIO // ${preset.name.toUpperCase()} // ${dpi} DPI // CMYK PROOF // BLEED ${bleedMm}MM`;
    renderPrintMarks(ctx, canvasW, canvasH, bleedPx, state.palette.accent, slug);
  }

  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  const filename = `${state.posterId}-${preset.id}-300dpi.png`;

  if (!blob) {
    try {
      const dataUrl = out.toDataURL('image/png');
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 10000);
    } catch (err) {
      console.warn(
        'Canvas export failed: memory allocation limit exceeded for 300 DPI canvas buffer',
        err
      );
    }
    return null;
  }

  if (fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (e) {
      console.warn('File handle write failed, falling back to blob download', e);
      if (options.autoDownload) {
        downloadBlob(blob, filename);
      }
    }
  } else if (options.autoDownload) {
    downloadBlob(blob, filename);
  }

  return blob;
}

export interface ExportVectorPdfOptions {
  state: StudioState;
  presetId?: string;
  bleedMm?: number;
  includeSpotPlate?: boolean;
  autoDownload?: boolean;
  fileHandle?: any;
}

/**
 * Generates and downloads a resolution-independent DeviceCMYK vector PDF master deck.
 */
export async function exportVectorPdfDeck(
  options: ExportVectorPdfOptions
): Promise<Blob> {
  const adapter = new PdfVectorGeneratorAdapter();
  const result = adapter.generatePdf({
    state: options.state,
    presetId: options.presetId,
    bleedMm: options.bleedMm,
    includeSpotPlate: options.includeSpotPlate,
  });

  if (options.fileHandle) {
    try {
      const writable = await options.fileHandle.createWritable();
      await writable.write(result.blob);
      await writable.close();
    } catch (e) {
      console.warn('File handle write failed for PDF:', e);
      if (options.autoDownload) {
        downloadBlob(result.blob, result.filename);
      }
    }
  } else if (options.autoDownload) {
    downloadBlob(result.blob, result.filename);
  }

  return result.blob;
}
