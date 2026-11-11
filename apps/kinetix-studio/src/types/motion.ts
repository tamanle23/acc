export type TimelineMode = 'studio3' | 'narrative4' | 'continuous';

export type FpsCadence = 12 | 24 | 30 | 60;

export type EasingId =
  | 'expo-out'
  | 'spring-luxury'
  | 'steps-8'
  | 'linear-sine'
  | 'elastic-whip'
  | 'velvet-cubic'
  | 'strobe-safe'
  | 'steps-12'
  | 'sawtooth-ramp'
  | 'heartbeat'
  | 'zero-g-sine'
  | 'cyber-jitter';

export type KineticTypeId =
  | 'weight-wave'
  | 'track-expand'
  | 'perspective-shear'
  | 'slide-shear'
  | 'cylinder-3d'
  | 'rgb-glitch'
  | 'bounce-floor'
  | 'strobe-gate'
  | 'accordion'
  | 'pendulum'
  | 'orbital-swirl'
  | 'outline-breathe'
  | 'editorial-reveal'
  | 'rotary-typeset'
  | 'analog-cinematic-drift'
  | 'swing-polyrhythm';

export type HeroMotionId = 'turntable' | 'levitate' | 'gyro' | 'monument';

export interface ChoreographyEnvelope {
  phaseIndex: number;
  phaseName: string;
  phaseDesc: string;
  headlineReveal: number;
  heroScaleBoost: number;
  heroSpinBoost: number;
  typeEnergyScale: number;
  climaxSurge: number;
  metaReveal: number;
  holdCalmness: number;
}

export interface AudioTelemetry {
  level: number;
  bass: number; // 20–250Hz normalized [0, 1]
  mid: number;  // 250–2000Hz normalized [0, 1]
  high: number; // 2000–16000Hz normalized [0, 1]
  beatPulse: number;
}

export interface EasingItem {
  id: EasingId;
  name: string;
  badge: string;
}

export interface KineticTypeItem {
  id: KineticTypeId;
  name: string;
}

export type ChoreoMode = 'procedural-3phase' | 'custom-keyframe';

export type TangentMode = 'smooth' | 'broken' | 'flat';

export interface BezierKnot {
  t: number;      // normalized progress [0, 1]
  val: number;    // normalized value [0, 1]
  cpIn?: [number, number];  // handle delta [-dt, -dval]
  cpOut?: [number, number]; // handle delta [+dt, +dval]
  tangentMode?: TangentMode; // angle locking mode (default: 'smooth')
}

export interface CustomKeyframeTracks {
  energyTrack: BezierKnot[];
  heroZoomTrack: BezierKnot[];
  turbulenceTrack: BezierKnot[];
  lightingTrack: BezierKnot[];
}

