import type { ShaderStrategy } from '@/types/shader';

/**
 * Quantum Superposition Shader Strategy
 * Simulates electron orbital probability density clouds (\u03c8\u00b2) with
 * nodal surfaces, wave-particle interference fringes, and probabilistic collapses.
 */
export const renderQuantumSuperposition: ShaderStrategy = ({
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
  const maxR = Math.min(w, h) * 0.42 * pulse;

  sctx.save();

  // 1. Interference Fringes (Double-Slit Phase Modulation)
  const numFringes = 14;
  for (let i = 0; i < numFringes; i++) {
    const r = (i / numFringes) * maxR;
    const phase = Math.sin(r * 0.08 - theta * 2.5 * energy);
    const alpha = Math.max(0, phase * 0.35);

    sctx.beginPath();
    sctx.strokeStyle = i % 2 === 0 ? palette.accent : palette.accent2;
    sctx.lineWidth = 1.2;
    sctx.globalAlpha = alpha;
    sctx.arc(cx, cy, Math.max(2, r), 0, Math.PI * 2);
    sctx.stroke();
  }

  // 2. Probabilistic Particle Cloud Samples (Monte Carlo \u03c8\u00b2 orbital)
  const numParticles = 64;
  for (let p = 0; p < numParticles; p++) {
    const u = (p / numParticles) * Math.PI * 2;
    // d-orbital harmonic shape: r = R * (3 * cos^2(\u03b8) - 1)
    const harmonic = Math.abs(3 * Math.pow(Math.cos(u * 2 + theta * 0.8), 2) - 1) * 0.45;
    const rad = maxR * (0.2 + harmonic * energy);

    const px = cx + Math.cos(u + theta * 0.3) * rad;
    const py = cy + Math.sin(u * 2 + theta * 0.5) * (rad * 0.65);

    sctx.beginPath();
    sctx.fillStyle = p % 3 === 0 ? palette.accent : palette.accent2;
    sctx.globalAlpha = 0.25 + 0.45 * Math.sin(theta * 3 + p);
    sctx.arc(px, py, (1.2 + (p % 3) * 0.8) * pulse, 0, Math.PI * 2);
    sctx.fill();
  }

  // 3. Central Quantum Singularity Wave Packet Core
  sctx.beginPath();
  sctx.strokeStyle = palette.ink;
  sctx.lineWidth = 1.5;
  sctx.globalAlpha = 0.6;
  sctx.arc(cx, cy, 14 * pulse, 0, Math.PI * 2);
  sctx.stroke();

  sctx.fillStyle = palette.accent;
  sctx.globalAlpha = 0.85;
  sctx.beginPath();
  sctx.arc(cx, cy, 5 * pulse, 0, Math.PI * 2);
  sctx.fill();

  sctx.restore();
};
