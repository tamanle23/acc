/**
  * Simple 2D/3D Simplex & Curl Noise generator for vector fields.
  */

// Permutation table for noise calculation
const PERM = new Uint8Array(512);
const P = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
  8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
  35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
  134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
  55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,
  18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,
  250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,
  189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,
  172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
  228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,
  107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
];

for (let i = 0; i < 512; i++) {
  PERM[i] = P[i & 255];
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a);
}

function grad2d(hash: number, x: number, y: number): number {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export class SimplexNoise {
  static noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = PERM[PERM[X] + Y];
    const ab = PERM[PERM[X] + Y + 1];
    const ba = PERM[PERM[X + 1] + Y];
    const bb = PERM[PERM[X + 1] + Y + 1];

    const x1 = lerp(u, grad2d(aa, xf, yf), grad2d(ba, xf - 1, yf));
    const x2 = lerp(u, grad2d(ab, xf, yf - 1), grad2d(bb, xf - 1, yf - 1));

    return lerp(v, x1, x2);
  }

  static fBm2D(x: number, y: number, octaves: number = 4, persistence: number = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += SimplexNoise.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / maxValue;
  }
}

export class CurlNoise {
  private eps: number;

  constructor(eps: number = 0.001) {
    this.eps = eps;
  }

  /**
   * Computes 2D Curl noise (divergence-free vector field).
   * v_x = dPsi/dy, v_y = -dPsi/dx
   */
  getCurl2D(x: number, y: number, t: number = 0): { vx: number; vy: number } {
    const n1 = SimplexNoise.fBm2D(x, y + this.eps + t);
    const n2 = SimplexNoise.fBm2D(x, y - this.eps + t);
    const n3 = SimplexNoise.fBm2D(x + this.eps, y + t);
    const n4 = SimplexNoise.fBm2D(x - this.eps, y + t);

    const dPsi_dy = (n1 - n2) / (2 * this.eps);
    const dPsi_dx = (n3 - n4) / (2 * this.eps);

    return {
      vx: dPsi_dy,
      vy: -dPsi_dx
    };
  }
}
