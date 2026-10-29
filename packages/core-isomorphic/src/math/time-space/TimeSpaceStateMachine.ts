import { gsap } from 'gsap';
import { Pt, Group, Polygon } from '../pts/DeterministicPtsEngine';
import { DeterministicPtsForm } from '../pts/DeterministicPtsForm';
import type { ICanvasContext2D } from '../../../isomorphic/canvas/types';

export type TemporalBoundaryPolicy = 'loop' | 'pingpong' | 'clamp' | 'once';

export interface TrackTemporalConfig<TTrackState = any> {
  start?: number; // in seconds
  duration: number; // in seconds
  boundary?: TemporalBoundaryPolicy;
  setup?: (tl: gsap.core.Timeline, state: TTrackState) => void;
}

export interface PhaseDefinition<TState = any> {
  duration: number; // in seconds
  setup?: (tl: gsap.core.Timeline, state: TState) => void;
}

export interface SpaceContext {
  width: number;
  height: number;
  aspectRatio: number;
  center: Pt;
  toPixels: (pt: Pt | [number, number]) => Pt;
  fromPixels: (pt: Pt | [number, number]) => Pt;
}

export interface TimeSpaceSnapshot<TState = any> {
  phase: string;
  globalTimeSec: number;
  localTimeSec: number;
  state: Readonly<TState>;
  geometry: {
    points: Pt[];
    groups: Group[];
    polygons: Polygon[];
    [key: string]: any;
  };
  buffers: {
    positions: Float32Array;
    indices?: Uint16Array | Uint32Array;
    colors?: Float32Array;
  };
  render: (ctx: ICanvasContext2D) => void;
}

export interface TimeSpaceMachineConfig<TState = any> {
  initialState?: TState;
  boundary?: TemporalBoundaryPolicy;
  speedMultiplier?: number;
  phases?: Record<string, PhaseDefinition<TState>>;
  tracks?: Record<string, TrackTemporalConfig>;
  setup?: (tl: gsap.core.Timeline, state: TState) => void;
  generateGeometry?: (
    state: TState,
    space: SpaceContext,
    time: { frame: number; fps: number; timeSec: number; seed: number; phase: string }
  ) => {
    points?: Pt[];
    groups?: Group[];
    polygons?: Polygon[];
    [key: string]: any;
  };
  render?: (snapshot: TimeSpaceSnapshot<TState>, ctx: ICanvasContext2D) => void;
}

/**
 * Pure mathematical boundary resolver.
 * Evaluates localTime against track/phase duration with zero boundary overflow.
 */
export function solveTemporalBoundary(
  timeSec: number,
  duration: number,
  boundary: TemporalBoundaryPolicy = 'clamp'
): number {
  if (duration <= 0) return 0;

  switch (boundary) {
    case 'once': {
      if (timeSec < 0) return 0;
      if (timeSec > duration) return duration;
      return timeSec;
    }
    case 'clamp': {
      return Math.max(0, Math.min(duration, timeSec));
    }
    case 'loop': {
      return ((timeSec % duration) + duration) % duration;
    }
    case 'pingpong': {
      const cycle = duration * 2;
      const m = ((timeSec % cycle) + cycle) % cycle;
      return m > duration ? cycle - m : m;
    }
    default:
      return Math.max(0, Math.min(duration, timeSec));
  }
}

/**
 * TimeSpaceStateMachine:
 * High-Level Spatio-Temporal State Machine.
 * GSAP controls virtual numerical Time; Pts computes geometric Space.
 * Render-agnostic: outputs numbers, geometric shapes, raw vertex buffers, or 2D canvas draws.
 */
export class TimeSpaceStateMachine<TState = any> {
  private config: TimeSpaceMachineConfig<TState>;
  private state: TState;
  private rootTimeline: gsap.core.Timeline;
  private phaseTimelines: Map<string, gsap.core.Timeline> = new Map();
  private trackTimelines: Map<string, gsap.core.Timeline> = new Map();

  constructor(config: TimeSpaceMachineConfig<TState>) {
    this.config = config;
    this.state = config.initialState ? { ...config.initialState } : ({} as TState);

    // Disable lag smoothing to prevent timing drift
    gsap.ticker.lagSmoothing(0);

    // Setup root paused timeline
    this.rootTimeline = gsap.timeline({ paused: true, autoRemoveChildren: false });
    if (this.config.setup) {
      this.config.setup(this.rootTimeline, this.state);
    }

    // Setup phase timelines sequentially on root timeline
    if (this.config.phases) {
      let phaseOffset = 0;
      for (const [phaseKey, phaseDef] of Object.entries(this.config.phases)) {
        const pTl = gsap.timeline({ autoRemoveChildren: false });
        if (phaseDef.setup) {
          phaseDef.setup(pTl, this.state);
        }
        this.phaseTimelines.set(phaseKey, pTl);
        this.rootTimeline.add(pTl, phaseOffset);
        phaseOffset += phaseDef.duration;
      }
    }

    // Setup multi-track timelines
    if (this.config.tracks) {
      for (const [trackKey, trackDef] of Object.entries(this.config.tracks)) {
        const tTl = gsap.timeline({ paused: true, autoRemoveChildren: false });
        if (trackDef.setup) {
          trackDef.setup(tTl, (this.state as any)[trackKey] || this.state);
        }
        this.trackTimelines.set(trackKey, tTl);
      }
    }
  }

  public getState(): Readonly<TState> {
    return this.state;
  }

  public getRootTimeline(): gsap.core.Timeline {
    return this.rootTimeline;
  }

  public getPhaseTimeline(phase: string): gsap.core.Timeline | undefined {
    return this.phaseTimelines.get(phase);
  }

  /**
   * Deterministically evaluates the machine at (frame, fps, seed, viewport).
   */
  public seek(
    frame: number,
    fps: number = 30,
    seed: number = 1337,
    viewport: { width: number; height: number } = { width: 1920, height: 1080 }
  ): TimeSpaceSnapshot<TState> {
    const validFps = Math.max(1, fps);
    const speed = this.config.speedMultiplier ?? 1.0;
    const globalTimeSec = (Math.max(0, frame) / validFps) * speed;

    let activePhase = 'default';
    let localTimeSec = globalTimeSec;

    // 1. Resolve Active Phase
    if (this.config.phases && Object.keys(this.config.phases).length > 0) {
      const phases = Object.entries(this.config.phases);
      const totalPhasesDuration = phases.reduce((acc, [, def]) => acc + def.duration, 0);

      const resolvedGlobalTime =
        totalPhasesDuration > 0
          ? solveTemporalBoundary(globalTimeSec, totalPhasesDuration, this.config.boundary ?? 'loop')
          : globalTimeSec;

      let accumulatedTime = 0;
      for (const [phaseKey, phaseDef] of phases) {
        if (resolvedGlobalTime >= accumulatedTime && resolvedGlobalTime < accumulatedTime + phaseDef.duration) {
          activePhase = phaseKey;
          localTimeSec = resolvedGlobalTime - accumulatedTime;
          break;
        }
        accumulatedTime += phaseDef.duration;
      }

      // If at exact boundary end, clamp to last phase
      if (activePhase === 'default' && phases.length > 0) {
        const last = phases[phases.length - 1];
        activePhase = last[0];
        localTimeSec = last[1].duration;
      }

      // Seek root timeline across sequential phases
      this.rootTimeline.seek(resolvedGlobalTime, false);
    } else {
      // Seek root timeline
      this.rootTimeline.seek(globalTimeSec, false);
    }

    // 2. Resolve Multi-Track Timelines
    if (this.config.tracks) {
      for (const [trackKey, trackDef] of Object.entries(this.config.tracks)) {
        const trackStart = trackDef.start ?? 0;
        const relativeTime = globalTimeSec - trackStart;
        const solvedTrackTime = solveTemporalBoundary(
          relativeTime,
          trackDef.duration,
          trackDef.boundary ?? 'loop'
        );
        const tTl = this.trackTimelines.get(trackKey);
        if (tTl) {
          tTl.seek(solvedTrackTime, false);
        }
      }
    }

    // 3. Create Aspect-Aware SpaceContext
    const w = viewport.width;
    const h = viewport.height;
    const center = new Pt(w / 2, h / 2);

    const space: SpaceContext = {
      width: w,
      height: h,
      aspectRatio: w / Math.max(1, h),
      center,
      toPixels: (pt: Pt | [number, number]) => {
        return new Pt(center[0] + pt[0] * (w / 2), center[1] + pt[1] * (h / 2));
      },
      fromPixels: (pt: Pt | [number, number]) => {
        return new Pt((pt[0] - center[0]) / (w / 2), (pt[1] - center[1]) / (h / 2));
      },
    };

    // 4. Generate Geometry
    let geomData: any = { points: [], groups: [], polygons: [] };
    if (this.config.generateGeometry) {
      geomData = this.config.generateGeometry(this.state, space, {
        frame,
        fps: validFps,
        timeSec: globalTimeSec,
        seed,
        phase: activePhase,
      });
    }

    const geometry = {
      points: geomData.points || [],
      groups: geomData.groups || [],
      polygons: geomData.polygons || [],
      ...geomData,
    };

    // 5. Generate Vertex Buffers for WebGL
    const allGeometry = [...geometry.points, ...geometry.groups, ...geometry.polygons];
    const positions = DeterministicPtsForm.toBuffer(allGeometry);

    const cleanState: any = {};
    for (const [k, v] of Object.entries(this.state as any)) {
      if (k !== '_gsap') {
        cleanState[k] = v;
      }
    }

    const snapshot: TimeSpaceSnapshot<TState> = {
      phase: activePhase,
      globalTimeSec,
      localTimeSec,
      state: Object.freeze(cleanState),
      geometry,
      buffers: {
        positions,
      },
      render: (ctx: ICanvasContext2D) => {
        if (this.config.render) {
          this.config.render(snapshot, ctx);
        } else {
          // Default fallback renderer
          const form = new DeterministicPtsForm(ctx);
          for (const poly of geometry.polygons) {
            form.polygon(poly, { stroke: '#00ffff', lineWidth: 2 });
          }
          for (const grp of geometry.groups) {
            form.line(grp, { stroke: '#ffffff', lineWidth: 1.5 });
          }
          for (const pt of geometry.points) {
            form.point(pt, 5, { fill: '#ff0055' });
          }
        }
      },
    };

    return snapshot;
  }
}

export function createTimeSpaceMachine<TState = any>(
  config: TimeSpaceMachineConfig<TState>
): TimeSpaceStateMachine<TState> {
  return new TimeSpaceStateMachine<TState>(config);
}
