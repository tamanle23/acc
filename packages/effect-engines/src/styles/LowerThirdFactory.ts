export interface LowerThirdSpec {
  name: string;
  title?: string;
  location?: string;
  stylePreset?: 'cinematic' | 'minimal' | 'bold_retro' | 'neon';
}

export class LowerThirdFactory {
  public static renderLowerThirdToCanvas(
    ctx: any,
    spec: LowerThirdSpec,
    canvasWidth = 1080,
    canvasHeight = 1920
  ): void {
    ctx.save();
    const padding = 24;
    const boxX = 60;
    const boxY = canvasHeight - 320;
    const boxW = Math.min(600, canvasWidth - 120);
    const boxH = 140;

    // Glassmorphic background card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.roundRect(boxX, boxY, boxW, boxH, 16);
    ctx.fill();

    // Accent line bar
    ctx.fillStyle = spec.stylePreset === 'neon' ? '#00ffff' : '#38bdf8';
    ctx.fillRect(boxX, boxY, 8, boxH);

    // Speaker Name
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(spec.name, boxX + padding + 10, boxY + 50);

    // Title / Location
    if (spec.title || spec.location) {
      ctx.font = '500 24px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(spec.title || spec.location || '', boxX + padding + 10, boxY + 95);
    }

    ctx.restore();
  }
}
