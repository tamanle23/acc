/**
 * DeterministicNoiseGenerator:
 * Generates frame-indexed, stateless pseudo-random noise vectors.
 * Given identical seed and frame integer t, outputs bit-identical float values.
 */
export class DeterministicNoiseGenerator {
  private permutation: Uint8Array;

  constructor(seed: number = 1337) {
    this.permutation = this.generatePermutationTable(seed);
  }

  private generatePermutationTable(seed: number): Uint8Array {
    const table = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      table[i] = i;
    }
    // Deterministic LCG shuffle
    let state = seed >>> 0;
    for (let i = 255; i > 0; i--) {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      const j = state % (i + 1);
      const tmp = table[i];
      table[i] = table[j];
      table[j] = tmp;
    }
    return table;
  }

  /**
   * Trigonometric hash parameterized by UV coordinates and integer frame t
   */
  public hash2D(u: number, v: number, frame: number): number {
    const t = frame;
    const dot = u * 12.9898 + v * 78.233 + t * 43.123;
    const sin = Math.sin(dot) * 43758.5453123;
    return sin - Math.floor(sin);
  }

  /**
   * Deterministic 1D noise for camera shake displacement
   */
  public sample1D(frame: number, octave: number = 1, frequency: number = 1.0): number {
    const coord = frame * frequency + octave * 100.0;
    const i = Math.floor(coord) & 255;
    const f = coord - Math.floor(coord);
    const u = f * f * (3.0 - 2.0 * f); // Smoothstep

    const g0 = (this.permutation[i] % 16) / 8.0 - 1.0;
    const g1 = (this.permutation[(i + 1) & 255] % 16) / 8.0 - 1.0;

    return (1.0 - u) * g0 + u * g1;
  }
}
