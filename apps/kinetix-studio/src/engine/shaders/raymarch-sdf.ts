import type { ShaderStrategy } from '@/types/shader';

/**
 * Raymarch SDF Shader: 3D signed distance field spheres with specular rim highlights,
 * ambient occlusion gradients, and dynamic light vectors.
 */
export const renderRaymarchSdf: ShaderStrategy = ({
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
  const numSpheres = 9;

  sctx.save();
  sctx.translate(cx, cy);

  // Dynamic light source direction
  const lx = Math.cos(theta);
  const ly = Math.sin(theta);

  // Render clusters of 3D SDF-shaded spheres sorted by pseudo-depth
  for (let i = 0; i < numSpheres; i++) {
    const angle = (i / numSpheres) * Math.PI * 2 + theta * 0.4;
    const orbitR = (55 + ((i * 23) % 85)) * pulse;
    const sx = Math.cos(angle) * orbitR;
    const sy = Math.sin(angle) * orbitR * 0.65;
    const baseR = (22 + ((i * 17) % 32)) * pulse;

    // Pseudo-depth factor (-1 to +1)
    const depth = Math.sin(angle);
    const sphereR = baseR * (0.8 + 0.3 * depth);

    // 1. Soft Shadow Penumbra Underneath
    sctx.save();
    sctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    sctx.beginPath();
    sctx.ellipse(sx, sy + sphereR * 1.1, sphereR * 0.9, sphereR * 0.28, 0, 0, Math.PI * 2);
    sctx.fill();
    sctx.restore();

    // 2. Volumetric Raymarch-style Radial Gradient (Light & Rim)
    const highlightX = sx - lx * sphereR * 0.38;
    const highlightY = sy - ly * sphereR * 0.38;

    const grad = sctx.createRadialGradient(
      highlightX,
      highlightY,
      2,
      sx,
      sy,
      sphereR
    );
    const sphereColor = i % 2 === 0 ? palette.accent : palette.accent2;

    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, sphereColor);
    grad.addColorStop(0.75, palette.surface);
    grad.addColorStop(1, '#05070a');

    sctx.save();
    sctx.fillStyle = grad;
    sctx.globalAlpha = 0.88 * energy;
    sctx.beginPath();
    sctx.arc(sx, sy, sphereR, 0, Math.PI * 2);
    sctx.fill();

    // 3. Crisp Specular Rim Light
    sctx.strokeStyle = palette.ink;
    sctx.lineWidth = 1.2;
    sctx.globalAlpha = 0.45 + 0.4 * depth;
    sctx.stroke();
    sctx.restore();
  }

  sctx.restore();
};

