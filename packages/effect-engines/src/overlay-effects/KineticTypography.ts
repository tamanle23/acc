export interface SpringConfig {
  stiffness: number; // k (e.g. 180)
  damping: number; // c (e.g. 12)
  mass: number; // m (e.g. 1.0)
}

export interface SpringState {
  value: number;
  velocity: number;
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
}
