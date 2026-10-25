import { describe, expect, it, beforeAll } from 'bun:test';
import path from 'path';
import fs from 'fs';
import { FFmpegManager } from '../packages/core/src/FFmpegManager';
import { getMediaDurationFFI } from '../packages/core/src/ffmpeg-ffi';

describe('Sample Story Output Verification', () => {
  beforeAll(async () => {
    await FFmpegManager.prepare();
  });

  it('should verify the rendered Dinosaur Story output file duration and size', () => {
    const outputDir = path.resolve('sample-story/output');
    const mp4Files = fs.readdirSync(outputDir)
      .filter(f => f.startsWith('Dinosaur_Story_') && f.endsWith('.mp4'))
      .map(f => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    expect(mp4Files.length).toBeGreaterThan(0);
    const latestFile = path.join(outputDir, mp4Files[0].name);
    console.log(`Checking latest output video: ${latestFile}`);

    const size = fs.statSync(latestFile).size;
    expect(size).toBeGreaterThan(1000000); // > 1MB

    const duration = getMediaDurationFFI(latestFile);
    console.log(`Rendered Video Duration: ${duration.toFixed(2)}s, Size: ${(size / 1024 / 1024).toFixed(2)}MB`);
    // Duration matches exact story length (92.6s audio + 27 * (1s transition + 1s pause) ≈ 147.67s), NOT 9 hours (32821s)
    expect(duration).toBeGreaterThan(140);
    expect(duration).toBeLessThan(155);
  });
});
