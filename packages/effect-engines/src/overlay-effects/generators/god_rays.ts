import { BaseEffectEngine } from '@acc/core';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class GodRaysEffect extends BaseEffectEngine {
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
    const { stream, promise } = this.initStream(outputPath);
    // God rays are basically polygons radiating from a light source (often top center),
    // moving back and forth (swaying) and fading in and out (pulsing).
    interface Ray {
      angleOffset: number; // Offset from straight down
      widthAngle: number;  // How wide the ray is
      intensity: number;
      swayFreq: number;
      swayPhase: number;
      pulseFreq: number;
      pulsePhase: number;
    }
    const rays: Ray[] = [];
    const numRays = this.variantName === 'underwater_shafts' ? 15 : 8;
    for (let i = 0; i < numRays; i++) {
      const swayCycles = Math.floor(Math.random() * 2) + 1; // 1 to 2 cycles
      const pulseCycles = Math.floor(Math.random() * 3) + 1;
      rays.push({
        angleOffset: (Math.random() - 0.5) * Math.PI * 0.8, // -72 to +72 degrees
        widthAngle: Math.random() * 0.15 + 0.05,
        intensity: Math.random() * 0.4 + 0.2, // 0.2 to 0.6
        swayFreq: (swayCycles * Math.PI * 2) / this.duration,
        swayPhase: Math.random() * Math.PI * 2,
        pulseFreq: (pulseCycles * Math.PI * 2) / this.duration,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    process.stdout.write(`Rendering ${totalFrames} frames for God Rays (${this.variantName}): `);
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
      // Light source origin
      const originX = this.width / 2;
      const originY = -this.height * 0.1; // Slightly above the top edge
      const rayLength = this.height * 1.5;
      ctx.globalCompositeOperation = 'screen';
      for (const r of rays) {
        const sway = Math.sin(timeSec * r.swayFreq + r.swayPhase) * 0.2; // Sway angle
        const pulse = 1.0 + Math.sin(timeSec * r.pulseFreq + r.pulsePhase) * 0.5; // 0.5x to 1.5x
        const centerAngle = Math.PI / 2 + r.angleOffset + sway; // PI/2 is straight down
        const angle1 = centerAngle - r.widthAngle / 2;
        const angle2 = centerAngle + r.widthAngle / 2;
        const x1 = originX + Math.cos(angle1) * rayLength;
        const y1 = originY + Math.sin(angle1) * rayLength;
        const x2 = originX + Math.cos(angle2) * rayLength;
        const y2 = originY + Math.sin(angle2) * rayLength;
        // Radial gradient for the ray to fade out at the bottom
        // Unfortunately, canvas radial gradients from a point outward can be tricky for slices.
        // A simple linear gradient from origin to center of the bottom works perfectly.
        const endX = originX + Math.cos(centerAngle) * rayLength;
        const endY = originY + Math.sin(centerAngle) * rayLength;
        const grad = ctx.createLinearGradient(originX, originY, endX, endY);
        let colorStr = '255, 255, 230'; // Heavenly gold/white
        if (this.variantName === 'underwater_shafts') {
          colorStr = '180, 240, 255'; // Cyan/Blue
        }
        const opacity = Math.min(1, r.intensity * pulse);
        grad.addColorStop(0, `rgba(${colorStr}, ${opacity})`);
        grad.addColorStop(1, `rgba(${colorStr}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.fill();
      }
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
