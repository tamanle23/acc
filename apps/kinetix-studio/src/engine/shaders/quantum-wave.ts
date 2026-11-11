import type { ShaderStrategy } from '@/types/shader';

/**
 * Quantum Wave Shader: Simulates Schrödinger wave packet interference fringes,
 * quantum probability densities, and wave function nodal lines.
 */
export const renderQuantumWave: ShaderStrategy = ({
  sctx,
  w,
  h,
  theta,
  energy,
  pulse,
  palette,
}) => {
  const cx = w * 0.5;
  const cy = h * 0.44;
  const waveCount = 28;
  const maxRadius = Math.max(w, h) * 0.55;

  sctx.save();
  sctx.translate(cx, cy);

  // 1. Interference Fringe Ripples
  for (let i = 0; i < waveCount; i++) {
    const r = (i / waveCount) * maxRadius * pulse;
    const phase = theta * 1.5 - (i * 0.28);
    const alpha = (1 - i / waveCount) * 0.65 * energy;

    sctx.save();
    sctx.strokeStyle = i % 2 === 0 ? palette.accent : palette.accent2;
    sctx.lineWidth = 1.2 + Math.sin(phase) * 0.8;
    sctx.globalAlpha = Math.max(0.02, Math.min(1, alpha));

    // Nodal deformation along angular coordinates
    sctx.beginPath();
    const steps = 48;
    for (let s = 0; s <= steps; s++) {
      const angle = (s / steps) * Math.PI * 2;
      // Quantum angular wave function harmonic (m = 3)
      const harmonicMod = Math.sin(angle * 3 + theta) * Math.cos(angle * 2 - phase);
      const dr = r + harmonicMod * 16 * energy;
      const x = Math.cos(angle) * dr;
      const y = Math.sin(angle) * dr;
      if (s === 0) sctx.moveTo(x, y);
      else sctx.lineTo(x, y);
    }
    sctx.closePath();
    sctx.stroke();
    sctx.restore();
  }

  // 2. Quantum Particle Probability Field (Discrete Energy States)
  const particles = 32;
  for (let p = 0; p < particles; p++) {
    const pAngle = (p / particles) * Math.PI * 2 + theta * 0.8;
    const pOrbit = 45 + ((p * 17) % 180) * pulse;
    const px = Math.cos(pAngle) * pOrbit;
    const py = Math.sin(pAngle) * pOrbit * 0.6;

    sctx.fillStyle = p % 3 === 0 ? palette.accent : palette.ink;
    sctx.globalAlpha = 0.35 + 0.3 * Math.sin(theta * 3 + p);
    sctx.beginPath();
    sctx.arc(px, py, 1.8 + Math.sin(theta + p) * 1.2, 0, Math.PI * 2);
    sctx.fill();
  }

  sctx.restore();
};

