import { BaseEffectEngine } from '@acc/core';
import { CanvasAdapterFactory } from '../canvas-strategies/factory';
import { CanvasAdapter } from '../canvas-strategies/base';
export class CameraUIEffect extends BaseEffectEngine {
  async renderAndPipe(outputPath: string): Promise<void> {
    const adapter = CanvasAdapterFactory.getAdapter('napi-rs');
    const canvas = adapter.createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    const totalFrames = Math.ceil(this.fps * this.duration);
    const { stream, promise } = this.initStream(outputPath);
    process.stdout.write(`Rendering ${totalFrames} frames for Camera UI (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      const timeSec = frame / this.fps;
      ctx.clearRect(0, 0, this.width, this.height);
      // Blinking logic (1Hz)
      const isBlinkVisible = Math.floor(timeSec * 2) % 2 === 0;
      if (this.variantName === 'camcorder_rec') {
        // Classic 90s Camcorder UI
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        // REC text and blinking red dot
        if (isBlinkVisible) {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
          ctx.beginPath();
          ctx.arc(80, 80, 15, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 40px Courier New, monospace';
        ctx.fillText('REC', 110, 93);
        // Battery outline
        const rightEdge = this.width - 150;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeRect(rightEdge, 60, 80, 40);
        ctx.fillRect(rightEdge + 80, 70, 8, 20); // Battery tip
        // Battery bars (e.g. 2 bars)
        ctx.fillRect(rightEdge + 5, 65, 20, 30);
        ctx.fillRect(rightEdge + 30, 65, 20, 30);
        // Viewfinder corners
        ctx.lineWidth = 5;
        const cornerLen = 100;
        const pad = 50;
        // Top Left
        ctx.beginPath(); ctx.moveTo(pad, pad + cornerLen); ctx.lineTo(pad, pad); ctx.lineTo(pad + cornerLen, pad); ctx.stroke();
        // Top Right
        ctx.beginPath(); ctx.moveTo(this.width - pad - cornerLen, pad); ctx.lineTo(this.width - pad, pad); ctx.lineTo(this.width - pad, pad + cornerLen); ctx.stroke();
        // Bottom Left
        ctx.beginPath(); ctx.moveTo(pad, this.height - pad - cornerLen); ctx.lineTo(pad, this.height - pad); ctx.lineTo(pad + cornerLen, this.height - pad); ctx.stroke();
        // Bottom Right
        ctx.beginPath(); ctx.moveTo(this.width - pad - cornerLen, this.height - pad); ctx.lineTo(this.width - pad, this.height - pad); ctx.lineTo(this.width - pad, this.height - pad - cornerLen); ctx.stroke();
        // Flashing Date/Time
        const hour = '09';
        const min = Math.floor(timeSec / 60).toString().padStart(2, '0');
        const sec = Math.floor(timeSec % 60).toString().padStart(2, '0');
        ctx.fillText(`PM ${hour}:${min}:${sec}`, this.width - 250, this.height - 70);
        ctx.fillText('JAN 01 1998', 80, this.height - 70);
      } else if (this.variantName === 'cctv_security') {
        // CCTV Security Camera
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '35px Arial, sans-serif';
        // Blinking REC
        if (isBlinkVisible) {
          ctx.fillText('• REC', 50, 60);
        }
        ctx.fillText('CAM 04', this.width - 180, 60);
        // Running Timestamp
        const ms = Math.floor((timeSec % 1) * 1000).toString().padStart(3, '0');
        const timestamp = `2024-11-05 14:32:${Math.floor(timeSec).toString().padStart(2, '0')}:${ms}`;
        ctx.fillText(timestamp, 50, this.height - 50);
        // Random jittering tracking numbers at bottom right
        const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
        ctx.fillText(`SYS ERR ${randomNum}`, this.width - 300, this.height - 50);
        // A slight black gradient scanline at the top and bottom to simulate CRT
        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, 'rgba(0,0,0,0.5)');
        grad.addColorStop(0.1, 'rgba(0,0,0,0)');
        grad.addColorStop(0.9, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);
      } else if (this.variantName === 'dslr_viewfinder') {
        // DSLR UI
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        // Center crosshair
        const cx = this.width / 2;
        const cy = this.height / 2;
        ctx.beginPath();
        ctx.moveTo(cx - 30, cy); ctx.lineTo(cx + 30, cy);
        ctx.moveTo(cx, cy - 30); ctx.lineTo(cx, cy + 30);
        ctx.stroke();
        // Focus boxes
        ctx.strokeRect(cx - 150, cy - 100, 50, 50);
        ctx.strokeRect(cx + 100, cy - 100, 50, 50);
        ctx.strokeRect(cx - 150, cy + 50, 50, 50);
        ctx.strokeRect(cx + 100, cy + 50, 50, 50);
        if (isBlinkVisible) {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
          ctx.fillRect(cx - 135, cy - 85, 20, 20); // One focus box lights up
        }
        // Bottom stats bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, this.height - 60, this.width, 60);
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial, sans-serif';
        ctx.fillText('ISO 800', 50, this.height - 22);
        ctx.fillText('F 2.8', 200, this.height - 22);
        ctx.fillText('1/60', 300, this.height - 22);
        ctx.fillStyle = isBlinkVisible ? 'red' : 'white';
        ctx.fillText('●', this.width - 250, this.height - 22);
        ctx.fillStyle = 'white';
        // Exposure meter
        ctx.fillText('-3..-2..-1..0..+1..+2..+3', this.width / 2 - 120, this.height - 22);
        // Indicator
        ctx.fillRect(this.width / 2 - 5, this.height - 35, 10, 20);
      }
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
