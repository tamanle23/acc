import { gsap } from 'gsap';
import { Pt, Group, Curve, Polygon } from './DeterministicPtsEngine';

export interface ProxyTweenState {
  progress: number;
  scale: number;
  rotation: number;
  curlTension: number;
  morphRatio: number;
  opacity: number;
  [key: string]: number;
}

/**
 * DeterministicGsapPtsProxy:
 * Core Proxy Tweening Engine. GSAP controls virtual numerical time proxies;
 * Pts computes geometric space deterministically from those values.
 * Paused timelines with lagSmoothing(0) ensure zero wall-clock drift.
 */
export class DeterministicGsapPtsProxy {
  private timeline: gsap.core.Timeline;
  private state: ProxyTweenState;
  private seed: number;
  private fps: number;

  constructor(seed: number = 1337, fps: number = 30) {
    this.seed = seed;
    this.fps = Math.max(1, fps);
    this.state = {
      progress: 0,
      scale: 1,
      rotation: 0,
      curlTension: 0.5,
      morphRatio: 0,
      opacity: 1,
    };

    // Strict determinism: Disable lag smoothing and keep timeline paused
    gsap.ticker.lagSmoothing(0);
    this.timeline = gsap.timeline({ paused: true, autoRemoveChildren: false });
  }

  public getTimeline(): gsap.core.Timeline {
    return this.timeline;
  }

  public getState(): Readonly<ProxyTweenState> {
    return this.state;
  }

  public getSeed(): number {
    return this.seed;
  }

  public getFps(): number {
    return this.fps;
  }

  /**
   * Deterministically evaluates proxy state at frame f.
   * Adheres strictly to DETERMINISTIC-HANDSHAKE-BACKPRESSURE.
   */
  public seekFrame(frame: number): void {
    const timeSec = Math.max(0, frame) / this.fps;
    this.timeline.seek(timeSec, false);
  }

  /**
   * Generates a procedural bezier curve based on the evaluated proxy state.
   */
  public evaluateCurve(basePoints: Pt[]): Group {
    const tension = this.state.curlTension;
    if (basePoints.length >= 4) {
      return Curve.bezier(basePoints, Math.max(2, Math.floor(tension * 20)));
    }
    return Curve.cardinal(basePoints, 10, tension);
  }

  /**
   * Linearly interpolates two polygon vertex rings by proxy morphRatio.
   * Proportionally samples vertices up to max(polyA.length, polyB.length) to prevent truncation.
   */
  public evaluatePolygon(polyA: Pt[] | Polygon, polyB: Pt[] | Polygon): Polygon {
    const ratio = Math.max(0, Math.min(1, this.state.morphRatio));
    if (polyA.length === 0 && polyB.length === 0) {
      return Group.fromArray([]) as unknown as Polygon;
    }
    if (polyA.length === 0) return Group.fromArray(polyB as Pt[]) as unknown as Polygon;
    if (polyB.length === 0) return Group.fromArray(polyA as Pt[]) as unknown as Polygon;

    const maxCount = Math.max(polyA.length, polyB.length);
    const result: Pt[] = [];

    for (let i = 0; i < maxCount; i++) {
      const idxA = Math.min(polyA.length - 1, Math.floor((i * polyA.length) / maxCount));
      const idxB = Math.min(polyB.length - 1, Math.floor((i * polyB.length) / maxCount));
      const pA = polyA[idxA];
      const pB = polyB[idxB];
      const x = pA[0] + (pB[0] - pA[0]) * ratio;
      const y = pA[1] + (pB[1] - pA[1]) * ratio;
      result.push(new Pt(x, y));
    }

    return Group.fromArray(result) as unknown as Polygon;
  }
}
