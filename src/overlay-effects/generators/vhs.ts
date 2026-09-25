import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateVHSEffect: EffectGenerator = {
  name: 'vhs',
  generate: async (config: OverlayEffectConfig, pipeline: EffectPipeline) => {
    let adapter: CanvasAdapter;
    if (config.canvasEngine === 'napi-rs') {
      adapter = new NapiRsCanvasAdapter();
    } else {
      throw new Error(`Canvas engine ${config.canvasEngine} not supported yet.`);
    }

    const canvas = adapter.createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    
    const totalFrames = Math.ceil(config.fps * config.duration);
    
    // tracking_lines: Glitchy horizontal lines rolling down
    // tracking_snow: Thick band of static noise
    
    // To make a seamless loop of rolling bands, we use modulo on the Y axis
    const speedY = config.height * 0.2; // Move down 20% of screen per second
    
    // Generate a fixed static noise tile to save CPU, then draw it where needed
    const noiseHeight = 200;
    const noiseCanvas = adapter.createCanvas(config.width, noiseHeight);
    const noiseCtx = noiseCanvas.getContext('2d') as any;
    // Fast JS static noise
    const imgData = noiseCtx.createImageData(config.width, noiseHeight);
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

    process.stdout.write(`Rendering ${totalFrames} frames for VHS (${config.variant}): `);
    
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) {
        process.stdout.write('.');
      }

      const timeSec = frame / config.fps;

      if (config.bgTransparent) {
        ctx.clearRect(0, 0, config.width, config.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, config.width, config.height);
      }

      // Exact speed to loop
      const exactSpeedY = (Math.ceil(speedY * config.duration / config.height) * config.height) / config.duration;
      const offsetY = (timeSec * exactSpeedY) % config.height;

      if (config.variant === 'tracking_lines') {
        // Draw multiple horizontal lines with Chromatic Aberration (RGB split)
        const drawGlitchLine = (baseY: number, height: number) => {
          let y = (baseY + offsetY) % config.height;
          
          // Slight random horizontal jitter
          const jitter = (Math.random() - 0.5) * 10;
          
          ctx.globalCompositeOperation = 'screen';

          // Red channel displacement
          ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
          ctx.fillRect(jitter - 4, y - 2, config.width, height);

          // Blue channel displacement
          ctx.fillStyle = 'rgba(0, 0, 255, 0.6)';
          ctx.fillRect(jitter + 4, y + 2, config.width, height);

          // Green/White core
          ctx.fillStyle = 'rgba(100, 255, 100, 0.8)';
          ctx.fillRect(jitter, y, config.width, height);
          
          // Draw a second time wrapped for seamless loop if it crosses bottom
          if (y + height > config.height) {
            y -= config.height;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
            ctx.fillRect(jitter - 4, y - 2, config.width, height);
            ctx.fillStyle = 'rgba(0, 0, 255, 0.6)';
            ctx.fillRect(jitter + 4, y + 2, config.width, height);
            ctx.fillStyle = 'rgba(100, 255, 100, 0.8)';
            ctx.fillRect(jitter, y, config.width, height);
          }
        };

        drawGlitchLine(config.height * 0.1, 4);
        drawGlitchLine(config.height * 0.4, 2);
        drawGlitchLine(config.height * 0.7, 8);
        drawGlitchLine(config.height * 0.9, 3);
        
      } else if (config.variant === 'tracking_snow') {
        // A thick band of static noise rolling up or down
        // We'll roll it UP for a classic VHS tracking error feel
        const exactSpeedSnow = (Math.ceil(speedY * 1.5 * config.duration / config.height) * config.height) / config.duration;
        let y = config.height - ((timeSec * exactSpeedSnow) % config.height);

        const drawSnowBand = (yPos: number) => {
          // Draw the static noise texture
          const raw = (noiseCanvas as any).getRawCanvas ? (noiseCanvas as any).getRawCanvas() : noiseCanvas;
          (ctx as any).drawImage(raw, 0, yPos, config.width, noiseHeight);
          
          // Add RGB aberration lines at the edges of the snow band
          ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
          ctx.fillRect(0, yPos - 5, config.width, 5);
          ctx.fillStyle = 'rgba(0, 0, 255, 0.8)';
          ctx.fillRect(0, yPos + noiseHeight, config.width, 5);
        };

        drawSnowBand(y);
        // Wrap around
        if (y + noiseHeight > config.height) {
          drawSnowBand(y - config.height);
        }
        if (y < 0) {
          drawSnowBand(y + config.height);
        }
      } else {
        console.warn(`Variant '${config.variant}' not recognized for vhs, doing nothing`);
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
