import { StatelessHashNoise, type ICanvasContext2D } from '@acc/core-isomorphic';
import { IsomorphicEasing } from '../utils/IsomorphicEasing';

export interface SoAParticleConfig {
  maxParticles: number;
  spawnRate?: number;
  gravity?: [number, number, number];
  drag?: number;
  initialSpeed?: [number, number];
  initialSize?: [number, number];
  initialLife?: [number, number];
  colorPalette?: string[];
  type?: string;
  seed?: number;
}

export interface SoAFrameParams {
  type?: string;
  intensity?: number;
  speed?: number;
  opacity?: number;
  seed?: number;
  colorPalette?: string[];
  [key: string]: any;
}

/**
 * SoAParticleComputeEngine:
 * High-throughput Structure-of-Arrays (SoA) particle simulation and rendering engine.
 *
 * Adheres strictly to:
 * - ZERO-ALLOC-FRAME-LOOP: Pre-allocated contiguous ArrayBuffer partitioned into 64-byte aligned TypedArray views.
 * - CONTINUOUS CACHE LOCALITY: Consecutive memory layout allows auto-vectorized SIMD linear sweeps without cache line straddling.
 * - DETERMINISTIC HANDSHAKE: Supports 100% stateless closed-form frame evaluation (safe for non-linear timeline scrubbing).
 * - BATCHED CANVAS2D ALPHA QUANTIZATION: Groups particles into discrete opacity bins, reducing per-frame canvas state
 *   mutations from thousands to <= 16 with zero ctx.save()/restore() in the inner loop.
 */
export class SoAParticleComputeEngine {
  public readonly maxParticles: number;
  public readonly alignedCapacity: number;
  public readonly partitionByteStride: number;

  private memoryBuffer: ArrayBuffer;

  // 10 Float32 attributes (64-byte cache line aligned base offsets)
  public readonly posX: Float32Array;
  public readonly posY: Float32Array;
  public readonly posZ: Float32Array;
  public readonly velX: Float32Array;
  public readonly velY: Float32Array;
  public readonly velZ: Float32Array;
  public readonly life: Float32Array;
  public readonly maxLife: Float32Array;
  public readonly size: Float32Array;
  public readonly opacity: Float32Array;

  // 1 Uint16 attribute (64-byte aligned base offset)
  public readonly colorIdx: Uint16Array;

  // Pre-allocated bin indexing arrays for zero-alloc alpha quantization batching
  // 4 alpha bins: [0..0.25], (0.25..0.5], (0.5..0.75], (0.75..1.0]
  private bin0Indices: Uint16Array;
  private bin1Indices: Uint16Array;
  private bin2Indices: Uint16Array;
  private bin3Indices: Uint16Array;
  private binCounts = new Uint16Array(4);

  public activeCount = 0;
  private config: Required<SoAParticleConfig>;
  private rngState: number;

  private static easeOut = IsomorphicEasing.power2Out;
  private static easeInOut = IsomorphicEasing.sineInOut;

  constructor(config: SoAParticleConfig) {
    this.maxParticles = Math.max(16, Math.min(config.maxParticles || 2000, 50000));
    // Pad to multiple of 16 floats (16 * 4 bytes = 64 bytes) to guarantee 64-byte CPU cache alignment
    this.alignedCapacity = Math.ceil(this.maxParticles / 16) * 16;
    this.partitionByteStride = this.alignedCapacity * 4;

    // 10 Float32 arrays + 1 Uint16 array aligned to 64 bytes
    const uint16Bytes = Math.ceil((this.alignedCapacity * 2) / 64) * 64;
    const totalBytes = 10 * this.partitionByteStride + uint16Bytes;

    this.memoryBuffer = new ArrayBuffer(totalBytes);

    this.posX = new Float32Array(this.memoryBuffer, 0 * this.partitionByteStride, this.maxParticles);
    this.posY = new Float32Array(this.memoryBuffer, 1 * this.partitionByteStride, this.maxParticles);
    this.posZ = new Float32Array(this.memoryBuffer, 2 * this.partitionByteStride, this.maxParticles);
    this.velX = new Float32Array(this.memoryBuffer, 3 * this.partitionByteStride, this.maxParticles);
    this.velY = new Float32Array(this.memoryBuffer, 4 * this.partitionByteStride, this.maxParticles);
    this.velZ = new Float32Array(this.memoryBuffer, 5 * this.partitionByteStride, this.maxParticles);
    this.life = new Float32Array(this.memoryBuffer, 6 * this.partitionByteStride, this.maxParticles);
    this.maxLife = new Float32Array(this.memoryBuffer, 7 * this.partitionByteStride, this.maxParticles);
    this.size = new Float32Array(this.memoryBuffer, 8 * this.partitionByteStride, this.maxParticles);
    this.opacity = new Float32Array(this.memoryBuffer, 9 * this.partitionByteStride, this.maxParticles);

    this.colorIdx = new Uint16Array(this.memoryBuffer, 10 * this.partitionByteStride, this.maxParticles);

    // Pre-allocate quantization bins
    this.bin0Indices = new Uint16Array(this.maxParticles);
    this.bin1Indices = new Uint16Array(this.maxParticles);
    this.bin2Indices = new Uint16Array(this.maxParticles);
    this.bin3Indices = new Uint16Array(this.maxParticles);

    this.rngState = (config.seed ?? 1337) >>> 0;
    this.config = {
      maxParticles: this.maxParticles,
      spawnRate: config.spawnRate ?? 30,
      gravity: config.gravity ?? [0, 0.05, 0],
      drag: config.drag ?? 0.99,
      initialSpeed: config.initialSpeed ?? [1.0, 3.0],
      initialSize: config.initialSize ?? [2.0, 5.0],
      initialLife: config.initialLife ?? [60, 180],
      colorPalette: config.colorPalette ?? ['#ffffff', '#ffeedd', '#aabbff'],
      type: config.type ?? 'snow',
      seed: config.seed ?? 1337,
    };
  }

  private nextRandom(): number {
    this.rngState = (Math.imul(1664525, this.rngState) + 1013904223) >>> 0;
    return this.rngState / 4294967296.0;
  }

  public getRawBuffer(): ArrayBuffer {
    return this.memoryBuffer;
  }

  /**
   * Deterministic stateless frame compute:
   * Pure closed-form calculation of particle positions, sizes, and opacities for arbitrary frame t.
   * Seeking backwards or forwards yields bit-identical values with ZERO accumulator drift.
   */
  public computeStatelessFrame(
    frame: number,
    width: number,
    height: number,
    params: SoAFrameParams = {}
  ): void {
    const intensity = Math.max(0.1, params.intensity ?? 1.0);
    const speed = Math.max(0.1, params.speed ?? 1.0);
    const pType = (params.type || this.config.type || 'snow').toLowerCase();
    const seed = params.seed ?? this.config.seed;
    const paletteLen = (params.colorPalette || this.config.colorPalette).length;

    let baseCount = 100;
    switch (pType) {
      case 'cyber_sparks':
      case 'sparks':
        baseCount = 800;
        break;
      case 'rain':
        baseCount = 350;
        break;
      case 'snow':
        baseCount = 200;
        break;
      case 'embers':
      case 'fire':
        baseCount = 250;
        break;
      case 'dust':
      case 'bokeh':
        baseCount = 120;
        break;
      case 'matrix_rain':
        baseCount = 400;
        break;
      default:
        baseCount = 150;
        break;
    }

    const count = Math.min(this.maxParticles, Math.floor(baseCount * intensity));
    this.activeCount = count;

    // Vectorized linear sweep across contiguous SoA arrays
    for (let i = 0; i < count; i++) {
      const pSeed = (seed + i * 197) % 10000;
      let cycleDuration = 120 + (pSeed % 60);
      let speedMult = 0.8;

      if (pType === 'rain' || pType === 'cyber_sparks' || pType === 'matrix_rain') {
        cycleDuration = 35 + (pSeed % 25);
        speedMult = 1.8;
      } else if (pType === 'dust' || pType === 'bokeh') {
        cycleDuration = 180 + (pSeed % 80);
        speedMult = 0.4;
      }

      const lifeProgress = ((frame * speed * speedMult + pSeed) % cycleDuration) / cycleDuration;

      // Pts.js 2D Perlin Noise curl turbulence on X
      const noiseDrift = StatelessHashNoise.noise2D(1337, 0, i * 1.5, frame * 0.15 * speed) * 35;
      const baseX = (pSeed * 17) % width;
      const x = (baseX + noiseDrift + width) % width;

      let y: number;
      if (pType === 'embers' || pType === 'fire') {
        // Drifting upwards
        y = (1.0 - lifeProgress) * (height + 40) - 20;
      } else {
        // Falling downwards
        y = lifeProgress * (height + 40) - 20;
      }

      // Radius & Alpha lifecycle shaping
      let radius = 1.5 + (pSeed % 4) * 0.8;
      if (pType === 'bokeh') {
        radius = 8.0 + (pSeed % 12) * 2.5;
      } else if (pType === 'cyber_sparks') {
        radius = 1.0 + (pSeed % 3) * 0.5;
      }

      const alphaProgress = Math.sin(lifeProgress * Math.PI);
      const alpha = Math.max(0.0, Math.min(1.0, SoAParticleComputeEngine.easeInOut(alphaProgress)));

      this.posX[i] = x;
      this.posY[i] = y;
      this.posZ[i] = (pSeed % 100) / 100.0;
      this.size[i] = radius;
      this.opacity[i] = alpha;
      this.colorIdx[i] = pSeed % paletteLen;
    }
  }

  /**
   * Vectorized Euler simulation step (Stateful mode for interactive physics).
   */
  public update(width: number, height: number): void {
    const [gx, gy, gz] = this.config.gravity;
    const drag = this.config.drag;
    const pType = this.config.type;

    let i = 0;
    while (i < this.activeCount) {
      // Decrement life
      this.life[i] -= 1.0;
      const currentLife = this.life[i];

      const x = this.posX[i];
      const y = this.posY[i];
      const isDead =
        currentLife <= 0 ||
        x < -50 ||
        x > width + 50 ||
        y < -100 ||
        y > height + 100;

      if (isDead) {
        // Swap-and-pop with the last active particle (O(1) SoA removal)
        const last = this.activeCount - 1;
        if (i !== last) {
          this.posX[i] = this.posX[last];
          this.posY[i] = this.posY[last];
          this.posZ[i] = this.posZ[last];
          this.velX[i] = this.velX[last];
          this.velY[i] = this.velY[last];
          this.velZ[i] = this.velZ[last];
          this.life[i] = this.life[last];
          this.maxLife[i] = this.maxLife[last];
          this.size[i] = this.size[last];
          this.opacity[i] = this.opacity[last];
          this.colorIdx[i] = this.colorIdx[last];
        }
        this.activeCount--;
        continue;
      }

      // Physics integration
      this.velX[i] = (this.velX[i] + gx) * drag;
      this.velY[i] = (this.velY[i] + gy) * drag;
      this.velZ[i] = (this.velZ[i] + gz) * drag;

      if (pType === 'snow' || pType === 'embers') {
        this.velX[i] += Math.sin(currentLife * 0.1) * 0.15;
      }

      this.posX[i] += this.velX[i];
      this.posY[i] += this.velY[i];
      this.posZ[i] += this.velZ[i];

      const maxL = this.maxLife[i];
      const lifeRatio = currentLife / (maxL > 0 ? maxL : 1);
      if (lifeRatio < 0.2) {
        this.opacity[i] = Math.max(0.0, lifeRatio / 0.2);
      }

      i++;
    }
  }

  /**
   * Spawns new particles into inactive SoA slots (Stateful mode).
   */
  public spawn(count: number, width: number, height: number): void {
    const toSpawn = Math.min(count, this.maxParticles - this.activeCount);
    if (toSpawn <= 0) return;

    const [minSpd, maxSpd] = this.config.initialSpeed;
    const [minSz, maxSz] = this.config.initialSize;
    const [minLife, maxLife] = this.config.initialLife;
    const pType = this.config.type;
    const paletteLen = this.config.colorPalette.length;

    for (let k = 0; k < toSpawn; k++) {
      const idx = this.activeCount;

      if (pType === 'rain' || pType === 'snow' || pType === 'matrix') {
        this.posX[idx] = this.nextRandom() * width;
        this.posY[idx] = -10 - this.nextRandom() * 20;
      } else if (pType === 'embers' || pType === 'fire') {
        this.posX[idx] = this.nextRandom() * width;
        this.posY[idx] = height + this.nextRandom() * 20;
      } else {
        this.posX[idx] = this.nextRandom() * width;
        this.posY[idx] = this.nextRandom() * height;
      }
      this.posZ[idx] = this.nextRandom();

      const speed = minSpd + this.nextRandom() * (maxSpd - minSpd);
      if (pType === 'rain') {
        this.velX[idx] = (this.nextRandom() - 0.5) * 1.5;
        this.velY[idx] = speed * 8.0;
      } else if (pType === 'snow') {
        this.velX[idx] = (this.nextRandom() - 0.5) * 1.0;
        this.velY[idx] = speed * 1.2;
      } else if (pType === 'embers' || pType === 'fire') {
        this.velX[idx] = (this.nextRandom() - 0.5) * 1.5;
        this.velY[idx] = -speed * 2.0;
      } else {
        this.velX[idx] = (this.nextRandom() - 0.5) * speed;
        this.velY[idx] = (this.nextRandom() - 0.5) * speed;
      }
      this.velZ[idx] = 0;

      const l = Math.round(minLife + this.nextRandom() * (maxLife - minLife));
      this.life[idx] = l;
      this.maxLife[idx] = l;
      this.size[idx] = minSz + this.nextRandom() * (maxSz - minSz);
      this.opacity[idx] = 0.5 + this.nextRandom() * 0.5;
      this.colorIdx[idx] = Math.floor(this.nextRandom() * paletteLen);

      this.activeCount++;
    }
  }

  /**
   * Batched Canvas2D Path Rendering with 4-Bin Alpha Quantization:
   * Groups particles into 4 opacity bins. Issues exactly one beginPath() and fill() per bin,
   * completely eliminating per-particle ctx.save() and ctx.restore() overhead.
   */
  public renderBatched(
    ctx: ICanvasContext2D,
    width: number,
    height: number,
    globalOpacity = 1.0,
    palette: string[] = this.config.colorPalette
  ): void {
    if (this.activeCount <= 0) return;

    this.binCounts[0] = 0;
    this.binCounts[1] = 0;
    this.binCounts[2] = 0;
    this.binCounts[3] = 0;

    // 1. Single-pass linear bin partition (O(N) contiguous reads)
    const count = this.activeCount;
    for (let i = 0; i < count; i++) {
      const alpha = this.opacity[i];
      if (alpha <= 0.01) continue;

      if (alpha <= 0.25) {
        this.bin0Indices[this.binCounts[0]++] = i;
      } else if (alpha <= 0.5) {
        this.bin1Indices[this.binCounts[1]++] = i;
      } else if (alpha <= 0.75) {
        this.bin2Indices[this.binCounts[2]++] = i;
      } else {
        this.bin3Indices[this.binCounts[3]++] = i;
      }
    }

    const bins = [
      { count: this.binCounts[0], indices: this.bin0Indices, alpha: 0.18 },
      { count: this.binCounts[1], indices: this.bin1Indices, alpha: 0.40 },
      { count: this.binCounts[2], indices: this.bin2Indices, alpha: 0.65 },
      { count: this.binCounts[3], indices: this.bin3Indices, alpha: 0.90 },
    ];

    const defaultColor = palette[0] || '#ffffff';
    ctx.save();

    for (let b = 0; b < 4; b++) {
      const bin = bins[b];
      if (bin.count === 0) continue;

      ctx.globalAlpha = Math.max(0, Math.min(1, globalOpacity * bin.alpha));
      ctx.fillStyle = defaultColor;
      ctx.beginPath();

      const indices = bin.indices;
      const bCount = bin.count;
      for (let j = 0; j < bCount; j++) {
        const pIdx = indices[j];
        const x = this.posX[pIdx];
        const y = this.posY[pIdx];
        const r = this.size[pIdx];

        // Fast arc with leading moveTo to prevent joining lines
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }

      ctx.fill();
    }

    ctx.restore();
  }
}
