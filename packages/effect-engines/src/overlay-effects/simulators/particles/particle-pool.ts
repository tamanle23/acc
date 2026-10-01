export interface Particle {
  id: number;
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ax: number;
  ay: number;
  az: number;
  size: number;
  mass: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  vRot: number;
  customData: Record<string, any>;
}

export class ParticlePool {
  private pool: Particle[];
  private activeCount: number = 0;

  constructor(capacity: number) {
    this.pool = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.pool[i] = this.createEmptyParticle(i);
    }
  }

  private createEmptyParticle(id: number): Particle {
    return {
      id,
      active: false,
      x: 0,
      y: 0,
      z: 1,
      vx: 0,
      vy: 0,
      vz: 0,
      ax: 0,
      ay: 0,
      az: 0,
      size: 1,
      mass: 1,
      color: '#ffffff',
      alpha: 1,
      life: 0,
      maxLife: 1,
      rotation: 0,
      vRot: 0,
      customData: {}
    };
  }

  spawn(initialProps: Partial<Particle>): Particle | null {
    if (this.activeCount >= this.pool.length) {
      return null; // Pool exhausted
    }
    const particle = this.pool[this.activeCount];
    particle.active = true;
    particle.x = initialProps.x ?? 0;
    particle.y = initialProps.y ?? 0;
    particle.z = initialProps.z ?? 1;
    particle.vx = initialProps.vx ?? 0;
    particle.vy = initialProps.vy ?? 0;
    particle.vz = initialProps.vz ?? 0;
    particle.ax = initialProps.ax ?? 0;
    particle.ay = initialProps.ay ?? 0;
    particle.az = initialProps.az ?? 0;
    particle.size = initialProps.size ?? 1;
    particle.mass = initialProps.mass ?? 1;
    particle.color = initialProps.color ?? '#ffffff';
    particle.alpha = initialProps.alpha ?? 1;
    particle.life = initialProps.life ?? 0;
    particle.maxLife = initialProps.maxLife ?? 1;
    particle.rotation = initialProps.rotation ?? 0;
    particle.vRot = initialProps.vRot ?? 0;
    particle.customData = initialProps.customData ? { ...initialProps.customData } : {};

    this.activeCount++;
    return particle;
  }

  release(index: number): void {
    if (index < 0 || index >= this.activeCount) return;
    const pToRelease = this.pool[index];
    pToRelease.active = false;

    // Swap with last active particle
    const lastActiveIndex = this.activeCount - 1;
    if (index !== lastActiveIndex) {
      this.pool[index] = this.pool[lastActiveIndex];
      this.pool[lastActiveIndex] = pToRelease;
    }
    this.activeCount--;
  }

  getActiveParticles(): Particle[] {
    return this.pool.slice(0, this.activeCount);
  }

  get ActiveCount(): number {
    return this.activeCount;
  }

  get Capacity(): number {
    return this.pool.length;
  }

  clear(): void {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
    this.activeCount = 0;
  }
}
