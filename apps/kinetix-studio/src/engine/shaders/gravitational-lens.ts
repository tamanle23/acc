import type { ShaderStrategy } from '@/types/shader';

/**
 * Gravitational Lensing Shader Strategy
 * Simulates Kerr black hole event horizon, relativistic accretion disk with Doppler beaming,
 * and circular Einstein ring photon geodesics.
 */
export const renderGravitationalLens: ShaderStrategy = ({
  sctx,
  w,
  h,
  theta,
  energy,
  pulse,
  palette,
}) => {
  const cx = w * 0.5;
  const cy = h * 0.42;
  const minDim = Math.min(w, h);
  const horizonR = minDim * 0.12 * pulse;
  const diskR = minDim * 0.36 * pulse;

  sctx.save();

  // 1. Einstein Ring Gravitational Lensing Geodesics
  for (let ring = 0; ring < 4; ring++) {
    const r = horizonR * 1.6 + ring * 14 * energy;
    sctx.beginPath();
    sctx.strokeStyle = ring % 2 === 0 ? palette.accent : palette.accent2;
    sctx.lineWidth = Math.max(0.8, 1.8 - ring * 0.3);
    sctx.globalAlpha = 0.45 / (ring + 1);
    sctx.arc(cx, cy, r, 0, Math.PI * 2);
    sctx.stroke();
  }

  // 2. Relativistic Tilted Accretion Disk (Keplerian Matter Stream)
  const diskTilt = -0.32;
  const numArms = 48;
  for (let i = 0; i < numArms; i++) {
    const frac = i / numArms;
    const rad = horizonR * 1.15 + frac * (diskR - horizonR);
    const angle = theta * 1.5 * (1 + (1 - frac) * 1.2 * energy) + frac * Math.PI * 4;

    // Doppler Beaming: Approaching side (cos > 0) is amplified and shifted towards accent color
    const doppler = 0.5 + 0.5 * Math.cos(angle);
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad * 0.38;

    // Apply disk tilt
    const tx = cx + (x - cx) * Math.cos(diskTilt) - (y - cy) * Math.sin(diskTilt);
    const ty = cy + (x - cx) * Math.sin(diskTilt) + (y - cy) * Math.cos(diskTilt);

    sctx.beginPath();
    sctx.fillStyle = doppler > 0.5 ? palette.accent : palette.accent2;
    sctx.globalAlpha = 0.2 + doppler * 0.65;
    const particleSize = (1.2 + doppler * 2.2) * (1 - frac * 0.5);
    sctx.arc(tx, ty, Math.max(0.5, particleSize), 0, Math.PI * 2);
    sctx.fill();
  }

  // 3. Black Hole Shadow / Event Horizon (Absolute Light Absorption)
  sctx.save();
  sctx.fillStyle = '#000000';
  sctx.beginPath();
  sctx.arc(cx, cy, horizonR, 0, Math.PI * 2);
  sctx.fill();

  // Glowing Photon Sphere Rim
  sctx.strokeStyle = palette.accent;
  sctx.lineWidth = 2.4;
  sctx.globalAlpha = 0.85;
  sctx.stroke();
  sctx.restore();

  // 4. Polar Relativistic Plasma Jet Core Plumes
  for (const dir of [-1, 1]) {
    sctx.beginPath();
    sctx.strokeStyle = palette.accent2;
    sctx.lineWidth = 1.5;
    sctx.globalAlpha = 0.35 * pulse;
    sctx.moveTo(cx, cy);
    const jetLen = minDim * 0.42 * energy;
    const jetWobble = Math.sin(theta * 3 + dir) * 12;
    sctx.lineTo(cx + jetWobble, cy + dir * jetLen);
    sctx.stroke();
  }

  sctx.restore();
};
