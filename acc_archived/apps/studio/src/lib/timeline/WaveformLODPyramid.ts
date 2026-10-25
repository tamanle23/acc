/**
 * WaveformLODPyramid:
 * Multi-resolution audio waveform peak pyramid (LOD) based on zoom scale (px/frame or px/ms).
 * Level 0: 1:1 original peak samples (high zoom)
 * Level 1: 4:1 downsampled peaks
 * Level 2: 16:1 downsampled peaks
 * Level 3: 64:1 downsampled peaks
 *
 * Guarantees constant O(1) bar computation and zero GC thrashing during timeline scrubbing/zooming.
 */
export class WaveformLODPyramid {
  private levels: Float32Array[] = [];

  constructor(rawPeaks: Float32Array | number[]) {
    this.buildPyramid(rawPeaks instanceof Float32Array ? rawPeaks : new Float32Array(rawPeaks));
  }

  private buildPyramid(basePeaks: Float32Array): void {
    this.levels = [basePeaks];

    let current = basePeaks;
    for (let l = 1; l <= 3; l++) {
      const nextLength = Math.max(2, Math.floor(current.length / 4));
      const nextLevel = new Float32Array(nextLength);
      const factor = current.length / nextLength;

      for (let i = 0; i < nextLength; i++) {
        const start = Math.floor(i * factor);
        const end = Math.min(current.length, Math.floor((i + 1) * factor));
        let maxPeak = 0;
        for (let j = start; j < end; j++) {
          if (current[j] > maxPeak) maxPeak = current[j];
        }
        nextLevel[i] = maxPeak;
      }

      this.levels.push(nextLevel);
      current = nextLevel;
    }
  }

  public getLevelsCount(): number {
    return this.levels.length;
  }

  /**
   * Selects the appropriate LOD level given total available pixels and duration frames.
   */
  public selectLOD(pixelsPerFrame: number): { levelIndex: number; peaks: Float32Array } {
    if (pixelsPerFrame >= 4.0) {
      return { levelIndex: 0, peaks: this.levels[0] };
    } else if (pixelsPerFrame >= 1.0) {
      return { levelIndex: 1, peaks: this.levels[1] };
    } else if (pixelsPerFrame >= 0.25) {
      return { levelIndex: 2, peaks: this.levels[2] };
    } else {
      return { levelIndex: 3, peaks: this.levels[3] };
    }
  }

  public getPeaksAtLevel(levelIndex: number): Float32Array {
    const idx = Math.max(0, Math.min(this.levels.length - 1, levelIndex));
    return this.levels[idx];
  }
}
