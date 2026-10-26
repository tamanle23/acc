import { BaseEffectEngine } from '@acc/core';
import { CanvasAdapterFactory } from '../canvas-strategies/factory';

export class BokehEffect extends BaseEffectEngine {
  async renderAndPipe(outputPath: string): Promise<void> {
    const adapter = CanvasAdapterFactory.getAdapter('napi-rs');
    const canvas = adapter.createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    const totalFrames = Math.ceil(this.fps * this.duration);
    const { stream, promise } = this.initStream(outputPath);
    interface BokehParticle {
      x: number;
      y: number;
      r: number;
      color: string;
      speedX: number;
      speedY: number;
      pulseFreq: number;
      pulsePhase: number;
      wobbleFreq: number;
      wobblePhase: number;
    }
    const particles: BokehParticle[] = [];
    const numParticles = 40;
    // Warm cinematic colors (gold, orange, soft pink, white)
    const colors = ['255,200,100', '255,150,50', '255,220,180', '255,255,255', '200,150,255'];
    for (let i = 0; i < numParticles; i++) {
      const isLarge = Math.random() > 0.8;
      const r = isLarge ? Math.random() * 150 + 100 : Math.random() * 50 + 20;
      let speedX = 0, speedY = 0;
      if (this.variantName === 'drifting_bokeh') {
        speedX = (Math.random() - 0.5) * this.width * 0.1;
        speedY = (Math.random() - 0.5) * this.height * 0.1;
      }
      // Exact integer cycles for seamless looping
      const pulseCycles = Math.floor(Math.random() * 3) + 1; // 1 to 3 times per loop
      const wobbleCycles = Math.floor(Math.random() * 2) + 1;
      particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        r,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX,
        speedY,
        pulseFreq: (pulseCycles * Math.PI * 2) / this.duration,
        pulsePhase: Math.random() * Math.PI * 2,
        wobbleFreq: (wobbleCycles * Math.PI * 2) / this.duration,
        wobblePhase: Math.random() * Math.PI * 2,
      });
    }
    process.stdout.write(`Rendering ${totalFrames} frames for Bokeh (${this.variantName}): `);
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
      for (const p of particles) {
        let x = p.x;
        let y = p.y;
        let opacity = 0.5;
        if (this.variantName === 'drifting_bokeh') {
          // Seamless modulo wrapping
          x = ((p.x + p.speedX * timeSec) % this.width + this.width) % this.width;
          y = ((p.y + p.speedY * timeSec) % this.height + this.height) % this.height;
          // Soft pulse
          opacity = 0.4 + Math.sin(timeSec * p.pulseFreq + p.pulsePhase) * 0.2;
        } else if (this.variantName === 'pulsing_bokeh') {
          // Deep pulse, almost fading out
          opacity = 0.3 + Math.sin(timeSec * p.pulseFreq + p.pulsePhase) * 0.3;
          // Stay relatively in place but wobble
          x += Math.cos(timeSec * p.wobbleFreq + p.wobblePhase) * 30;
          y += Math.sin(timeSec * p.wobbleFreq + p.wobblePhase) * 30;
        }
        // Create soft radial gradient for true out-of-focus look
        const grad = ctx.createRadialGradient(x, y, p.r * 0.2, x, y, p.r);
        grad.addColorStop(0, `rgba(${p.color}, ${opacity})`);
        grad.addColorStop(0.7, `rgba(${p.color}, ${opacity * 0.5})`);
        grad.addColorStop(1, `rgba(${p.color}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
        // Draw a second time across the screen boundaries if it's drifting,
        // to prevent popping when modulo wrapping
        if (this.variantName === 'drifting_bokeh') {
          const drawWrap = (wx: number, wy: number) => {
            const wGrad = ctx.createRadialGradient(wx, wy, p.r * 0.2, wx, wy, p.r);
            wGrad.addColorStop(0, `rgba(${p.color}, ${opacity})`);
            wGrad.addColorStop(0.7, `rgba(${p.color}, ${opacity * 0.5})`);
            wGrad.addColorStop(1, `rgba(${p.color}, 0)`);
            ctx.fillStyle = wGrad;
            ctx.beginPath(); ctx.arc(wx, wy, p.r, 0, Math.PI * 2); ctx.fill();
          };
          if (x - p.r < 0) drawWrap(x + this.width, y);
          if (x + p.r > this.width) drawWrap(x - this.width, y);
          if (y - p.r < 0) drawWrap(x, y + this.height);
          if (y + p.r > this.height) drawWrap(x, y - this.height);
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
