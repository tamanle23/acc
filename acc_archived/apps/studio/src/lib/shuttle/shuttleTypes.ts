/**
 * ShuttleSpeed: Discrete industrial NLE shuttle rates.
 * J = reverse [-1x, -2x, -4x, -8x]
 * K = stop [0x]
 * L = forward [1x, 2x, 4x, 8x]
 */
export type ShuttleSpeed = -8 | -4 | -2 | -1 | 0 | 1 | 2 | 4 | 8;

export const SHUTTLE_SPEEDS: readonly ShuttleSpeed[] = [-8, -4, -2, -1, 0, 1, 2, 4, 8];

export interface ShuttleState {
  speed: ShuttleSpeed;
  isPlaying: boolean;
  currentFrame: number;
  fps: number;
  isAudioMuted: boolean;
  playbackRate: number;
}

/**
 * Discrete Frame Jump Rule:
 * All shuttle transitions, playhead advancements, and scrubbing MUST jump in exact
 * discrete integer frame increments (frame = Math.round(timeSec * fps)), NEVER arbitrary continuous floats.
 */
export function timeToDiscreteFrame(timeSec: number, fps: number): number {
  return Math.round(timeSec * Math.max(1, fps));
}

/**
 * Converts discrete integer frame to timeline seconds.
 */
export function discreteFrameToTime(frame: number, fps: number): number {
  return Math.round(frame) / Math.max(1, fps);
}

/**
 * Snaps any floating-point frame number to the nearest discrete integer frame.
 */
export function snapToDiscreteFrame(frame: number): number {
  const rounded = Math.round(frame);
  return rounded === 0 ? 0 : rounded;
}

/**
 * Calculates next shuttle speed for J (reverse), K (stop), or L (forward) NLE navigation.
 */
export function getNextShuttleSpeed(
  currentSpeed: ShuttleSpeed,
  action: 'forward' | 'reverse' | 'stop'
): ShuttleSpeed {
  if (action === 'stop') {
    return 0;
  }

  let currentIndex = SHUTTLE_SPEEDS.indexOf(currentSpeed);
  if (currentIndex === -1) {
    if (action === 'forward') {
      // Find the smallest speed in SHUTTLE_SPEEDS strictly greater than currentSpeed, or snap to closest
      const next = SHUTTLE_SPEEDS.find(s => s > currentSpeed);
      return next !== undefined ? next : 8;
    }
    if (action === 'reverse') {
      // Find the largest speed in SHUTTLE_SPEEDS strictly less than currentSpeed, or snap to closest
      const prev = [...SHUTTLE_SPEEDS].reverse().find(s => s < currentSpeed);
      return prev !== undefined ? prev : -8;
    }
  }

  if (action === 'forward') {
    // If currently stopped, start forward at 1x
    if (currentSpeed === 0) return 1;
    // If currently reversing, decrement reverse rate or jump to 0
    if (currentSpeed < 0) {
      const nextIdx = currentIndex + 1;
      return SHUTTLE_SPEEDS[Math.min(SHUTTLE_SPEEDS.length - 1, nextIdx)];
    }
    // If already playing forward, accelerate: 1x -> 2x -> 4x -> 8x
    const nextIdx = currentIndex + 1;
    return SHUTTLE_SPEEDS[Math.min(SHUTTLE_SPEEDS.length - 1, nextIdx)];
  }

  if (action === 'reverse') {
    // If currently stopped, start reverse at -1x
    if (currentSpeed === 0) return -1;
    // If currently forward, decelerate: 8x -> 4x -> 2x -> 1x -> 0
    if (currentSpeed > 0) {
      const prevIdx = currentIndex - 1;
      return SHUTTLE_SPEEDS[Math.max(0, prevIdx)];
    }
    // If already reversing, accelerate reverse: -1x -> -2x -> -4x -> -8x
    const prevIdx = currentIndex - 1;
    return SHUTTLE_SPEEDS[Math.max(0, prevIdx)];
  }

  return 0;
}

/**
 * Audio Hardware Clock Sync Rule:
 * Pitch preservation (preservesPitch = true) is active only for forward speeds up to 2x.
 * Speeds in reverse (< 0) or high speed (>= 4x) or stopped (0x) are safely muted
 * to prevent audio buffer distortion during high-speed video scrubbing.
 */
export function shouldMuteAudio(speed: ShuttleSpeed): boolean {
  if (speed === 0) return true;
  if (speed < 0) return true; // Reverse is safely muted
  if (speed >= 4) return true; // >= 4x is safely muted
  return false;
}

/**
 * Determines Web Audio playbackRate for pitch preservation forward shuttle.
 */
export function getAudioPlaybackRate(speed: ShuttleSpeed): number {
  if (speed === 1) return 1.0;
  if (speed === 2) return 2.0;
  return 1.0;
}
