import type { SafeCanvas2D } from '@/lib/safe-canvas-2d';
import type { StudioState } from '@/types/studio';
import type { ChoreographyEnvelope, AudioTelemetry } from '@/types/motion';
import { SHADER_STRATEGIES } from '@/engine/shaders';
import { isHighKeyBackground } from '@/core/domain/color';

export interface RenderAmbientLayerOptions {
  sctx: SafeCanvas2D;
  width: number;
  height: number;
  state: StudioState;
  theta: number;
  progress: number;
  pulse: number;
  choreo: ChoreographyEnvelope;
  scaleFactor: number;
  audioTelemetry?: AudioTelemetry;
}

/**
 * Layer 1: Ambient Environment Plate (24 Custom Shaders + Post-FX)
 */
export function renderAmbientLayer({
  sctx,
  width: W,
  height: H,
  state,
  theta,
  progress,
  pulse,
  choreo,
  scaleFactor,
  audioTelemetry,
}: RenderAmbientLayerOptions): void {
  const { palette } = state;

  sctx.save();
  sctx.globalAlpha = state.shaderOpacity;

  // Double Exposure Silhouette Clipping Mask
  if (state.doubleExposure) {
    sctx.save();
    sctx.beginPath();
    sctx.arc(W * 0.5, H * 0.39, Math.min(W, H) * 0.34, 0, Math.PI * 2);
    sctx.ellipse(W * 0.5, H * 0.72, W * 0.38, H * 0.24, 0, Math.PI, Math.PI * 2);
    sctx.clip();
  }

  // High-frequency audio energy enhances shader turbulence & sparkle
  const highAudioBoost = state.audioReactive && audioTelemetry ? 1 + audioTelemetry.high * 0.35 : 1;
  const ambEnergy =
    (state.ambientBudget / 100) *
    state.shaderTurbulence *
    highAudioBoost *
    (1 - choreo.holdCalmness * 0.45);

  const shaderFn = SHADER_STRATEGIES[state.shaderId] || SHADER_STRATEGIES['orbital-knot'];
  shaderFn({
    sctx,
    w: W,
    h: H,
    theta,
    energy: ambEnergy,
    pulse,
    palette,
    audioTelemetry,
  });

  if (state.doubleExposure) {
    sctx.restore();
  }

  // Climax Shockwave Surge Ring
  if (choreo.climaxSurge > 0.05) {
    sctx.save();
    const surgeProgress =
      progress < 0.19 ? progress / 0.19 : Math.max(0, (progress - 0.55) / 0.25);
    const ringR = (0.14 + surgeProgress * 0.52) * Math.max(W, H);
    sctx.strokeStyle = palette.accent;
    sctx.lineWidth = 3.5 * choreo.climaxSurge;
    sctx.globalAlpha = choreo.climaxSurge * 0.58;
    sctx.beginPath();
    sctx.arc(W * 0.5, H * 0.38, ringR, 0, Math.PI * 2);
    sctx.stroke();
    sctx.restore();
  }

  // Organic Light Leaks & Dust Particles
  const isHighKey = isHighKeyBackground(palette.bg);
  if (state.lightLeaks) {
    sctx.save();
    sctx.globalCompositeOperation = isHighKey ? 'multiply' : 'screen';
    const lx = W * (0.5 + 0.38 * Math.sin(theta));
    const ly = H * (0.3 + 0.25 * Math.cos(theta));
    const leakGrad = sctx.createRadialGradient(lx, ly, 8, lx, ly, W * 0.65);
    leakGrad.addColorStop(0, palette.accent + (isHighKey ? '22' : '44'));
    leakGrad.addColorStop(0.5, palette.accent2 + (isHighKey ? '11' : '22'));
    leakGrad.addColorStop(1, 'transparent');
    sctx.fillStyle = leakGrad;
    sctx.fillRect(0, 0, W, H);

    // Dust motes
    for (let p = 0; p < 16; p++) {
      const px = ((p * 73 + Math.sin(theta + p) * 28) % W + W) % W;
      const py = ((p * 59 + (theta / (Math.PI * 2)) * H * 0.5) % H + H) % H;
      sctx.fillStyle = palette.ink;
      sctx.globalAlpha = 0.18 + 0.22 * Math.sin(theta * 2 + p);
      sctx.beginPath();
      sctx.arc(px, py, (1.2 + (p % 2)) * scaleFactor * 0.8, 0, Math.PI * 2);
      sctx.fill();
    }
    sctx.restore();
  }

  sctx.restore();

  // VHS Scanline Grid / Print Plate Texture
  if (state.vhsGrain) {
    sctx.save();
    sctx.fillStyle = isHighKey ? 'rgba(0, 0, 0, 0.035)' : 'rgba(255, 255, 255, 0.04)';
    const scanStep = Math.max(3, Math.round(3 * scaleFactor));
    for (let y = 0; y < H; y += scanStep) {
      sctx.fillRect(0, y, W, 1);
    }
    sctx.restore();
  }
}
