import { describe, it, expect } from 'bun:test';
import {
  TimeSpaceRegistry,
  resolveTimeSpacePalette,
  interpolateTelemetryTokens,
  TIME_SPACE_PALETTES,
} from '@acc/core-isomorphic';

describe('TimeSpace Dynamic Motion Synthesizer Suite', () => {
  const allTemplates = [
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
    'parametric_superformula',
    'audio_equalizer_spectrum',
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

  it('verifies all 13 motion templates are registered in TimeSpaceRegistry', () => {
    const list = TimeSpaceRegistry.getRegisteredTemplates();
    expect(list.length).toBeGreaterThanOrEqual(13);
    for (const id of allTemplates) {
      expect(list).toContain(id);
    }
  });

  it('resolves aesthetic theme palettes correctly and accepts custom overrides', () => {
    const cyber = resolveTimeSpacePalette({ theme: 'cyberpunk' });
    expect(cyber.primary).toBe(TIME_SPACE_PALETTES.cyberpunk.primary);

    const solar = resolveTimeSpacePalette({ theme: 'solar_flare' });
    expect(solar.primary).toBe(TIME_SPACE_PALETTES.solar_flare.primary);

    const custom = resolveTimeSpacePalette({
      theme: 'cyberpunk',
      primaryColor: '#ff00ff',
      accentColor: '#ffff00',
    });
    expect(custom.primary).toBe('#ff00ff');
    expect(custom.accent).toBe('#ffff00');
  });

  it('interpolates live telemetry tokens dynamically based on frame and timecode', () => {
    const templateText = 'HEADING: {{heading}}° // TC: {{timecode}} // FRAME: {{frame}}';
    const context = { frame: 60, fps: 30, timeSec: 2.0 };
    const result = interpolateTelemetryTokens(templateText, context);

    expect(result).toContain('FRAME: 60');
    expect(result).toContain('TC: 00:00:02:00');
    expect(result).not.toContain('{{heading}}');
  });

  it('supports speedMultiplier scaling in TimeSpaceStateMachine', () => {
    const normal = TimeSpaceRegistry.instantiate('hud_tactical_reticle', { speedMultiplier: 1.0 });
    const fast = TimeSpaceRegistry.instantiate('hud_tactical_reticle', { speedMultiplier: 2.0 });

    const sNormal = normal.seek(30, 30, 1337, { width: 800, height: 600 });
    const sFast = fast.seek(30, 30, 1337, { width: 800, height: 600 });

    // At 1.0s, idle has run for 0.5s (rotation = 45 deg). At 2.0s, idle has run for 1.5s (rotation = 135 deg).
    expect(sNormal.geometry.meta.rotation).toBeCloseTo(45, 1);
    expect(sFast.geometry.meta.rotation).toBeCloseTo(135, 1);
  });

  for (const templateId of allTemplates) {
    it(`renders "${templateId}" with custom themes, colors, and scales across frame sequence`, () => {
      const machine = TimeSpaceRegistry.instantiate(templateId, {
        theme: 'solar_flare',
        primaryColor: '#ff5500',
        accentColor: '#00ffcc',
        speedMultiplier: 1.5,
        scale: 1.2,
        density: 48,
        strokeWidth: 2.5,
        text: 'DYNAMIC TELEMETRY // {{timecode}}',
      });

      expect(machine).toBeDefined();

      for (const frame of [0, 15, 30, 60, 90]) {
        const snapshot = machine.seek(frame, 30, 1337, { width: 1280, height: 720 });
        expect(snapshot).toBeDefined();
        expect(snapshot.state).toBeDefined();

        expect(() => {
          snapshot.render(mockCtx);
        }).not.toThrow();
      }
    });
  }
});
