import { BaseEffectEngine } from '@acc/core';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
import { VFXSimulatorFactory } from '../simulators/factory';

export class FilmDamageEffect extends BaseEffectEngine {
  async renderAndPipe(outputPath: string): Promise<void> {
    const adapter: CanvasAdapter = new NapiRsCanvasAdapter();
    const canvas = adapter.createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    const totalFrames = Math.ceil(this.fps * this.duration);
    const { stream, promise } = this.initStream(outputPath);

    const simulator = VFXSimulatorFactory.createSimulator('film_damage', this.variantName);
    simulator.init({
      width: this.width,
      height: this.height,
      fps: this.fps,
      duration: this.duration,
      variant: this.variantName,
      bgTransparent: this.pipelineConfig.background === 'transparent'
    });

    process.stdout.write(`Rendering ${totalFrames} frames for Film Damage (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) process.stdout.write('.');
      const timeSec = frame / this.fps;
      simulator.update(1 / this.fps, timeSec);
      simulator.draw(ctx, timeSec);

      stream.write(canvas.toBuffer('raw'));
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
