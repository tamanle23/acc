import { BaseEffectEngine } from '@acc/core';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class LensFlareEffect extends BaseEffectEngine {
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
    process.stdout.write(`Rendering ${totalFrames} frames for Lens Flare (${this.variantName}): `);
    // Anamorphic flares: Long horizontal streaks.
    // Sun burst: Radial rays.
    // We'll define a few key light sources
    const flares = [
      { x: this.width * 0.3, y: this.height * 0.4, color: '100, 200, 255', phaseX: 0, phaseY: 0, phasePulse: 0 },
      { x: this.width * 0.8, y: this.height * 0.6, color: '255, 150, 50', phaseX: Math.PI, phaseY: Math.PI / 2, phasePulse: Math.PI },
    ];
    const moveFreq = (1 * Math.PI * 2) / this.duration; // 1 cycle per loop
    const pulseFreq = (2 * Math.PI * 2) / this.duration; // 2 cycles per loop
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
      ctx.globalCompositeOperation = 'screen';
      for (const f of flares) {
        // Subtle movement
        const currentX = f.x + Math.sin(timeSec * moveFreq + f.phaseX) * 100;
        const currentY = f.y + Math.cos(timeSec * moveFreq + f.phaseY) * 50;
        const pulse = 1.0 + Math.sin(timeSec * pulseFreq + f.phasePulse) * 0.3; // 0.7 to 1.3
        if (this.variantName === 'anamorphic_streak') {
          // Central bright core
          const coreGrad = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, 50 * pulse);
          coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * pulse})`);
          coreGrad.addColorStop(0.2, `rgba(${f.color}, ${0.5 * pulse})`);
          coreGrad.addColorStop(1, `rgba(${f.color}, 0)`);
          ctx.fillStyle = coreGrad;
          ctx.beginPath();
          ctx.arc(currentX, currentY, 50 * pulse, 0, Math.PI * 2);
          ctx.fill();
          // Horizontal long streak
          const streakWidth = this.width * 1.5 * pulse;
          const streakHeight = 8 * pulse;
          const streakGrad = ctx.createLinearGradient(currentX - streakWidth / 2, currentY, currentX + streakWidth / 2, currentY);
          streakGrad.addColorStop(0, `rgba(${f.color}, 0)`);
          streakGrad.addColorStop(0.4, `rgba(${f.color}, ${0.6 * pulse})`);
          streakGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.9 * pulse})`);
          streakGrad.addColorStop(0.6, `rgba(${f.color}, ${0.6 * pulse})`);
          streakGrad.addColorStop(1, `rgba(${f.color}, 0)`);
          ctx.fillStyle = streakGrad;
          ctx.fillRect(currentX - streakWidth / 2, currentY - streakHeight / 2, streakWidth, streakHeight);
          // Secondary tiny horizontal streak
          ctx.fillStyle = `rgba(255,255,255, ${0.8 * pulse})`;
          ctx.fillRect(currentX - streakWidth / 4, currentY - 1, streakWidth / 2, 2);
        } else if (this.variantName === 'sun_burst') {
          // Large soft core
          const coreGrad = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, 200 * pulse);
          coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * pulse})`);
          coreGrad.addColorStop(0.1, `rgba(${f.color}, ${0.6 * pulse})`);
          coreGrad.addColorStop(1, `rgba(${f.color}, 0)`);
          ctx.fillStyle = coreGrad;
          ctx.beginPath();
          ctx.arc(currentX, currentY, 200 * pulse, 0, Math.PI * 2);
          ctx.fill();
          // Rotating rays
          ctx.save();
          ctx.translate(currentX, currentY);
          // Rotate 360 degrees exactly over the duration
          ctx.rotate((timeSec / this.duration) * Math.PI * 2);
          const numRays = 12;
          for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2;
            ctx.save();
            ctx.rotate(angle);
            // Draw a thin long triangle
            const rayGrad = ctx.createLinearGradient(0, 0, 400 * pulse, 0);
            rayGrad.addColorStop(0, `rgba(${f.color}, ${0.4 * pulse})`);
            rayGrad.addColorStop(1, `rgba(${f.color}, 0)`);
            ctx.fillStyle = rayGrad;
            ctx.beginPath();
            ctx.moveTo(0, -2);
            ctx.lineTo(400 * pulse, 0);
            ctx.lineTo(0, 2);
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        } else {
          console.warn(`Variant '${this.variantName}' not recognized for lens_flare`);
        }
      }
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
