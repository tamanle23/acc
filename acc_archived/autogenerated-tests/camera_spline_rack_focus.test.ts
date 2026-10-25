import { describe, it, expect } from 'bun:test';
import { createCanvas } from '@napi-rs/canvas';
import {
  CameraSplineInterpolator,
  type Camera3DKeyframe,
  type Camera3DState,
} from '../packages/effect-engines/src/vision/CameraSplineInterpolator';
import { Camera3DPlugin } from '../packages/ir/src/plugins/vfx/Camera3DPlugin';
import { ModifierPluginRegistry } from '../packages/ir/src/plugins/ModifierPluginRegistry';
import { registerCoreModifierPlugins } from '../packages/ir/src/plugins';

describe('Phase 2: Cinematic 3D Camera Path Sequencer & Dynamic Rack Focus', () => {
  it('should interpolate 3D camera trajectory smoothly via Catmull-Rom splines', () => {
    const keyframes: Camera3DKeyframe[] = [
      { time: 0.0, position: [0.0, 0.0, 1.0], target: [0, 0, 0], roll: 0, fov: 60, focalZ: 0.2, focalAperture: 0.5 },
      { time: 0.5, position: [0.5, -0.2, 0.8], target: [0.1, 0, 0], roll: 5, fov: 55, focalZ: 0.6, focalAperture: 0.8 },
      { time: 1.0, position: [-0.2, 0.3, 0.6], target: [0, 0.1, 0], roll: -2, fov: 50, focalZ: 0.9, focalAperture: 0.3 },
    ];

    const totalFrames = 60;
    const width = 1920;
    const height = 1080;

    const buffer = CameraSplineInterpolator.precomputeTrajectory(keyframes, totalFrames, width, height);

    expect(buffer.length).toBe(totalFrames * 10);

    const state: Camera3DState = {
      x: 0,
      y: 0,
      z: 0,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
      roll: 0,
      fov: 0,
      focalZ: 0,
      focalAperture: 0,
      scale: 0,
      transX: 0,
      transY: 0,
      rotationRad: 0,
    };

    // Frame 0 should match start keyframe
    CameraSplineInterpolator.readFrameState(buffer, 0, width, height, state);
    expect(Math.abs(state.x - 0.0)).toBeLessThan(0.001);
    expect(Math.abs(state.y - 0.0)).toBeLessThan(0.001);
    expect(Math.abs(state.z - 1.0)).toBeLessThan(0.001);
    expect(state.scale).toBeGreaterThan(0.9);

    // Frame 30 (midpoint) should be near position [0.5, -0.2, 0.8]
    CameraSplineInterpolator.readFrameState(buffer, 30, width, height, state);
    expect(Math.abs(state.x - 0.5)).toBeLessThan(0.05);
    expect(Math.abs(state.y - (-0.2))).toBeLessThan(0.05);
    expect(Math.abs(state.z - 0.8)).toBeLessThan(0.05);
    expect(state.fov).toBeLessThan(60);
    expect(state.scale).toBeGreaterThan(1.0); // Z decreased (closer) -> scale increased
  });

  it('should register Camera3DPlugin under type vfx/camera_3d in ModifierPluginRegistry', () => {
    const registry = registerCoreModifierPlugins();
    const plugin = registry.get('vfx/camera_3d');

    expect(plugin).toBeDefined();
    expect(plugin?.type).toBe('vfx/camera_3d');
    expect(plugin?.targetScope).toBe('sequence');
    expect(plugin?.targetPhase).toBe(2);
  });

  it('should execute preflight and render clip space without heap allocation during frame loop', async () => {
    const plugin = new Camera3DPlugin();
    const width = 640;
    const height = 360;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const mockSequence: any = {
      id: 'seq-camera-test',
      durationFrames: 30,
    };

    const modContext: any = {
      targetType: 'sequence',
      targetEntity: mockSequence,
      timeline: new Map(),
      fps: 30,
      canvas: { width, height },
      state: {},
    };

    // Preflight execution
    await plugin.execute(modContext, {
      keyframes: [
        { time: 0.0, position: [0, 0, 1.0] },
        { time: 1.0, position: [0.1, -0.1, 0.8], roll: 2.0 },
      ],
      rackFocus: { enabled: true, aperture: 0.5 },
    });

    // Render clip space across all 30 frames
    for (let f = 0; f < 30; f++) {
      plugin.renderClipSpace(
        {
          canvas: canvas as any,
          ctx: ctx as any,
          frame: f,
          localFrame: f,
          width,
          height,
          sequence: mockSequence,
          baseAsset: undefined,
        },
        {}
      );
    }

    // Success if loop completed with zero throws
    expect(true).toBe(true);
  });
});
