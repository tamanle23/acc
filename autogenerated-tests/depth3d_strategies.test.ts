import { describe, it, expect } from 'bun:test';
import { Depth3DFactory, Depth3DRendererRegistry } from '../packages/effect-engines/src/depth3d';

describe('3D Depth Strategies & Factory Unit Tests', () => {
  it('should register and list all 17+ 3D depth effect modes in Depth3DFactory', () => {
    const modes = Depth3DFactory.listAvailableModes();
    expect(modes.length).toBeGreaterThanOrEqual(17);

    const expectedModes = [
      'frame_breaker',
      'parallax_25d',
      'volumetric_sandwich',
      'depth_map_3d',
      'wigglegram',
      'isometric_podium',
      'cutout_portal',
      'gyro_focal_tilt',
      'flythrough_carousel',
      'diffuse_shadow',
      'glassmorphic_fresnel',
      'silhouette_rim_light',
      'plane_cast_shadow',
      'macro_bokeh',
      'aerial_mist',
      'rack_focus',
      'vignette_tunnel',
      'perspective_grid',
      'extruded_text_3d',
      'isometric_billboard',
      'tunneling_text'
    ];

    for (const expected of expectedModes) {
      expect(modes).toContain(expected);
      const renderer = Depth3DFactory.getRenderer(expected);
      expect(renderer).toBeDefined();
      expect(typeof renderer.renderFrame).toBe('function');
    }
  });

  it('should fallback gracefully to default renderer if unknown mode is provided', () => {
    const unknownRenderer = Depth3DFactory.getRenderer('unknown_experimental_effect');
    expect(unknownRenderer).toBeDefined();
    expect(unknownRenderer.mode).toBe('frame_breaker');
  });

  it('should execute renderFrame without error on simulated canvas context for each renderer', () => {
    const modes = Depth3DFactory.listAvailableModes();
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const canvas = createCanvas(320, 240);
    const ctx = canvas.getContext('2d');
    const dummyImg = createCanvas(100, 100);

    const state: any = {
      img: dummyImg,
      subjectImg: dummyImg,
      bgImg: dummyImg,
      bgCanvas: canvas,
      srcCanvas: canvas,
      baseCanvas: canvas,
      depthLayers: { bgCanvas: canvas },
      width: 320,
      height: 240,
      frame: 1,
      totalFrames: 10,
      timeSec: 0.1,
      progress: 0.1,
      depthConfig: {},
      captions: [{ text: 'TEST 3D', start: 0, end: 1 }]
    };

    for (const mode of modes) {
      const renderer = Depth3DFactory.getRenderer(mode);
      expect(() => renderer.renderFrame(ctx, state)).not.toThrow();
    }
  });
});
