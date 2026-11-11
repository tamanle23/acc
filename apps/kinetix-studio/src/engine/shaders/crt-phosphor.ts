import type { ShaderStrategy } from '@/types/shader';

/**
 * CRT Phosphor Shader: Retro shadow-mask CRT phosphor raster, RGB sub-pixel
 * scanlines, barrel distortion vignette, and glowing electron gun decay.
 */
export const renderCrtPhosphor: ShaderStrategy = ({
  sctx,
  w,
  h,
  theta,
  energy,
  palette,
}) => {
  sctx.save();

  // 1. Horizontal Raster Scanlines
  const lineSpacing = 4;
  sctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  for (let y = 0; y < h; y += lineSpacing) {
    sctx.fillRect(0, y, w, 1.5);
  }

  // 2. Phosphor RGB Sub-Pixel Grid (Simulated Triads)
  const phosphorStep = 8;
  const numPhosphors = Math.floor(w / phosphorStep);
  for (let i = 0; i < numPhosphors; i++) {
    const px = i * phosphorStep;
    const wave = Math.sin(theta * 3 + i * 0.18);
    const phosphorColor =
      i % 3 === 0
        ? palette.accent
        : i % 3 === 1
        ? palette.accent2
        : '#ec4899';

    sctx.fillStyle = phosphorColor;
    sctx.globalAlpha = Math.max(0.04, (0.15 + 0.12 * wave) * energy);
    sctx.fillRect(px, 0, 2, h);
  }

  // 3. Electron Beam Travelling Scan Bar (Refresh Glitch)
  const scanY = ((theta * 140) % (h + 120)) - 60;
  const beamGrad = sctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
  beamGrad.addColorStop(0, 'transparent');
  beamGrad.addColorStop(0.5, palette.accent + '33');
  beamGrad.addColorStop(1, 'transparent');

  sctx.fillStyle = beamGrad;
  sctx.globalAlpha = 0.7 * energy;
  sctx.fillRect(0, scanY - 30, w, 60);

  // 4. CRT Glass Curvature Vignette (Shadowed Corners)
  const cx = w * 0.5;
  const cy = h * 0.5;
  const radius = Math.min(w, h) * 0.68;
  const vignette = sctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 1.15);
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(0.85, 'rgba(0, 0, 0, 0.4)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.88)');

  sctx.fillStyle = vignette;
  sctx.globalAlpha = 0.95;
  sctx.fillRect(0, 0, w, h);

  sctx.restore();
};

