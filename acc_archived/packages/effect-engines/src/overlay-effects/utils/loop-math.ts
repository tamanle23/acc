/**
 * Calculates a smooth fading alpha value based on a particle's lifetime
 * to ensure it fades out before resetting, creating a seamless loop.
 * 
 * @param age Current frame age of the particle
 * @param lifetime Total frame lifetime of the particle
 * @param fadeOutRatio Portion of the lifetime spent fading out (e.g., 0.2 means last 20%)
 * @param fadeInRatio Portion of the lifetime spent fading in
 */
export function getSeamlessAlpha(
  age: number,
  lifetime: number,
  fadeInRatio: number = 0.1,
  fadeOutRatio: number = 0.2
): number {
  const progress = age / lifetime;
  
  if (progress < fadeInRatio) {
    return progress / fadeInRatio;
  }
  
  if (progress > 1 - fadeOutRatio) {
    return (1 - progress) / fadeOutRatio;
  }
  
  return 1;
}

/**
 * Calculates a looped position that seamlessly wraps around the screen.
 * 
 * @param startPos Initial position
 * @param speed Movement speed per frame
 * @param frame Current frame number
 * @param limit Screen boundary (width or height)
 */
export function getLoopedPosition(
  startPos: number,
  speed: number,
  frame: number,
  limit: number
): number {
  const currentPos = startPos + (speed * frame);
  // Ensure positive modulo
  return ((currentPos % limit) + limit) % limit;
}
