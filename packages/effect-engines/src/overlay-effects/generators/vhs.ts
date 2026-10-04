import { BaseEffectEngine } from '@acc/core';
import { CanvasAdapterFactory } from '../canvas-strategies/factory';
import { CanvasAdapter } from '../canvas-strategies/base';
export class VHSEffect extends BaseEffectEngine {
  async renderAndPipe(outputPath: string): Promise<void> {
    const adapter = CanvasAdapterFactory.getAdapter('napi-rs');
    const canvas = adapter.createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    const totalFrames = Math.ceil(this.fps * this.duration);
    const { stream, promise } = this.initStream(outputPath);
    // tracking_lines: Glitchy horizontal lines rolling down
    // tracking_snow: Thick band of static noise
    // To make a seamless loop of rolling bands, we use modulo on the Y axis
    const speedY = this.height * 0.2; // Move down 20% of screen per second
    // Generate a fixed static noise tile to save CPU, then draw it where needed
    const noiseHeight = 200;
    const noiseCanvas = adapter.createCanvas(this.width, noiseHeight);
    const noiseCtx = noiseCanvas.getContext('2d') as any;
    // Fast JS static noise
    const imgData = noiseCtx.createImageData(this.width, noiseHeight);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Black and white static
      const val = Math.random() > 0.5 ? 255 : 0;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = Math.random() > 0.7 ? 200 : 0; // Lots of holes for transparency
    }
    noiseCtx.putImageData(imgData, 0, 0);
    process.stdout.write(`Rendering ${totalFrames} frames for VHS (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      const timeSec = frame / this.fps;

      // Always reset composite operation to source-over before drawing background
      ctx.globalCompositeOperation = 'source-over';

      if ((this.pipelineConfig.background === 'transparent')) {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.width, this.height);
      }

      // Exact speed to loop
      const exactSpeedY = (Math.ceil(speedY * this.duration / this.height) * this.height) / this.duration;
      const offsetY = (timeSec * exactSpeedY) % this.height;

      if (this.variantName === 'tracking_lines') {
        // High-impact VHS tracking error lines with RGB split and horizontal noise bands
        ctx.globalCompositeOperation = 'screen';

        const drawTrackingBand = (baseY: number, bandHeight: number, intensity: number) => {
          let y = (baseY + offsetY) % this.height;

          const drawPass = (currentY: number) => {
            // Draw multiple horizontal scanline slices inside the band
            const slices = Math.max(3, Math.floor(bandHeight / 4));
            for (let s = 0; s < slices; s++) {
              const sliceY = currentY + (s * (bandHeight / slices));
              const sliceH = Math.max(2, bandHeight / slices * 0.7);
              const jitter = (Math.random() - 0.5) * 20;

              // Red chromatic aberration
              ctx.fillStyle = `rgba(255, 30, 30, ${0.7 * intensity})`;
              ctx.fillRect(jitter - 8, sliceY - 2, this.width, sliceH);

              // Blue/Cyan chromatic aberration
              ctx.fillStyle = `rgba(0, 220, 255, ${0.7 * intensity})`;
              ctx.fillRect(jitter + 8, sliceY + 2, this.width, sliceH);

              // Intense white core with horizontal noise segments
              ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * intensity})`;
              ctx.fillRect(jitter, sliceY, this.width, sliceH);

              // Random high-frequency white static segments
              if (Math.random() > 0.3) {
                const segX = Math.random() * (this.width - 300);
                const segW = 100 + Math.random() * 200;
                ctx.fillStyle = `rgba(255, 255, 255, ${1.0 * intensity})`;
                ctx.fillRect(segX, sliceY - 1, segW, sliceH + 2);
              }
            }
          };

          drawPass(y);
          // Wrap around for seamless loop
          if (y + bandHeight > this.height) {
            drawPass(y - this.height);
          }
        };

        // Main prominent tracking band
        drawTrackingBand(this.height * 0.15, 28, 1.0);
        // Secondary medium tracking band
        drawTrackingBand(this.height * 0.55, 18, 0.8);
        // Subtle micro glitches
        drawTrackingBand(this.height * 0.85, 10, 0.6);

        // Bottom tape head switching noise (typical VHS artifact at bottom 2-3% of frame)
        const headSwitchY = this.height - 24;
        const headJitter = (Math.sin(timeSec * Math.PI * 8) * 15);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.fillRect(headJitter, headSwitchY, this.width, 8);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.fillRect(headJitter + 6, headSwitchY + 8, this.width, 6);

      } else if (this.variantName === 'tracking_snow') {
        // A thick band of static noise rolling up or down
        ctx.globalCompositeOperation = 'screen';
        const exactSpeedSnow = (Math.ceil(speedY * 1.5 * this.duration / this.height) * this.height) / this.duration;
        let y = this.height - ((timeSec * exactSpeedSnow) % this.height);
        const drawSnowBand = (yPos: number) => {
          // Draw the static noise texture
          const raw = (noiseCanvas as any).getRawCanvas ? (noiseCanvas as any).getRawCanvas() : noiseCanvas;
          (ctx as any).drawImage(raw, 0, yPos, this.width, noiseHeight);
          // Add RGB aberration lines at the edges of the snow band
          ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
          ctx.fillRect(0, yPos - 6, this.width, 6);
          ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
          ctx.fillRect(0, yPos + noiseHeight, this.width, 6);
        };
        drawSnowBand(y);
        // Wrap around
        if (y + noiseHeight > this.height) {
          drawSnowBand(y - this.height);
        }
        if (y < 0) {
          drawSnowBand(y + this.height);
        }
      } else {
        console.warn(`Variant '${this.variantName}' not recognized for vhs, doing nothing`);
      }
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
