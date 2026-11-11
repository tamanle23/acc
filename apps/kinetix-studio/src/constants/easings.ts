import type { EasingId, EasingItem } from '@/types/motion';

export const EASE_DESCRIPTIONS: Record<EasingId, { name: string; badge: string }> = {
  'expo-out': { name: 'Expo Snap (Studio Hook)', badge: 'CUBIC(0.16,1,0.3,1)' },
  'spring-luxury': { name: 'Luxury Damped Spring', badge: 'SPRING(80,20)' },
  'steps-8': { name: 'Quantized Steps (8 FPS)', badge: 'STEPS(8)' },
  'linear-sine': { name: 'Linear Harmonic Sine', badge: 'SINE(2π)' },
  'elastic-whip': { name: 'Elastic Whip Overshoot', badge: 'ELASTIC' },
  'velvet-cubic': { name: 'Cubic Velvety Whip', badge: 'CUBIC(0.65,0,0.35,1)' },
  'strobe-safe': { name: 'Ultra-Strobe Cut (≤3Hz Safe)', badge: 'STEPS(3)' },
  'steps-12': { name: 'Anime Cel Cadence (12 FPS)', badge: 'STEPS(12)' },
  'sawtooth-ramp': { name: 'Industrial Sawtooth Ramp', badge: 'RAMP(4X)' },
  'heartbeat': { name: 'Bi-Phasic Sub-Bass Heartbeat', badge: 'PULSE-2X' },
  'zero-g-sine': { name: 'Zero-G Pendulum Drift', badge: 'COS(2π)' },
  'cyber-jitter': { name: 'Cybernetic Micro-Jitter', badge: 'QUANT-16' },
};

export const EASING_CATALOG: EasingItem[] = (
  Object.keys(EASE_DESCRIPTIONS) as EasingId[]
).map((id) => ({
  id,
  name: EASE_DESCRIPTIONS[id].name,
  badge: EASE_DESCRIPTIONS[id].badge,
}));

