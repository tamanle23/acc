/**
 * 2D Eulerian Fluid Grid Solver (Navier-Stokes Density & Velocity Advection)
 */

export class Grid2DSolver {
  readonly width: number;
  readonly height: number;
  private size: number;
  private dt: number;
  private diff: number;
  private visc: number;

  private s: Float32Array;
  private density: Float32Array;
  private Vx: Float32Array;
  private Vy: Float32Array;
  private Vx0: Float32Array;
  private Vy0: Float32Array;

  constructor(cols: number, rows: number, dt: number = 0.1, diffusion: number = 0.0001, viscosity: number = 0.0001) {
    this.width = cols;
    this.height = rows;
    this.size = cols * rows;
    this.dt = dt;
    this.diff = diffusion;
    this.visc = viscosity;

    this.s = new Float32Array(this.size);
    this.density = new Float32Array(this.size);
    this.Vx = new Float32Array(this.size);
    this.Vy = new Float32Array(this.size);
    this.Vx0 = new Float32Array(this.size);
    this.Vy0 = new Float32Array(this.size);
  }

  private IX(x: number, y: number): number {
    const clampedX = Math.max(0, Math.min(this.width - 1, Math.floor(x)));
    const clampedY = Math.max(0, Math.min(this.height - 1, Math.floor(y)));
    return clampedX + clampedY * this.width;
  }

  addDensity(x: number, y: number, amount: number): void {
    const index = this.IX(x, y);
    this.density[index] += amount;
  }

  addVelocity(x: number, y: number, amountX: number, amountY: number): void {
    const index = this.IX(x, y);
    this.Vx[index] += amountX;
    this.Vy[index] += amountY;
  }

  step(): void {
    // Diffuse & Advect Velocity
    this.diffuse(1, this.Vx0, this.Vx, this.visc);
    this.diffuse(2, this.Vy0, this.Vy, this.visc);

    this.project(this.Vx0, this.Vy0, this.Vx, this.Vy);

    this.advect(1, this.Vx, this.Vx0, this.Vx0, this.Vy0);
    this.advect(2, this.Vy, this.Vy0, this.Vx0, this.Vy0);

    this.project(this.Vx, this.Vy, this.Vx0, this.Vy0);

    // Diffuse & Advect Density
    this.diffuse(0, this.s, this.density, this.diff);
    this.advect(0, this.density, this.s, this.Vx, this.Vy);
  }

  private diffuse(b: number, x: Float32Array, x0: Float32Array, diff: number): void {
    const a = this.dt * diff * (this.width - 2) * (this.height - 2);
    this.lin_solve(b, x, x0, a, 1 + 6 * a);
  }

  private lin_solve(b: number, x: Float32Array, x0: Float32Array, a: number, c: number): void {
    const cRecip = 1.0 / c;
    for (let k = 0; k < 4; k++) {
      for (let j = 1; j < this.height - 1; j++) {
        for (let i = 1; i < this.width - 1; i++) {
          x[this.IX(i, j)] =
            (x0[this.IX(i, j)] +
              a *
                (x[this.IX(i + 1, j)] +
                  x[this.IX(i - 1, j)] +
                  x[this.IX(i, j + 1)] +
                  x[this.IX(i, j - 1)])) *
            cRecip;
        }
      }
    }
  }

  private project(velocX: Float32Array, velocY: Float32Array, p: Float32Array, div: Float32Array): void {
    for (let j = 1; j < this.height - 1; j++) {
      for (let i = 1; i < this.width - 1; i++) {
        div[this.IX(i, j)] =
          (-0.5 *
            (velocX[this.IX(i + 1, j)] -
              velocX[this.IX(i - 1, j)] +
              velocY[this.IX(i, j + 1)] -
              velocY[this.IX(i, j - 1)])) /
          this.width;
        p[this.IX(i, j)] = 0;
      }
    }

    this.lin_solve(0, p, div, 1, 6);

    for (let j = 1; j < this.height - 1; j++) {
      for (let i = 1; i < this.width - 1; i++) {
        velocX[this.IX(i, j)] -= 0.5 * (p[this.IX(i + 1, j)] - p[this.IX(i - 1, j)]) * this.width;
        velocY[this.IX(i, j)] -= 0.5 * (p[this.IX(i, j + 1)] - p[this.IX(i, j - 1)]) * this.height;
      }
    }
  }

  private advect(b: number, d: Float32Array, d0: Float32Array, velocX: Float32Array, velocY: Float32Array): void {
    const dt0 = this.dt * (this.width - 2);

    for (let j = 1; j < this.height - 1; j++) {
      for (let i = 1; i < this.width - 1; i++) {
        let x = i - dt0 * velocX[this.IX(i, j)];
        let y = j - dt0 * velocY[this.IX(i, j)];

        if (x < 0.5) x = 0.5;
        if (x > this.width - 1.5) x = this.width - 1.5;
        const i0 = Math.floor(x);
        const i1 = i0 + 1;

        if (y < 0.5) y = 0.5;
        if (y > this.height - 1.5) y = this.height - 1.5;
        const j0 = Math.floor(y);
        const j1 = j0 + 1;

        const s1 = x - i0;
        const s0 = 1 - s1;
        const t1 = y - j0;
        const t0 = 1 - t1;

        d[this.IX(i, j)] =
          s0 * (t0 * d0[this.IX(i0, j0)] + t1 * d0[this.IX(i0, j1)]) +
          s1 * (t0 * d0[this.IX(i1, j0)] + t1 * d0[this.IX(i1, j1)]);
      }
    }
  }

  getDensityGrid(): Float32Array {
    return this.density;
  }

  getDensityAt(x: number, y: number): number {
    return this.density[this.IX(x, y)];
  }
}
