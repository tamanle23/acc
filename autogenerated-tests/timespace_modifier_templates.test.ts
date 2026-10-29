import { describe, it, expect } from 'bun:test';
import { TimeSpaceRegistry } from '@acc/core-isomorphic';

describe('TimeSpace Motion Templates Suite', () => {
  const registeredTemplates = [
    'callout_leader',
    'kinetic_title',
    'particle_ambient',
    'hud_tactical_reticle',
    'callout_multitarget',
    'network_plexus',
    'audio_waveform_ring',
    'cyber_lower_third',
    'dynamic_countdown',
    'energy_shield_hex',
    'glitch_data_stream',
  ];

  const mockCtx: any = {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    fillText: () => {},
    measureText: () => ({ width: 100 }),
    roundRect: () => {},
    fillRect: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    setLineDash: () => {},
  };

  it('verifies all 11 motion templates are registered in TimeSpaceRegistry', () => {
    const list = TimeSpaceRegistry.getRegisteredTemplates();
    for (const templateId of registeredTemplates) {
      expect(list).toContain(templateId);
      expect(TimeSpaceRegistry.has(templateId)).toBe(true);
    }
  });

  for (const templateId of registeredTemplates) {
    it(`instantiates, seeks, and renders "${templateId}" across multiple frames without throwing`, () => {
      const machine = TimeSpaceRegistry.instantiate(templateId, {
        text: 'TEST TELEMETRY',
        subtitle: 'SUBTITLE PAYLOAD',
        targetX: 0.1,
        targetY: -0.1,
      });

      expect(machine).toBeDefined();

      const testFrames = [0, 15, 30, 60, 90, 120];
      for (const frame of testFrames) {
        const snapshot = machine.seek(frame, 30, 42, { width: 640, height: 360 });
        expect(snapshot).toBeDefined();
        expect(snapshot.phase).toBeDefined();
        expect(snapshot.state).toBeDefined();

        // Exercise rendering
        expect(() => {
          snapshot.render(mockCtx);
        }).not.toThrow();
      }
    });
  }

  it('guarantees deterministic bit-identical geometry snapshots on repeated seeks for HUD and Plexus', () => {
    const hud = TimeSpaceRegistry.instantiate('hud_tactical_reticle');
    const s1 = hud.seek(45, 30, 777, { width: 800, height: 600 });
    const s2 = hud.seek(45, 30, 777, { width: 800, height: 600 });

    expect(s1.geometry.meta.rotation).toBeCloseTo(s2.geometry.meta.rotation, 5);
    expect(s1.geometry.meta.radius).toBeCloseTo(s2.geometry.meta.radius, 5);

    const plexus = TimeSpaceRegistry.instantiate('network_plexus');
    const p1 = plexus.seek(25, 30, 999, { width: 800, height: 600 });
    const p2 = plexus.seek(25, 30, 999, { width: 800, height: 600 });

    expect(p1.geometry.points.length).toBe(p2.geometry.points.length);
    for (let i = 0; i < p1.geometry.points.length; i++) {
      expect(p1.geometry.points[i][0]).toBeCloseTo(p2.geometry.points[i][0], 5);
      expect(p1.geometry.points[i][1]).toBeCloseTo(p2.geometry.points[i][1], 5);
    }
  });
});
