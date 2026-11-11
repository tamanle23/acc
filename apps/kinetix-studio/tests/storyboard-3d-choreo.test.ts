// ============================================================================
// KINETIX STUDIO v6.0 - STORYBOARD 3D CHOREOGRAPHY & ACT STATE MANAGEMENT TESTS
// Exhaustive test suite validating CameraDirector3D, 3D transition strategies,
// multi-mesh registry, hero elevation, and two-way storyboard state management.
// ============================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  CameraDirector3D,
  resolve3DCameraShot,
  resolveLightDirection,
} from '@/engine/choreography/camera-director-3d';
import {
  TransitionRegistry,
  SpinOrbitDissolveTransition,
  DollyPunchThroughTransition,
} from '@/engine/transitions/transition-strategy';
import { gltfMeshEngine, GltfMeshEngine } from '@/engine/webgpu/gltf-mesh-engine';
import { StoryboardSequence } from '@/core/domain/storyboard/storyboard-sequence.entity';
import { StoryboardCompositor } from '@/engine/composition/storyboard-compositor';
import { CINEMATIC_3D_HERO_SHOWCASE_PRESET } from '@/constants/storyboard-presets';
import { INITIAL_STUDIO_STATE } from '@/constants/initial-state';
import type { Scene3DChoreography } from '@/types/storyboard';

// Mock Canvas 2D context for headless testing
class MockCanvasRenderingContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
  lineWidth = 1;
  font = '10px sans-serif';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  shadowColor = 'transparent';
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  filter = 'none';

  save() {}
  restore() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  arcTo() {}
  arc() {}
  ellipse() {}
  rect() {}
  roundRect() {}
  fill() {}
  stroke() {}
  fillRect() {}
  strokeRect() {}
  clearRect() {}
  fillText() {}
  strokeText() {}
  measureText(text: string) {
    return {
      width: text.length * 10,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 10,
      fontBoundingBoxAscent: 10,
      fontBoundingBoxDescent: 2,
      alphabeticBaseline: 0,
      emHeightAscent: 10,
      emHeightDescent: 2,
      hangingBaseline: 8,
      ideographicBaseline: -2,
    } as unknown as TextMetrics;
  }
  drawImage() {}
  createLinearGradient() {
    return { addColorStop: () => {} } as any;
  }
  createRadialGradient() {
    return { addColorStop: () => {} } as any;
  }
  translate() {}
  rotate() {}
  scale() {}
  transform() {}
  setTransform() {}
  resetTransform() {}
  clip() {}
  setLineDash() {}
  getLineDash() {
    return [];
  }
}

function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const ctx = new MockCanvasRenderingContext2D();
  return {
    width,
    height,
    getContext: () => ctx as unknown as CanvasRenderingContext2D,
    toBlob: (cb: (b: Blob) => void) => {
      cb(new Blob(['mock-data'], { type: 'image/png' }));
    },
  } as unknown as HTMLCanvasElement;
}

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return createMockCanvas(800, 600);
      }
      return {} as any;
    },
  };
}

describe('Storyboard 3D Choreography & Camera Director Suite', () => {
  describe('CameraDirector3D Mathematical Calculations', () => {
    it('returns default turntable fallback when choreo is undefined or disabled', () => {
      const resUndef = resolve3DCameraShot(undefined, 0.5, Math.PI);
      expect(resUndef.meshKey).toBe('custom-glb');
      expect(resUndef.wireframe).toBe(true);
      expect(resUndef.fill).toBe(true);
      expect(resUndef.rotationX).toBeCloseTo(0.25, 2);

      const resDisabled = resolve3DCameraShot({ enabled: false }, 0.5, Math.PI);
      expect(resDisabled.meshKey).toBe('custom-glb');
      expect(resDisabled.rotationX).toBeCloseTo(0.25, 2);
    });

    it('computes Heroic Low-Angle upward elevation and scale boost', () => {
      const choreo: Scene3DChoreography = {
        enabled: true,
        shotType: 'heroic-low-angle',
        cameraElevationDeg: 0,
        cameraZoom: 1.0,
      };
      const res = resolve3DCameraShot(choreo, 0.0, 0);
      // Upward pitch approx 35 deg = 0.61 rad
      expect(res.rotationX).toBeCloseTo(35 * (Math.PI / 180), 1);
      // Heroic scale boost is 1.35x base
      expect(res.scale).toBeGreaterThan(1.15);
    });

    it('computes Bird Eye Overhead high-angle downward plunge', () => {
      const choreo: Scene3DChoreography = {
        enabled: true,
        shotType: 'bird-eye-high',
        cameraElevationDeg: 0,
        cameraZoom: 1.0,
      };
      const res = resolve3DCameraShot(choreo, 0.0, 0);
      // Downward plunge angle
      expect(res.rotationX).toBeLessThan(-0.5);
      expect(res.rotationX).toBeCloseTo(-50 * (Math.PI / 180) + 0.05, 2);
      expect(res.rotationZ).toBeCloseTo(10 * (Math.PI / 180), 1);
    });

    it('computes Dutch Tilt Dynamic cant angle', () => {
      const choreo: Scene3DChoreography = {
        enabled: true,
        shotType: 'dutch-tilt-dynamic',
        cameraRollDeg: 0,
      };
      const res = resolve3DCameraShot(choreo, 0.0, 0);
      // Roll cant approx 22 deg = 0.38 rad
      expect(res.rotationZ).toBeCloseTo(22 * (Math.PI / 180), 1);
    });

    it('computes Macro Close-Up high zoom framing', () => {
      const choreo: Scene3DChoreography = {
        enabled: true,
        shotType: 'macro-close-up',
        cameraZoom: 1.0,
      };
      const res = resolve3DCameraShot(choreo, 0.0, 0, 1.0, 1.0);
      // Macro scale is 2.2x base
      expect(res.scale).toBeCloseTo(2.2, 1);
    });

    it('interpolates Cinematic Dolly-Zoom Vertigo effect across scene progress t in [0, 1]', () => {
      const choreo: Scene3DChoreography = {
        enabled: true,
        shotType: 'cinematic-dolly-zoom',
        cameraZoom: 1.0,
      };

      const resStart = resolve3DCameraShot(choreo, 0.0, 0, 1.0, 1.0);
      const resMid = resolve3DCameraShot(choreo, 0.5, 0, 1.0, 1.0);
      const resEnd = resolve3DCameraShot(choreo, 1.0, 0, 1.0, 1.0);

      // Scale evolves smoothly from 0.85 to 1.85
      expect(resStart.scale).toBeCloseTo(0.85, 2);
      expect(resMid.scale).toBeCloseTo(1.35, 2);
      expect(resEnd.scale).toBeCloseTo(1.85, 2);
      expect(resEnd.scale).toBeGreaterThan(resStart.scale);
    });

    it('normalizes directional light unit vector to length 1.0', () => {
      const [lx, ly, lz] = resolveLightDirection(45, 45);
      const len = Math.hypot(lx, ly, lz);
      expect(len).toBeCloseTo(1.0, 4);

      const [lx2, ly2, lz2] = resolveLightDirection(180, 60);
      const len2 = Math.hypot(lx2, ly2, lz2);
      expect(len2).toBeCloseTo(1.0, 4);
    });
  });

  describe('3D Transition Strategies', () => {
    it('executes SpinOrbitDissolveTransition cleanly across progress domain', () => {
      const strategy = new SpinOrbitDissolveTransition();
      expect(strategy.type).toBe('spin-orbit-dissolve');

      const fromCanvas = createMockCanvas(400, 400);
      const toCanvas = createMockCanvas(400, 400);
      const targetCtx = new MockCanvasRenderingContext2D() as unknown as CanvasRenderingContext2D;

      expect(() => {
        strategy.render({
          fromCanvas,
          toCanvas,
          targetCtx,
          progress: 0.0,
          width: 400,
          height: 400,
          direction: 'right',
        });
        strategy.render({
          fromCanvas,
          toCanvas,
          targetCtx,
          progress: 0.5,
          width: 400,
          height: 400,
          direction: 'left',
        });
        strategy.render({
          fromCanvas,
          toCanvas,
          targetCtx,
          progress: 1.0,
          width: 400,
          height: 400,
        });
      }).not.toThrow();
    });

    it('executes DollyPunchThroughTransition cleanly across progress domain', () => {
      const strategy = new DollyPunchThroughTransition();
      expect(strategy.type).toBe('dolly-punch-through');

      const fromCanvas = createMockCanvas(400, 400);
      const toCanvas = createMockCanvas(400, 400);
      const targetCtx = new MockCanvasRenderingContext2D() as unknown as CanvasRenderingContext2D;

      expect(() => {
        strategy.render({
          fromCanvas,
          toCanvas,
          targetCtx,
          progress: 0.0,
          width: 400,
          height: 400,
        });
        strategy.render({
          fromCanvas,
          toCanvas,
          targetCtx,
          progress: 0.5,
          width: 400,
          height: 400,
        });
        strategy.render({
          fromCanvas,
          toCanvas,
          targetCtx,
          progress: 1.0,
          width: 400,
          height: 400,
        });
      }).not.toThrow();
    });

    it('registers both 3D transitions in TransitionRegistry', () => {
      expect(TransitionRegistry.get('spin-orbit-dissolve')).toBeInstanceOf(SpinOrbitDissolveTransition);
      expect(TransitionRegistry.get('dolly-punch-through')).toBeInstanceOf(DollyPunchThroughTransition);
      expect(TransitionRegistry.getAvailableTypes()).toContain('spin-orbit-dissolve');
      expect(TransitionRegistry.getAvailableTypes()).toContain('dolly-punch-through');
    });
  });

  describe('GltfMeshEngine Multi-Mesh Registry', () => {
    let engine: GltfMeshEngine;

    beforeEach(() => {
      engine = new GltfMeshEngine();
    });

    it('retrieves built-in parametric 3D meshes by key', () => {
      const torus = engine.getMesh('3d-torus-knot');
      expect(torus).toBeDefined();
      expect(torus!.vertices.length).toBeGreaterThan(0);
      expect(torus!.indices.length).toBeGreaterThan(0);

      const icosa = engine.getMesh('3d-icosahedron');
      expect(icosa).toBeDefined();
      expect(icosa!.vertices.length / 3).toBe(12);
      expect(icosa!.indices.length / 3).toBe(20);

      const monolith = engine.getMesh('3d-monolith3d');
      expect(monolith).toBeDefined();
      expect(monolith!.vertices.length / 3).toBe(8);
      expect(monolith!.indices.length / 3).toBe(12);
    });

    it('registers and retrieves custom named meshes', () => {
      const dummyMesh = {
        vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint16Array([0, 1, 2]),
      };

      engine.registerMesh('custom-character', dummyMesh);
      const retrieved = engine.getMesh('custom-character');
      expect(retrieved).toBeDefined();
      expect(retrieved!.vertices.length).toBe(9);
      expect(engine.listRegisteredMeshes()).toContain('custom-character');
    });

    it('falls back to custom-glb or icosahedron when mesh key is not found', () => {
      const fallback = engine.getMesh('non-existent-mesh-key');
      expect(fallback).toBeDefined();
      expect(fallback!.vertices.length).toBeGreaterThan(0);
    });
  });

  describe('Storyboard Compositor 3D Hero Elevation & Sequence Resolution', () => {
    it('loads and validates the 3D Cinematic Hero Showcase preset', () => {
      const seq = StoryboardSequence.fromSpec(CINEMATIC_3D_HERO_SHOWCASE_PRESET);
      expect(seq.sceneCount).toBe(3);
      expect(seq.totalDurationSec).toBe(13.0);
      expect(seq.scenes[0].choreo3d?.shotType).toBe('heroic-low-angle');
      expect(seq.scenes[1].choreo3d?.shotType).toBe('dutch-tilt-dynamic');
      expect(seq.scenes[2].choreo3d?.shotType).toBe('bird-eye-high');
    });

    it('renders multi-scene sequence with alternating 3D camera shots and transitions', () => {
      const compositor = new StoryboardCompositor();
      const seq = StoryboardSequence.fromSpec(CINEMATIC_3D_HERO_SHOWCASE_PRESET);
      const targetCanvas = createMockCanvas(600, 800);
      const targetCtx = targetCanvas.getContext('2d')!;

      // Render Act 1 (t = 2.0s)
      expect(() => {
        compositor.renderSequenceFrame(targetCtx, {
          sequence: seq,
          globalTimeSec: 2.0,
          baseState: INITIAL_STUDIO_STATE,
          width: 600,
          height: 800,
        });
      }).not.toThrow();

      // Render Transition between Act 1 and Act 2 (t = 3.6s, transition duration = 0.9s)
      expect(() => {
        compositor.renderSequenceFrame(targetCtx, {
          sequence: seq,
          globalTimeSec: 3.6,
          baseState: INITIAL_STUDIO_STATE,
          width: 600,
          height: 800,
        });
      }).not.toThrow();

      // Render Act 2 (t = 6.0s)
      expect(() => {
        compositor.renderSequenceFrame(targetCtx, {
          sequence: seq,
          globalTimeSec: 6.0,
          baseState: INITIAL_STUDIO_STATE,
          width: 600,
          height: 800,
        });
      }).not.toThrow();

      compositor.dispose();
    });
  });
});
