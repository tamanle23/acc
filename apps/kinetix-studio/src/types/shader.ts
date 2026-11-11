import type { SafeCanvas2D } from '@/lib/safe-canvas-2d';
import type { PaletteTokens } from './studio';
import type { AudioTelemetry } from './motion';

export type ShaderId =
  | 'orbital-knot'
  | 'silk-waves'
  | 'brutalist-grid'
  | 'cyber-matrix'
  | 'tesseract-4d'
  | 'synth-topo'
  | 'harmonograph'
  | 'golden-vortex'
  | 'liquid-plasma'
  | 'plexus-net'
  | 'sonar-radar'
  | 'op-art-moire'
  | 'quantum-wave'
  | 'voronoi-bio'
  | 'chladni-plate'
  | 'hyper-lattice'
  | 'raymarch-sdf'
  | 'crt-phosphor'
  | 'gravitational-lens'
  | 'reaction-diffusion'
  | 'ascii-matrix-terminal'
  | 'quantum-superposition'
  | 'neon-caustics'
  | 'cellular-automata'
  // Organic & Analog Tactile Shaders
  | 'riso-halftone-misreg'
  | 'film-haloid-grain'
  | 'sumi-ink-wash'
  | 'cyanotype-exposure';

export interface ShaderContext {
  sctx: SafeCanvas2D;
  w: number;
  h: number;
  theta: number;
  energy: number;
  pulse: number;
  palette: PaletteTokens;
  audioTelemetry?: AudioTelemetry;
}

export type ShaderStrategy = (sc: ShaderContext) => void;

export interface ShaderItem {
  id: ShaderId;
  name: string;
  role: string;
}
