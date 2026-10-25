import { createTimeSpaceMachine, TimeSpaceStateMachine } from '@acc/core-isomorphic';

export interface SpringConfig {
  stiffness: number; // k (e.g. 180)
  damping: number; // c (e.g. 12)
  mass: number; // m (e.g. 1.0)
}

export interface SpringState {
  value: number;
  velocity: number;
}

export interface KineticTitleOptions {
  enterDuration?: number;
  idleDuration?: number;
  exitDuration?: number;
  fontSize?: number;
  fontColor?: string;
}

export class KineticTypography {
  public static solveSpringFrame(
    currentState: SpringState,
    targetValue: number,
    deltaTimeSeconds: number,
    config: SpringConfig = { stiffness: 180, damping: 12, mass: 1.0 }
  ): SpringState {
    const springForce = -config.stiffness * (currentState.value - targetValue);
    const dampingForce = -config.damping * currentState.velocity;
    const acceleration = (springForce + dampingForce) / config.mass;

    const newVelocity = currentState.velocity + acceleration * deltaTimeSeconds;
    const newValue = currentState.value + newVelocity * deltaTimeSeconds;

    return {
      value: newValue,
      velocity: newVelocity,
    };
  }

  public static generatePopInSequence(
    totalFrames: number,
    fps = 30,
    config: SpringConfig = { stiffness: 220, damping: 14, mass: 1.0 }
  ): number[] {
    let state: SpringState = { value: 0.0, velocity: 0.0 };
    const dt = 1.0 / fps;
    const scales: number[] = [0.0]; // Frame 0 starts at scale 0.0

    for (let f = 1; f < totalFrames; f++) {
      state = this.solveSpringFrame(state, 1.0, dt, config);
      scales.push(Number(state.value.toFixed(3)));
    }

    return scales;
  }

  /**
   * Creates a deterministic TimeSpaceStateMachine for kinetic typography titles.
   */
  public static createTitleMachine(
    text: string,
    options: KineticTitleOptions = {}
  ): TimeSpaceStateMachine {
    const enterDuration = options.enterDuration ?? 0.6;
    const idleDuration = options.idleDuration ?? 2.5;
    const exitDuration = options.exitDuration ?? 0.4;
    const fontSize = options.fontSize ?? 48;
    const fontColor = options.fontColor ?? '#ffffff';

    return createTimeSpaceMachine({
      initialState: {
        scale: 0,
        opacity: 0,
        yOffset: 40,
        letterSpacing: 2,
      },
      phases: {
        enter: {
          duration: enterDuration,
          setup: (tl, state) => {
            tl.to(state, {
              scale: 1,
              opacity: 1,
              yOffset: 0,
              duration: enterDuration,
              ease: 'elastic.out(1, 0.75)',
            });
          },
        },
        idle: {
          duration: idleDuration,
          setup: (tl, state) => {
            tl.to(state, {
              scale: 1.03,
              duration: idleDuration / 2,
              yoyo: true,
              repeat: -1,
              ease: 'sine.inOut',
            });
          },
        },
        exit: {
          duration: exitDuration,
          setup: (tl, state) => {
            tl.to(state, {
              scale: 0.8,
              opacity: 0,
              yOffset: -30,
              duration: exitDuration,
              ease: 'power2.in',
            });
          },
        },
      },
      generateGeometry: (state, space) => {
        return {
          points: [space.center],
          groups: [],
          polygons: [],
          meta: {
            text,
            scale: state.scale,
            opacity: state.opacity,
            yOffset: state.yOffset,
            fontSize,
            fontColor,
          },
        };
      },
      render: (snapshot, ctx) => {
        const meta = snapshot.geometry.meta;
        if (!meta || meta.opacity <= 0.001) return;

        ctx.save();
        ctx.globalAlpha = meta.opacity;
        ctx.font = `bold ${meta.fontSize}px sans-serif`;
        ctx.fillStyle = meta.fontColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 10;

        const center = snapshot.geometry.points[0] || [0, 0];
        ctx.translate(center[0], center[1] + meta.yOffset);
        ctx.scale(meta.scale, meta.scale);
        ctx.fillText(meta.text, 0, 0);
        ctx.restore();
      },
    });
  }
}
