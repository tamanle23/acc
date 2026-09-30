import { BaseEffectEngine } from '../../core/BaseEffectEngine';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class StarfieldEffect extends BaseEffectEngine {
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
    interface Star {
      x: number; y: number; z: number; // 3D coordinates
      r: number;
      pulseFreq: number; pulsePhase: number;
    }
    const stars: Star[] = [];
    const numStars = this.variantName === 'warp_speed' ? 1000 : 500;
    for (let i = 0; i < numStars; i++) {
      const pulseCycles = Math.floor(Math.random() * 3) + 1;
      stars.push({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        z: Math.random() * 1000 + 1, // Z from 1 to 1001
        r: Math.random() * 2 + 1,
        pulseFreq: (pulseCycles * Math.PI * 2) / this.duration,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    process.stdout.write(`Rendering ${totalFrames} frames for Starfield (${this.variantName}): `);
    const fov = 300;
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) process.stdout.write('.');
      const timeSec = frame / this.fps;
      if ((this.pipelineConfig.background === 'transparent')) {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.width, this.height);
      }
      ctx.fillStyle = 'white';
      for (const s of stars) {
        let currentZ = s.z;
        if (this.variantName === 'warp_speed') {
          // Move stars towards camera (z decreases)
          // To loop seamlessly, Z goes from 1000 down to 0, then wraps.
          // speed = 1000 units per duration
          const speedZ = 1000 / this.duration;
          currentZ = ((s.z - timeSec * speedZ) % 1000 + 1000) % 1000 + 1;
        }
        const scale = fov / currentZ;
        const screenX = this.width / 2 + s.x * scale;
        const screenY = this.height / 2 + s.y * scale;
        // Skip if outside screen
        if (screenX >= 0 && screenX <= this.width && screenY >= 0 && screenY <= this.height) {
          let opacity = 1.0;
          if (this.variantName === 'twinkling_night') {
            opacity = 0.5 + Math.sin(timeSec * s.pulseFreq + s.pulsePhase) * 0.5;
          } else {
            // Warp speed: fade in as they appear from afar (Z = 1000)
            opacity = Math.max(0, 1 - (currentZ / 1000));
          }
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          if (this.variantName === 'warp_speed') {
            // Draw lines for warp effect (motion blur)
            const prevZ = currentZ + (1000 / this.duration) * (1 / this.fps); // Where it was last frame
            const prevScale = fov / prevZ;
            const prevX = this.width / 2 + s.x * prevScale;
            const prevY = this.height / 2 + s.y * prevScale;
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = s.r * scale;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            ctx.lineTo(prevX, prevY);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(screenX, screenY, s.r * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      pipeline.pushFrame(canvas.toBuffer('raw'));
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
