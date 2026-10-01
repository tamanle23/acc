import type { CaptionConfig, CaptionSettings } from '../types';
import { PRESETS } from '../styles';

export function groupCaptionsIntoPhrases(captions: CaptionConfig[], wordsPerPhrase: number): CaptionConfig[][] {
  if (wordsPerPhrase <= 1) return captions.map(c => [c]);

  const phrases: CaptionConfig[][] = [];
  let currentPhrase: CaptionConfig[] = [];

  for (let i = 0; i < captions.length; i++) {
    const word = captions[i];
    currentPhrase.push(word);

    const isPunctuation = /[.!?]$/.test(word.text.trim());
    const nextWord = captions[i + 1];
    const isLongPause = nextWord && (nextWord.start - word.end) > 0.45;

    if (currentPhrase.length >= wordsPerPhrase || isPunctuation || isLongPause) {
      phrases.push(currentPhrase);
      currentPhrase = [];
    }
  }

  if (currentPhrase.length > 0) {
    phrases.push(currentPhrase);
  }

  return phrases;
}

/**
 * Draws styled, frame-perfect subtitles directly onto a Canvas 2D context.
 * Supports karaoke word-level highlighting, scale/glow animations, and preset styles.
 */
export function drawCanvasCaptions(
  ctx: any,
  captions: CaptionConfig[] | undefined,
  timeSec: number,
  settings: CaptionSettings | undefined,
  width: number,
  height: number
): void {
  if (!captions || captions.length === 0) return;

  const wordsPerPhrase = settings?.wordsPerPhrase ?? 1;
  const phrases = groupCaptionsIntoPhrases(captions, wordsPerPhrase);

  // Find active phrase
  const activePhrase = phrases.find(p => {
    const start = p[0].start;
    const end = p[p.length - 1].end + 0.2; // slight grace window
    return timeSec >= start && timeSec <= end;
  });

  if (!activePhrase || activePhrase.length === 0) return;

  // Resolve style configurations
  const presetName = settings?.preset || 'classic';
  const base = PRESETS[presetName] || PRESETS['classic'];

  const scale = height / 1080;
  const baseFontSize = settings?.fontSize ?? base.fontSize ?? 44;
  const fontSize = Math.max(16, Math.round(baseFontSize * scale));
  const fontName = settings?.fontName ?? base.fontName ?? 'Arial';

  const isHeavyFont = /black|bold|heavy/i.test(fontName) || ['tiktok', 'neon-glow', 'bold-retro'].includes(presetName);
  const fontWeight = isHeavyFont ? '900' : 'bold';

  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px "${fontName}", "Segoe UI", Arial, sans-serif`;
  ctx.textBaseline = 'middle';

  const primaryColor = settings?.primaryColor ?? base.primaryColor ?? '#FFFFFF';
  const outlineColor = settings?.outlineColor ?? base.outlineColor ?? '#000000';
  const shadowColor = settings?.shadowColor ?? base.shadowColor ?? '#000000';
  const outlineSize = Math.round((settings?.outlineSize ?? base.outlineSize ?? 3) * scale);
  const shadowSize = Math.round((settings?.shadowSize ?? base.shadowSize ?? 2) * scale);
  const borderStyle = settings?.borderStyle ?? base.borderStyle ?? 1;

  const activeWordHighlight = settings?.activeWordHighlight ?? (settings as any)?.['active-word-highlight'] ?? false;
  const highlightPreset = activeWordHighlight
    ? (settings?.highlightPreset && settings.highlightPreset !== 'none' ? settings.highlightPreset : 'color')
    : 'none';
  const highlightColor = settings?.highlightColor ?? (presetName === 'tiktok' ? '#FFFF00' : '#00FFFF');

  // Compute Vertical Position
  const marginV = Math.round((settings?.marginV ?? base.marginV ?? 65) * scale);
  let y = height - marginV;
  if (settings?.position === 'top' || settings?.position === 'top-center') {
    y = marginV + fontSize;
  } else if (settings?.position === 'center' || settings?.position === 'middle') {
    y = height / 2;
  }

  // Measure word dimensions
  const spaceW = ctx.measureText(' ').width;
  const wordMetrics = activePhrase.map(w => ({
    word: w,
    cleanText: w.text.trim(),
    width: ctx.measureText(w.text.trim()).width
  }));

  const totalPhraseWidth = wordMetrics.reduce((sum, m) => sum + m.width, 0) + (wordMetrics.length - 1) * spaceW;

  // Compute Horizontal Start Position
  let xStart = (width - totalPhraseWidth) / 2;
  if (settings?.position === 'bottom-left' || settings?.position === 'top-left') {
    const marginL = Math.round((settings?.marginL ?? settings?.marginH ?? 50) * scale);
    xStart = marginL;
  } else if (settings?.position === 'bottom-right' || settings?.position === 'top-right') {
    const marginR = Math.round((settings?.marginR ?? settings?.marginH ?? 50) * scale);
    xStart = width - totalPhraseWidth - marginR;
  }

  // Draw Opaque Box if borderStyle === 3 (vlog / news-banner)
  if (borderStyle === 3) {
    const padX = Math.round(18 * scale);
    const padY = Math.round(10 * scale);
    const boxX = xStart - padX;
    const boxY = y - fontSize / 2 - padY;
    const boxW = totalPhraseWidth + padX * 2;
    const boxH = fontSize + padY * 2;

    ctx.save();
    ctx.fillStyle = shadowColor || 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, 8 * scale) : ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.fill();
    ctx.restore();
  }

  // Draw Words with Karaoke Highlighting
  let currentX = xStart;

  for (let i = 0; i < wordMetrics.length; i++) {
    const m = wordMetrics[i];
    const nextStart = (i === wordMetrics.length - 1) ? (m.word.end + 0.25) : wordMetrics[i + 1].word.start;
    const isWordActive = timeSec >= m.word.start && timeSec < nextStart;

    ctx.save();

    let wordColor = primaryColor;
    let wordScale = 1.0;

    if (isWordActive && highlightPreset !== 'none') {
      wordColor = highlightColor;

      if (highlightPreset === 'scale' || highlightPreset === 'scale-color') {
        wordScale = 1.12;
      }

      if (highlightPreset === 'glow') {
        ctx.shadowColor = highlightColor;
        ctx.shadowBlur = Math.round(16 * scale);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    }

    if (wordScale !== 1.0) {
      const centerX = currentX + m.width / 2;
      const centerY = y;
      ctx.translate(centerX, centerY);
      ctx.scale(wordScale, wordScale);
      ctx.translate(-centerX, -centerY);
    }

    // Shadow setup (when not glowing)
    if (shadowSize > 0 && !(isWordActive && highlightPreset === 'glow')) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowSize * 1.5;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = shadowSize;
    }

    // Outline / Stroke
    if (outlineSize > 0 && borderStyle !== 3) {
      ctx.lineWidth = outlineSize * 2;
      ctx.strokeStyle = outlineColor;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(m.cleanText, currentX, y);
    }

    // Text Fill
    ctx.fillStyle = wordColor;
    ctx.fillText(m.cleanText, currentX, y);

    ctx.restore();

    currentX += m.width + spaceW;
  }

  ctx.restore();
}
