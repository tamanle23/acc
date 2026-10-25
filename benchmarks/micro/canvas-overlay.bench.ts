import { run, bench, group } from 'mitata';
import { createCanvas } from '@napi-rs/canvas';

group('Canvas & Overlay Frame Rendering', () => {
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  bench('1280x720 Procedural Vignette & Gradient Fill', () => {
    ctx.clearRect(0, 0, width, height);

    // Radial gradient vignette
    const grad = ctx.createRadialGradient(
      width / 2, height / 2, width * 0.2,
      width / 2, height / 2, width * 0.7
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  });

  bench('1280x720 Particle Swarm Render Loop (200 Particles)', () => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';

    for (let i = 0; i < 200; i++) {
      const x = (i * 37) % width;
      const y = (i * 53) % height;
      const radius = 2 + (i % 5);

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  bench('Canvas Frame Buffer Readout (toBuffer image/png)', () => {
    const rawBuffer = canvas.toBuffer('image/png');
  });
});

if (import.meta.main) {
  run();
}
