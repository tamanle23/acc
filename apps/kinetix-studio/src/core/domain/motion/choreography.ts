// ============================================================================
// KINETIX STUDIO - CORE DOMAIN: TEMPORAL CHOREOGRAPHY & EASING MATH (ECMA-429)
// Pure cubic-bezier solvers, harmonic oscillators, and multi-act envelopes.
// Zero DOM or browser window dependencies.
// ============================================================================

import type {
  EasingId,
  TimelineMode,
  ChoreographyEnvelope,
  BezierKnot,
  CustomKeyframeTracks,
  ChoreoMode,
} from '@/types/motion';
import { UnitBezier } from './bezier-solver';

// Static pre-compiled UnitBezier solvers for standard cubic easing curves
const expoOutBezier = new UnitBezier(0.16, 1.0, 0.3, 1.0);
const velvetCubicBezier = new UnitBezier(0.65, 0.0, 0.35, 1.0);

export function evaluateBezierTrack(knots: BezierKnot[] | undefined, t: number): number {
  if (!knots || knots.length === 0) return 0.5;
  if (knots.length === 1) return knots[0]!.val;

  const sorted = [...knots].sort((a, b) => a.t - b.t);
  if (t <= sorted[0]!.t) return sorted[0]!.val;
  if (t >= sorted[sorted.length - 1]!.t) return sorted[sorted.length - 1]!.val;

  // Locate active spline segment
  let i = 0;
  while (i < sorted.length - 1 && sorted[i + 1]!.t < t) {
    i++;
  }

  const k0 = sorted[i]!;
  const k1 = sorted[i + 1]!;
  const dt = k1.t - k0.t;
  if (dt <= 0.0001) return k0.val;

  const x = Math.max(0, Math.min(1, (t - k0.t) / dt));

  // Tangent handles for horizontal time warping
  const cp1x = Math.max(0, Math.min(1, (k0.cpOut ? k0.cpOut[0] : dt * (1 / 3)) / dt));
  const cp2x = Math.max(0, Math.min(1, 1 + (k1.cpIn ? k1.cpIn[0] : -dt * (1 / 3)) / dt));

  // Control points for vertical value
  const p0 = k0.val;
  const p1 = k0.cpOut ? k0.val + k0.cpOut[1] : k0.val;
  const p2 = k1.cpIn ? k1.val + k1.cpIn[1] : k1.val;
  const p3 = k1.val;

  // Solve parametric parameter u(x) using UnitBezier Newton-Raphson iteration
  const solver = new UnitBezier(cp1x, 0, cp2x, 1);
  const u = solver.solveCurveX(x);

  const invU = 1 - u;
  return (
    invU * invU * invU * p0 +
    3 * invU * invU * u * p1 +
    3 * invU * u * u * p2 +
    u * u * u * p3
  );
}

export function evaluateEasing(id: EasingId, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  switch (id) {
    case 'expo-out':
      return expoOutBezier.solve(x);
    case 'spring-luxury': {
      const c4 = (2 * Math.PI) / 3;
      return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -8 * x) * Math.sin((x * 6 - 0.75) * c4) + 1;
    }
    case 'steps-8':
      return Math.floor(x * 8) / 8;
    case 'linear-sine':
      return Math.sin(x * Math.PI * 0.5);
    case 'elastic-whip':
      return x === 0 || x === 1
        ? x
        : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    case 'velvet-cubic':
      return velvetCubicBezier.solve(x);
    case 'strobe-safe':
      // Optical safety: max 3 steps per second
      return Math.floor(x * 6) / 6;
    case 'steps-12':
      return Math.floor(x * 12) / 12;
    case 'sawtooth-ramp':
      return (x * 4) % 1;
    case 'heartbeat':
      return Math.pow(Math.sin(x * Math.PI * 2), 4);
    case 'zero-g-sine':
      return 0.5 - 0.5 * Math.cos(x * Math.PI * 2);
    case 'cyber-jitter':
      return Math.floor(x * 16) / 16 + 0.02 * Math.sin(x * Math.PI * 6);
    default:
      return x;
  }
}

export function computeChoreography(
  rawProgress: number,
  mode: TimelineMode,
  hicksLaw = true,
  customTracks?: CustomKeyframeTracks,
  choreoMode: ChoreoMode = 'procedural-3phase'
): ChoreographyEnvelope {
  const p = Math.min(1, Math.max(0, rawProgress));

  // Custom Multi-Track Cubic-Bezier Spline Evaluation
  if (choreoMode === 'custom-keyframe' && customTracks) {
    const energy = evaluateBezierTrack(customTracks.energyTrack, p);
    const zoom = evaluateBezierTrack(customTracks.heroZoomTrack, p);
    const turb = evaluateBezierTrack(customTracks.turbulenceTrack, p);
    const light = evaluateBezierTrack(customTracks.lightingTrack, p);

    return {
      phaseIndex: p < 0.25 ? 0 : p < 0.75 ? 1 : 2,
      phaseName: 'CUSTOM CUBIC-BEZIER KEYFRAMING',
      phaseDesc: `Energy ${(energy * 100).toFixed(0)}% // Zoom ${(zoom * 100).toFixed(0)}%`,
      headlineReveal: Math.min(1, energy * 1.4),
      heroScaleBoost: 0.8 + zoom * 0.4,
      heroSpinBoost: (1 - energy) * 0.25,
      typeEnergyScale: 0.4 + energy * 1.4,
      climaxSurge: turb,
      metaReveal: Math.min(1, light * 1.25),
      holdCalmness: 1 - energy * 0.5,
    };
  }

  if (mode === 'continuous') {
    return {
      phaseIndex: 0,
      phaseName: 'CONTINUOUS HARMONIC OSCILLATOR',
      phaseDesc: 'Steady 2πk periodic loop without act damping',
      headlineReveal: 1,
      heroScaleBoost: 1 + 0.06 * Math.sin(p * Math.PI * 2),
      heroSpinBoost: 0,
      typeEnergyScale: 1.0,
      climaxSurge: 0,
      metaReveal: 1,
      holdCalmness: 0.25,
    };
  }

  if (mode === 'studio3') {
    if (p < 0.1875) {
      const local = p / 0.1875;
      const expo = evaluateEasing('expo-out', local);
      return {
        phaseIndex: 0,
        phaseName: 'PHASE 1 // THE HOOK (0–1.5s)',
        phaseDesc: 'Ease-Out-Expo burst & headline kinetic entrance',
        headlineReveal: hicksLaw ? expo : 1,
        heroScaleBoost: 0.75 + 0.32 * expo,
        heroSpinBoost: (1 - expo) * 0.65,
        typeEnergyScale: 1.55 * (1 - local * 0.35),
        climaxSurge: Math.sin(local * Math.PI) * 0.85,
        metaReveal: hicksLaw ? Math.max(0, (local - 0.55) / 0.45) : 1,
        holdCalmness: 0.2,
      };
    } else if (p < 0.75) {
      const local = (p - 0.1875) / (0.75 - 0.1875);
      const hicksMeta = hicksLaw ? Math.min(1, 0.35 + local * 1.8) : 1;
      return {
        phaseIndex: 1,
        phaseName: 'PHASE 2 // GOLDEN HOLD (1.5–6.0s)',
        phaseDesc: 'Damped sustain window for 100% copy legibility',
        headlineReveal: 1,
        heroScaleBoost: 1.07 + 0.04 * Math.sin(local * Math.PI),
        heroSpinBoost: 0,
        typeEnergyScale: 0.25,
        climaxSurge: 0,
        metaReveal: hicksMeta,
        holdCalmness: 0.92,
      };
    } else {
      const local = (p - 0.75) / 0.25;
      const smooth = 0.5 - 0.5 * Math.cos(local * Math.PI);
      return {
        phaseIndex: 2,
        phaseName: 'PHASE 3 // INFINITE LOOP (6.0–8.0s)',
        phaseDesc: 'Zero-seam harmonic convergence back to Frame 0',
        headlineReveal: 1,
        heroScaleBoost: 1.07 * (1 - smooth) + 1.0 * smooth,
        heroSpinBoost: 0,
        typeEnergyScale: 0.25 * (1 - smooth),
        climaxSurge: 0,
        metaReveal: 1,
        holdCalmness: 1.0,
      };
    }
  }

  // 4-Act Narrative Mode (10-15s Extended Campaign Arc)
  if (p < 0.25) {
    const local = p / 0.25;
    const expo = evaluateEasing('expo-out', local);
    return {
      phaseIndex: 0,
      phaseName: 'ACT I // SPATIAL REVEAL',
      phaseDesc: 'Progressive headline & grid emergence',
      headlineReveal: hicksLaw ? expo : 1,
      heroScaleBoost: 0.65 + 0.35 * expo,
      heroSpinBoost: 0,
      typeEnergyScale: 1.15,
      climaxSurge: 0,
      metaReveal: hicksLaw ? local * 0.6 : 1,
      holdCalmness: 0.3,
    };
  } else if (p < 0.55) {
    const local = (p - 0.25) / 0.3;
    const bell = Math.sin(local * Math.PI);
    return {
      phaseIndex: 1,
      phaseName: 'ACT II // HERO SHOWCASE',
      phaseDesc: '2.5D Hero breakout & inspection reticle',
      headlineReveal: 1,
      heroScaleBoost: 1 + 0.28 * bell,
      heroSpinBoost: bell * 0.9,
      typeEnergyScale: 0.3,
      climaxSurge: 0,
      metaReveal: hicksLaw ? 0.6 + local * 0.4 : 1,
      holdCalmness: 0.5,
    };
  } else if (p < 0.8) {
    const local = (p - 0.55) / 0.25;
    const surge = Math.sin(local * Math.PI);
    return {
      phaseIndex: 2,
      phaseName: 'ACT III // KINETIC CLIMAX',
      phaseDesc: 'Harmonic shockwave & peak velocity',
      headlineReveal: 1,
      heroScaleBoost: 1 + 0.14 * surge,
      heroSpinBoost: surge * 0.4,
      typeEnergyScale: 1.75,
      climaxSurge: surge,
      metaReveal: 1,
      holdCalmness: 0.1,
    };
  } else {
    const local = (p - 0.8) / 0.2;
    return {
      phaseIndex: 3,
      phaseName: 'ACT IV // CANONICAL LOCKUP',
      phaseDesc: 'Settled CTA readability & zero-seam return',
      headlineReveal: 1,
      heroScaleBoost: 1,
      heroSpinBoost: 0,
      typeEnergyScale: Math.max(0, 1 - local * 1.4),
      climaxSurge: 0,
      metaReveal: 1,
      holdCalmness: 1,
    };
  }
}
