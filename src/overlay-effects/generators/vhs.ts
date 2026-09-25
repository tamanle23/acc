import { BaseEffectEngine } from '../../core/BaseEffectEngine';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class VHSEffect extends BaseEffectEngine {
  async renderAndPipe(outputPath: string): Promise<void> {
let adapter: CanvasAdapter;
    if ('napi-rs' === 'napi-rs') {
      adapter = new NapiRsCanvasAdapter();
    } else {
      throw new Error(`Canvas engine ${'napi-rs'} not supported yet.`);
    }
    const canvas = adapter.createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    const totalFrames = Math.ceil(this.fps * this.duration);
    const { stream, promise } = this.setupFFmpegStream(outputPath);
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
      data[i+1] = val;
      data[i+2] = val;
      data[i+3] = Math.random() > 0.7 ? 200 : 0; // Lots of holes for transparency
    }
    noiseCtx.putImageData(imgData, 0, 0);
    process.stdout.write(`Rendering ${totalFrames} frames for VHS (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      const timeSec = frame / this.fps;
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
        // Draw multiple horizontal lines with Chromatic Aberration (RGB split)
        const drawGlitchLine = (baseY: number, height: number) => {
          let y = (baseY + offsetY) % this.height;
          // Slight random horizontal jitter
          const jitter = (Math.random() - 0.5) * 10;
          ctx.globalCompositeOperation = 'screen';
          // Red channel displacement
          ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
          ctx.fillRect(jitter - 4, y - 2, this.width, height);
          // Blue channel displacement
          ctx.fillStyle = 'rgba(0, 0, 255, 0.6)';
          ctx.fillRect(jitter + 4, y + 2, this.width, height);
          // Green/White core
          ctx.fillStyle = 'rgba(100, 255, 100, 0.8)';
          ctx.fillRect(jitter, y, this.width, height);
          // Draw a second time wrapped for seamless loop if it crosses bottom
          if (y + height > this.height) {
            y -= this.height;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
            ctx.fillRect(jitter - 4, y - 2, this.width, height);
            ctx.fillStyle = 'rgba(0, 0, 255, 0.6)';
            ctx.fillRect(jitter + 4, y + 2, this.width, height);
            ctx.fillStyle = 'rgba(100, 255, 100, 0.8)';
            ctx.fillRect(jitter, y, this.width, height);
          }
        };
        drawGlitchLine(this.height * 0.1, 4);
        drawGlitchLine(this.height * 0.4, 2);
        drawGlitchLine(this.height * 0.7, 8);
        drawGlitchLine(this.height * 0.9, 3);
      } else if (this.variantName === 'tracking_snow') {
        // A thick band of static noise rolling up or down
        // We'll roll it UP for a classic VHS tracking error feel
        const exactSpeedSnow = (Math.ceil(speedY * 1.5 * this.duration / this.height) * this.height) / this.duration;
        let y = this.height - ((timeSec * exactSpeedSnow) % this.height);
        const drawSnowBand = (yPos: number) => {
          // Draw the static noise texture
          const raw = (noiseCanvas as any).getRawCanvas ? (noiseCanvas as any).getRawCanvas() : noiseCanvas;
          (ctx as any).drawImage(raw, 0, yPos, this.width, noiseHeight);
          // Add RGB aberration lines at the edges of the snow band
          ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
          ctx.fillRect(0, yPos - 5, this.width, 5);
          ctx.fillStyle = 'rgba(0, 0, 255, 0.8)';
          ctx.fillRect(0, yPos + noiseHeight, this.width, 5);
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
