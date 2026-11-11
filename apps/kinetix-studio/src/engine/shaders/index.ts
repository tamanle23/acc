import type { ShaderId, ShaderStrategy, ShaderContext } from '@/types/shader';
import type { StudioState } from '@/types/studio';
import type { ChoreographyEnvelope } from '@/types/motion';
import { SafeCanvas2D } from '@/lib/safe-canvas-2d';

import { renderOrbitalKnot } from './orbital-knot';
import { renderSilkWaves } from './silk-waves';
import { renderBrutalistGrid } from './brutalist-grid';
import { renderCyberMatrix } from './cyber-matrix';
import { renderTesseract4D } from './tesseract-4d';
import { renderSynthTopo } from './synth-topo';
import { renderHarmonograph } from './harmonograph';
import { renderGoldenVortex } from './golden-vortex';
import { renderLiquidPlasma } from './liquid-plasma';
import { renderPlexusNet } from './plexus-net';
import { renderSonarRadar } from './sonar-radar';
import { renderOpArtMoire } from './op-art-moire';
import { renderQuantumWave } from './quantum-wave';
import { renderVoronoiBio } from './voronoi-bio';
import { renderChladniPlate } from './chladni-plate';
import { renderHyperLattice } from './hyper-lattice';
import { renderRaymarchSdf } from './raymarch-sdf';
import { renderCrtPhosphor } from './crt-phosphor';
import { renderGravitationalLens } from './gravitational-lens';
import { renderReactionDiffusion } from './reaction-diffusion';
import { renderAsciiMatrixTerminal } from './ascii-matrix-terminal';
import { renderQuantumSuperposition } from './quantum-superposition';
import { renderNeonCaustics } from './neon-caustics';
import { renderCellularAutomata } from './cellular-automata';

export const SHADER_STRATEGIES: Record<ShaderId, ShaderStrategy> = {
  'orbital-knot': renderOrbitalKnot,
  'silk-waves': renderSilkWaves,
  'brutalist-grid': renderBrutalistGrid,
  'cyber-matrix': renderCyberMatrix,
  'tesseract-4d': renderTesseract4D,
  'synth-topo': renderSynthTopo,
  'harmonograph': renderHarmonograph,
  'golden-vortex': renderGoldenVortex,
  'liquid-plasma': renderLiquidPlasma,
  'plexus-net': renderPlexusNet,
  'sonar-radar': renderSonarRadar,
  'op-art-moire': renderOpArtMoire,
  'quantum-wave': renderQuantumWave,
  'voronoi-bio': renderVoronoiBio,
  'chladni-plate': renderChladniPlate,
  'hyper-lattice': renderHyperLattice,
  'raymarch-sdf': renderRaymarchSdf,
  'crt-phosphor': renderCrtPhosphor,
  'gravitational-lens': renderGravitationalLens,
  'reaction-diffusion': renderReactionDiffusion,
  'ascii-matrix-terminal': renderAsciiMatrixTerminal,
  'quantum-superposition': renderQuantumSuperposition,
  'neon-caustics': renderNeonCaustics,
  'cellular-automata': renderCellularAutomata,
  'riso-halftone-misreg': renderRisoHalftoneMisreg,
  'film-haloid-grain': renderFilmHaloidGrain,
  'sumi-ink-wash': renderSumiInkWash,
  'cyanotype-exposure': renderCyanotypeExposure,
};

function renderRisoHalftoneMisreg({ sctx, w, h, theta, energy, palette }: ShaderContext): void {
  sctx.save();
  const step = 28;
  const shiftX = Math.sin(theta) * 3 * energy;
  const shiftY = Math.cos(theta) * 2 * energy;

  // Pass 1: Key Black Screen at 15 degrees
  sctx.save();
  sctx.rotate((15 * Math.PI) / 180);
  sctx.fillStyle = palette.ink;
  sctx.globalAlpha = 0.22;
  const extent = Math.max(w, h) * 1.5;
  for (let x = -extent; x < extent; x += step) {
    for (let y = -extent; y < extent; y += step) {
      const r = 2.5 + Math.abs(Math.sin((x + y) * 0.01 + theta)) * 4 * energy;
      sctx.beginPath();
      sctx.arc(x, y, r, 0, Math.PI * 2);
      sctx.fill();
    }
  }
  sctx.restore();

  // Pass 2: Accent Spot Screen at 75 degrees with misregistration offset
  sctx.save();
  sctx.translate(shiftX, shiftY);
  sctx.rotate((75 * Math.PI) / 180);
  sctx.fillStyle = palette.accent;
  sctx.globalAlpha = 0.28;
  for (let x = -extent; x < extent; x += step) {
    for (let y = -extent; y < extent; y += step) {
      const r = 2.0 + Math.abs(Math.cos((x - y) * 0.01 + theta)) * 4.5 * energy;
      sctx.beginPath();
      sctx.arc(x, y, r, 0, Math.PI * 2);
      sctx.fill();
    }
  }
  sctx.restore();
  sctx.restore();
}

function renderFilmHaloidGrain({ sctx, w, h, theta, energy, palette }: ShaderContext): void {
  sctx.save();
  const weaveX = Math.sin(theta * 37) * 0.4 * energy;
  const weaveY = Math.cos(theta * 41) * 0.4 * energy;
  sctx.translate(weaveX, weaveY);

  sctx.fillStyle = palette.ink;
  sctx.globalAlpha = 0.08 * energy;

  const count = 300;
  for (let i = 0; i < count; i++) {
    const rx = ((Math.sin(i * 997 + theta * 12) + 1) * 0.5) * w;
    const ry = ((Math.cos(i * 643 + theta * 15) + 1) * 0.5) * h;
    const sz = 1.2 + Math.abs(Math.sin(i * 13)) * 2;
    sctx.fillRect(rx, ry, sz, sz);
  }
  sctx.restore();
}

function renderSumiInkWash({ sctx, w, h, theta, energy, palette }: ShaderContext): void {
  sctx.save();
  const ribbons = 7;
  for (let r = 0; r < ribbons; r++) {
    const yBase = (h / (ribbons + 1)) * (r + 1);
    sctx.fillStyle = r % 2 === 0 ? palette.ink : palette.accent;
    sctx.globalAlpha = 0.07 + (r / ribbons) * 0.08 * energy;
    sctx.beginPath();
    sctx.moveTo(0, yBase);
    for (let x = 0; x <= w; x += 30) {
      const freq = 0.003 + r * 0.001;
      const yWave =
        yBase +
        Math.sin(x * freq + theta + r) * 36 * energy +
        Math.cos(x * 0.006 - theta) * 18;
      sctx.lineTo(x, yWave);
    }
    sctx.lineTo(w, h);
    sctx.lineTo(0, h);
    sctx.closePath();
    sctx.fill();
  }
  sctx.restore();
}

function renderCyanotypeExposure({ sctx, w, h, theta, energy, palette }: ShaderContext): void {
  sctx.save();
  const grad = sctx.createRadialGradient(
    w * 0.5,
    h * 0.45,
    40,
    w * 0.5,
    h * 0.45,
    Math.max(w, h) * 0.65
  );
  grad.addColorStop(0, 'rgba(0, 49, 83, 0.45)');
  grad.addColorStop(0.7, 'rgba(0, 30, 60, 0.25)');
  grad.addColorStop(1, 'rgba(0, 15, 35, 0.05)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, w, h);

  sctx.strokeStyle = palette.accent;
  sctx.lineWidth = 3;
  sctx.globalAlpha = 0.18 + Math.sin(theta) * 0.08 * energy;
  sctx.strokeRect(20, 20, w - 40, h - 40);
  sctx.restore();
}

export interface RenderAmbientOptions {
  canvas: HTMLCanvasElement;
  state: StudioState;
  rawProgress: number;
  choreo: ChoreographyEnvelope;
}

/**
 * Executes complete Layer 1 Ambient Plate render pipeline
 */
export function renderAmbientPlate({
  canvas,
  state,
  rawProgress,
  choreo,
}: RenderAmbientOptions): void {
  const rawCtx = canvas.getContext('2d');
  if (!rawCtx) return;

  const sAmb = new SafeCanvas2D(rawCtx);
  const w = canvas.width;
  const h = canvas.height;
  const theta = rawProgress * Math.PI * 2;
  const ambEnergy =
    (state.ambientBudget / 100) *
    state.shaderTurbulence *
    (1 - choreo.holdCalmness * 0.45);

  // Optical Safety Guard: Clamp audio/BPM modulation frequency to <= 3Hz (Three Flashes Rule)
  const safePulseFreq = Math.min(3, Math.max(1, Math.round(state.bpm / 60)));
  const pulse = state.audioReactive
    ? 1 + 0.16 * Math.sin(theta * safePulseFreq)
    : 1 + 0.04 * Math.sin(theta * 2);

  // 1. Clear & Fill Base Background
  sAmb.save();
  sAmb.fillStyle = state.palette.bg;
  sAmb.fillRect(0, 0, w, h);
  sAmb.globalAlpha = state.shaderOpacity;

  // Double Exposure Silhouette Clipping Mask
  if (state.doubleExposure) {
    sAmb.save();
    sAmb.beginPath();
    sAmb.arc(w * 0.5, h * 0.39, Math.min(w, h) * 0.34, 0, Math.PI * 2);
    sAmb.ellipse(w * 0.5, h * 0.72, w * 0.38, h * 0.24, 0, Math.PI, Math.PI * 2);
    sAmb.clip();
  }

  // 2. Execute Active Ambient Shader Strategy
  const shaderFn = SHADER_STRATEGIES[state.shaderId] || SHADER_STRATEGIES['orbital-knot'];
  const shaderContext: ShaderContext = {
    sctx: sAmb,
    w,
    h,
    theta,
    energy: ambEnergy,
    pulse,
    palette: state.palette,
  };
  shaderFn(shaderContext);

  if (state.doubleExposure) {
    sAmb.restore();
  }

  // 3. Climax / Hook Shockwave Ring (Guaranteed Non-Negative via SafeCanvas2D)
  if (choreo.climaxSurge > 0.05) {
    sAmb.save();
    const surgeProgress =
      rawProgress < 0.19
        ? rawProgress / 0.19
        : Math.max(0, (rawProgress - 0.55) / 0.25);
    const ringR = (0.14 + surgeProgress * 0.52) * Math.max(w, h);
    sAmb.strokeStyle = state.palette.accent;
    sAmb.lineWidth = 3.5 * choreo.climaxSurge;
    sAmb.globalAlpha = choreo.climaxSurge * 0.58;
    sAmb.beginPath();
    sAmb.arc(w * 0.5, h * 0.38, ringR, 0, Math.PI * 2);
    sAmb.stroke();
    sAmb.restore();
  }

  // 4. Organic Light Leaks & Floating Dust Motes (Studio Sustain Polish)
  if (state.lightLeaks) {
    sAmb.save();
    sAmb.globalCompositeOperation = 'screen';
    const lx = w * (0.5 + 0.38 * Math.sin(theta));
    const ly = h * (0.3 + 0.25 * Math.cos(theta));
    const leakGrad = sAmb.createRadialGradient(lx, ly, 8, lx, ly, w * 0.65);
    leakGrad.addColorStop(0, state.palette.accent + '44');
    leakGrad.addColorStop(0.5, state.palette.accent2 + '22');
    leakGrad.addColorStop(1, 'transparent');
    sAmb.fillStyle = leakGrad;
    sAmb.fillRect(0, 0, w, h);

    // 16 Ambient Dust Particles
    for (let p = 0; p < 16; p++) {
      const px = ((p * 73 + Math.sin(theta + p) * 28) % w + w) % w;
      const py = ((p * 59 + (theta / (Math.PI * 2)) * h * 0.5) % h + h) % h;
      sAmb.fillStyle = state.palette.ink;
      sAmb.globalAlpha = 0.18 + 0.22 * Math.sin(theta * 2 + p);
      sAmb.beginPath();
      sAmb.arc(px, py, 1.2 + (p % 2), 0, Math.PI * 2);
      sAmb.fill();
    }
    sAmb.restore();
  }

  sAmb.restore();
}

