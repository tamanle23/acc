import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateCameraUIEffect: EffectGenerator = {
  name: 'camera_ui',
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

    process.stdout.write(`Rendering ${totalFrames} frames for Camera UI (${config.variant}): `);
    
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) {
        process.stdout.write('.');
      }

      const timeSec = frame / config.fps;

      ctx.clearRect(0, 0, config.width, config.height);

      // Blinking logic (1Hz)
      const isBlinkVisible = Math.floor(timeSec * 2) % 2 === 0;

      if (config.variant === 'camcorder_rec') {
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
        const rightEdge = config.width - 150;
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
        ctx.beginPath(); ctx.moveTo(config.width - pad - cornerLen, pad); ctx.lineTo(config.width - pad, pad); ctx.lineTo(config.width - pad, pad + cornerLen); ctx.stroke();
        // Bottom Left
        ctx.beginPath(); ctx.moveTo(pad, config.height - pad - cornerLen); ctx.lineTo(pad, config.height - pad); ctx.lineTo(pad + cornerLen, config.height - pad); ctx.stroke();
        // Bottom Right
        ctx.beginPath(); ctx.moveTo(config.width - pad - cornerLen, config.height - pad); ctx.lineTo(config.width - pad, config.height - pad); ctx.lineTo(config.width - pad, config.height - pad - cornerLen); ctx.stroke();

        // Flashing Date/Time
        const hour = '09';
        const min = Math.floor(timeSec / 60).toString().padStart(2, '0');
        const sec = Math.floor(timeSec % 60).toString().padStart(2, '0');
        ctx.fillText(`PM ${hour}:${min}:${sec}`, config.width - 250, config.height - 70);
        ctx.fillText('JAN 01 1998', 80, config.height - 70);

      } else if (config.variant === 'cctv_security') {
        // CCTV Security Camera
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '35px Arial, sans-serif';
        
        // Blinking REC
        if (isBlinkVisible) {
          ctx.fillText('• REC', 50, 60);
        }

        ctx.fillText('CAM 04', config.width - 180, 60);
        
        // Running Timestamp
        const ms = Math.floor((timeSec % 1) * 1000).toString().padStart(3, '0');
        const timestamp = `2024-11-05 14:32:${Math.floor(timeSec).toString().padStart(2, '0')}:${ms}`;
        ctx.fillText(timestamp, 50, config.height - 50);

        // Random jittering tracking numbers at bottom right
        const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
        ctx.fillText(`SYS ERR ${randomNum}`, config.width - 300, config.height - 50);
        
        // A slight black gradient scanline at the top and bottom to simulate CRT
        const grad = ctx.createLinearGradient(0, 0, 0, config.height);
        grad.addColorStop(0, 'rgba(0,0,0,0.5)');
        grad.addColorStop(0.1, 'rgba(0,0,0,0)');
        grad.addColorStop(0.9, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, config.width, config.height);
      } else if (config.variant === 'dslr_viewfinder') {
        // DSLR UI
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;

        // Center crosshair
        const cx = config.width / 2;
        const cy = config.height / 2;
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
        ctx.fillRect(0, config.height - 60, config.width, 60);

        ctx.fillStyle = 'white';
        ctx.font = '24px Arial, sans-serif';
        ctx.fillText('ISO 800', 50, config.height - 22);
        ctx.fillText('F 2.8', 200, config.height - 22);
        ctx.fillText('1/60', 300, config.height - 22);
        
        ctx.fillStyle = isBlinkVisible ? 'red' : 'white';
        ctx.fillText('●', config.width - 250, config.height - 22);
        
        ctx.fillStyle = 'white';
        // Exposure meter
        ctx.fillText('-3..-2..-1..0..+1..+2..+3', config.width / 2 - 120, config.height - 22);
        // Indicator
        ctx.fillRect(config.width / 2 - 5, config.height - 35, 10, 20);
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
