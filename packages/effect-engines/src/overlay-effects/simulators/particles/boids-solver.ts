import { Particle, ParticlePool } from './particle-pool';

export interface BoidsConfig {
  perceptionRadius: number;
  maxSpeed: number;
  maxForce: number;
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;
}

export class BoidsSolver {
  private config: BoidsConfig;

  constructor(config?: Partial<BoidsConfig>) {
    this.config = {
      perceptionRadius: 50,
      maxSpeed: 150,
      maxForce: 100,
      separationWeight: 1.5,
      alignmentWeight: 1.0,
      cohesionWeight: 1.0,
      ...config
    };
  }

  update(pool: ParticlePool, dt: number, width: number, height: number): void {
    const particles = pool.getActiveParticles();
    const count = particles.length;
    const r2 = this.config.perceptionRadius * this.config.perceptionRadius;

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      let sepX = 0, sepY = 0, sepCount = 0;
      let alignVx = 0, alignVy = 0, alignCount = 0;
      let cohX = 0, cohY = 0, cohCount = 0;

      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const other = particles[j];
        const dx = p.x - other.x;
        const dy = p.y - other.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > 0 && distSq < r2) {
          const dist = Math.sqrt(distSq);
          // Separation: inverse distance force
          sepX += (dx / dist) / dist;
          sepY += (dy / dist) / dist;
          sepCount++;

          // Alignment: sum neighbor velocities
          alignVx += other.vx;
          alignVy += other.vy;
          alignCount++;

          // Cohesion: sum neighbor positions
          cohX += other.x;
          cohY += other.y;
          cohCount++;
        }
      }

      let steeringAx = 0;
      let steeringAy = 0;

      // Separation force
      if (sepCount > 0) {
        sepX /= sepCount;
        sepY /= sepCount;
        const mag = Math.hypot(sepX, sepY);
        if (mag > 0) {
          sepX = (sepX / mag) * this.config.maxSpeed - p.vx;
          sepY = (sepY / mag) * this.config.maxSpeed - p.vy;
        }
        steeringAx += sepX * this.config.separationWeight;
        steeringAy += sepY * this.config.separationWeight;
      }

      // Alignment force
      if (alignCount > 0) {
        alignVx /= alignCount;
        alignVy /= alignCount;
        const mag = Math.hypot(alignVx, alignVy);
        if (mag > 0) {
          alignVx = (alignVx / mag) * this.config.maxSpeed - p.vx;
          alignVy = (alignVy / mag) * this.config.maxSpeed - p.vy;
        }
        steeringAx += alignVx * this.config.alignmentWeight;
        steeringAy += alignVy * this.config.alignmentWeight;
      }

      // Cohesion force
      if (cohCount > 0) {
        cohX = (cohX / cohCount) - p.x;
        cohY = (cohY / cohCount) - p.y;
        const mag = Math.hypot(cohX, cohY);
        if (mag > 0) {
          cohX = (cohX / mag) * this.config.maxSpeed - p.vx;
          cohY = (cohY / mag) * this.config.maxSpeed - p.vy;
        }
        steeringAx += cohX * this.config.cohesionWeight;
        steeringAy += cohY * this.config.cohesionWeight;
      }

      // Limit max steering force
      const steerMag = Math.hypot(steeringAx, steeringAy);
      if (steerMag > this.config.maxForce) {
        steeringAx = (steeringAx / steerMag) * this.config.maxForce;
        steeringAy = (steeringAy / steerMag) * this.config.maxForce;
      }

      // Apply acceleration to velocity
      p.vx += steeringAx * dt;
      p.vy += steeringAy * dt;

      // Limit max speed
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > this.config.maxSpeed) {
        p.vx = (p.vx / speed) * this.config.maxSpeed;
        p.vy = (p.vy / speed) * this.config.maxSpeed;
      }

      // Kinematic update
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Wrap around bounds
      p.x = ((p.x % width) + width) % width;
      p.y = ((p.y % height) + height) % height;
    }
  }
}
