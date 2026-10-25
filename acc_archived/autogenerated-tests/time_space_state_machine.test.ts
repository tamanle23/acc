import { describe, it, expect } from 'bun:test';
import {
  createTimeSpaceMachine,
  TimeSpaceRegistry,
  Pt,
  solveTemporalBoundary,
} from '@acc/core-isomorphic';

describe('TimeSpaceStateMachine Test Suite', () => {
  it('pure mathematical boundary solver wraps time deterministically without overflow', () => {
    // Clamp
    expect(solveTemporalBoundary(-1, 5, 'clamp')).toBe(0);
    expect(solveTemporalBoundary(2.5, 5, 'clamp')).toBe(2.5);
    expect(solveTemporalBoundary(10, 5, 'clamp')).toBe(5);

    // Loop
    expect(solveTemporalBoundary(5.5, 5, 'loop')).toBeCloseTo(0.5, 5);
    expect(solveTemporalBoundary(1000000.25, 5, 'loop')).toBeCloseTo(0.25, 5);

    // Pingpong
    expect(solveTemporalBoundary(2, 5, 'pingpong')).toBe(2);
    expect(solveTemporalBoundary(6, 5, 'pingpong')).toBe(4); // cycle is 10, 6 -> 10-6=4
    expect(solveTemporalBoundary(9, 5, 'pingpong')).toBe(1); // 9 -> 10-9=1

    // Once
    expect(solveTemporalBoundary(-2, 5, 'once')).toBe(0);
    expect(solveTemporalBoundary(3, 5, 'once')).toBe(3);
    expect(solveTemporalBoundary(7, 5, 'once')).toBe(5);
  });

  it('correctly transitions through discrete phases (enter -> idle -> exit) with state interpolation', () => {
    const machine = createTimeSpaceMachine({
      initialState: {
        scale: 0,
        alpha: 0,
      },
      phases: {
        enter: {
          duration: 1.0, // frames 0-29 at 30fps
          setup: (tl, state) => {
            tl.to(state, { scale: 1.0, alpha: 1.0, duration: 1.0, ease: 'linear' });
          },
        },
        idle: {
          duration: 2.0, // frames 30-89
          setup: (tl, state) => {
            tl.to(state, { scale: 1.2, duration: 2.0, ease: 'linear' });
          },
        },
        exit: {
          duration: 1.0, // frames 90-119
          setup: (tl, state) => {
            tl.to(state, { scale: 0.5, alpha: 0.0, duration: 1.0, ease: 'linear' });
          },
        },
      },
      boundary: 'clamp',
    });

    // Frame 0: Start of enter
    const s0 = machine.seek(0, 30);
    expect(s0.phase).toBe('enter');
    expect(s0.state.scale).toBeCloseTo(0.0, 3);
    expect(s0.state.alpha).toBeCloseTo(0.0, 3);

    // Frame 15: Halfway through enter
    const s15 = machine.seek(15, 30);
    expect(s15.phase).toBe('enter');
    expect(s15.state.scale).toBeCloseTo(0.5, 3);
    expect(s15.state.alpha).toBeCloseTo(0.5, 3);

    // Frame 45: In idle phase (1.5s -> 0.5s into idle)
    const s45 = machine.seek(45, 30);
    expect(s45.phase).toBe('idle');
    expect(s45.state.alpha).toBeCloseTo(1.0, 3);
    expect(s45.state.scale).toBeCloseTo(1.05, 2);

    // Frame 105: In exit phase (3.5s -> 0.5s into exit)
    const s105 = machine.seek(105, 30);
    expect(s105.phase).toBe('exit');
    expect(s105.state.alpha).toBeCloseTo(0.5, 2);
  });

  it('guarantees aspect-aware spatial projection across 16:9, 9:16, and 1:1 viewports', () => {
    const machine = createTimeSpaceMachine({
      initialState: {},
      generateGeometry: (_, space) => {
        // Map normalized center and corner points
        const center = space.toPixels([0, 0]);
        const rightEdge = space.toPixels([1, 0]);
        const bottomEdge = space.toPixels([0, 1]);
        return {
          points: [center, rightEdge, bottomEdge],
        };
      },
    });

    // 16:9 landscape (1920x1080)
    const snap16_9 = machine.seek(0, 30, 1337, { width: 1920, height: 1080 });
    expect(snap16_9.geometry.points[0][0]).toBe(960);
    expect(snap16_9.geometry.points[0][1]).toBe(540);
    expect(snap16_9.geometry.points[1][0]).toBe(1920); // right edge
    expect(snap16_9.geometry.points[2][1]).toBe(1080); // bottom edge

    // 9:16 mobile portrait (1080x1920)
    const snap9_16 = machine.seek(0, 30, 1337, { width: 1080, height: 1920 });
    expect(snap9_16.geometry.points[0][0]).toBe(540);
    expect(snap9_16.geometry.points[0][1]).toBe(960);
    expect(snap9_16.geometry.points[1][0]).toBe(1080);
    expect(snap9_16.geometry.points[2][1]).toBe(1920);

    // 1:1 square (1080x1080)
    const snap1_1 = machine.seek(0, 30, 1337, { width: 1080, height: 1080 });
    expect(snap1_1.geometry.points[0][0]).toBe(540);
    expect(snap1_1.geometry.points[0][1]).toBe(540);
  });

  it('instantiates and evaluates registered motion graphic templates from TimeSpaceRegistry', () => {
    expect(TimeSpaceRegistry.has('callout_leader')).toBe(true);
    expect(TimeSpaceRegistry.has('kinetic_title')).toBe(true);

    const callout = TimeSpaceRegistry.instantiate('callout_leader', {
      targetX: -0.2,
      targetY: 0.1,
      text: 'SENSOR_01',
    });

    const snap = callout.seek(15, 30, 1337, { width: 1920, height: 1080 });
    expect(snap.geometry.points.length).toBeGreaterThan(0);
    expect(snap.buffers.positions.length).toBeGreaterThan(0);
    expect(typeof snap.render).toBe('function');
  });
});
