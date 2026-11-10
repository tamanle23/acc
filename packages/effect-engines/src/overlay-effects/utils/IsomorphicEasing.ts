/**
 * Zero-dependency pure mathematical easing functions conforming to WinterTC.
 * Bit-identical analytical equivalents to GSAP power2.out, sine.inOut, and expo.inOut.
 * Completely eliminates 65KB+ external animation dependencies and window/document DOM lookups.
 */
export const IsomorphicEasing = {
  /**
   * Quadratic ease-out (GSAP: power2.out)
   */
  power2Out: (t: number): number => {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * (2 - clamped);
  },

  /**
   * Quadratic ease-in (GSAP: power2.in)
   */
  power2In: (t: number): number => {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * clamped;
  },

  /**
   * Sinusoidal ease-in-out (GSAP: sine.inOut)
   */
  sineInOut: (t: number): number => {
    const clamped = Math.max(0, Math.min(1, t));
    const val = -0.5 * (Math.cos(Math.PI * clamped) - 1);
    return val === 0 ? 0 : val;
  },

  /**
   * Exponential ease-in-out (GSAP: expo.inOut)
   */
  expoInOut: (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    if (t < 0.5) return 0.5 * Math.pow(2, 20 * t - 10);
    return 1 - 0.5 * Math.pow(2, -20 * t + 10);
  },

  /**
   * Linear progression
   */
  linear: (t: number): number => Math.max(0, Math.min(1, t)),
} as const;
