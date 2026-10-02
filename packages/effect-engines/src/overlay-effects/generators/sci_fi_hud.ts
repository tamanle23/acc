import { BaseEffectEngine } from '@acc/core';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class SciFiHudEffect extends BaseEffectEngine {
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
    process.stdout.write(`Rendering ${totalFrames} frames for Sci-Fi HUD (${this.variantName}): `);
    // Pre-generate some random hex data for data_processing
    const hexLines: string[] = [];
    if (this.variantName === 'data_processing') {
      for (let i = 0; i < 40; i++) {
        let line = '';
        for (let j = 0; j < 8; j++) {
          line += Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase() + ' ';
        }
        hexLines.push(line);
      }
    }
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      const timeSec = frame / this.fps;
      // Normalised time [0, 1) for looping
      const tNorm = frame / totalFrames;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.strokeStyle = 'rgba(100, 255, 255, 0.8)';
      ctx.fillStyle = 'rgba(100, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      const cx = this.width / 2;
      const cy = this.height / 2;
      if (this.variantName === 'target_lock') {
        // Rotating concentric dashed circles
        ctx.save();
        ctx.translate(cx, cy);
        // Inner circle (rotates CW)
        ctx.save();
        ctx.rotate(tNorm * Math.PI * 2);
        ctx.setLineDash([20, 10]);
        ctx.beginPath();
        ctx.arc(0, 0, 150, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        // Middle circle (rotates CCW)
        ctx.save();
        ctx.rotate(-tNorm * Math.PI * 2 * 2);
        ctx.setLineDash([5, 15]);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 200, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        // Outer brackets (scale in and out using sine wave)
        ctx.save();
        const scale = 1.0 + Math.sin(tNorm * Math.PI * 2 * 4) * 0.1;
        ctx.scale(scale, scale);
        ctx.setLineDash([]);
        ctx.lineWidth = 3;
        const b = 250;
        const l = 40;
        // Top Left
        ctx.beginPath(); ctx.moveTo(-b, -b + l); ctx.lineTo(-b, -b); ctx.lineTo(-b + l, -b); ctx.stroke();
        // Top Right
        ctx.beginPath(); ctx.moveTo(b - l, -b); ctx.lineTo(b, -b); ctx.lineTo(b, -b + l); ctx.stroke();
        // Bottom Left
        ctx.beginPath(); ctx.moveTo(-b, b - l); ctx.lineTo(-b, b); ctx.lineTo(-b + l, b); ctx.stroke();
        // Bottom Right
        ctx.beginPath(); ctx.moveTo(b - l, b); ctx.lineTo(b, b); ctx.lineTo(b, b - l); ctx.stroke();
        ctx.restore();
        ctx.restore();
        // Target coords updating
        ctx.font = '20px Courier New';
        ctx.fillText(`TRG: [ ${Math.floor(Math.sin(tNorm * Math.PI * 2) * 100 + 400)}, ${Math.floor(Math.cos(tNorm * Math.PI * 2) * 100 + 400)} ]`, cx + 270, cy - 240);
        ctx.fillText(`LCK: ENABLED`, cx + 270, cy - 210);
      } else if (this.variantName === 'data_processing') {
        // Grid background
        ctx.strokeStyle = 'rgba(100, 255, 255, 0.1)';
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        for (let x = 0; x < this.width; x += 50) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
        }
        for (let y = 0; y < this.height; y += 50) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke();
        }
        // Scanning line sweeping down
        const scanY = (tNorm * this.height) % this.height;
        ctx.fillStyle = 'rgba(100, 255, 255, 0.4)';
        ctx.fillRect(0, scanY, this.width, 4);
        // Data streams on the left
        ctx.font = '16px Courier New';
        ctx.fillStyle = 'rgba(100, 255, 255, 0.7)';
        // Shift lines up based on time
        const lineHeight = 20;
        const linesToDraw = 30;
        const offset = Math.floor(tNorm * 40); // Move 40 lines per loop
        for (let i = 0; i < linesToDraw; i++) {
          const idx = (i + offset) % hexLines.length;
          ctx.fillText(hexLines[idx], 50, 100 + i * lineHeight);
        }
        // Progress bar
        ctx.strokeStyle = 'rgba(100, 255, 255, 0.8)';
        ctx.strokeRect(this.width - 400, 100, 300, 20);
        ctx.fillStyle = 'rgba(100, 255, 255, 0.6)';
        // Fills up and resets
        ctx.fillRect(this.width - 398, 102, 296 * tNorm, 16);
        ctx.fillText(`UPLINK: ${Math.floor(tNorm * 100)}%`, this.width - 400, 90);
      }
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
