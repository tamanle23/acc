import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  GenerativeAIFacade,
  VoiceIsolationCloningStrategy,
  TextBasedEditingEngine,
  ProxyAssetManager,
  CleanPlateEngine,
  MatchmoveVisionFacade,
  EditingEngineFacade,
} from '@acc/core';

describe('Stub Elimination & Production Facades Parity Suite', () => {
  it('GenerativeAIFacade generates concrete valid MP4 files with 0 null-byte stubs', async () => {
    const testDir = path.join(os.tmpdir(), 'acc_test_broll');
    const assetPath = await GenerativeAIFacade.generateBrollAsset({
      prompt: 'A cyberpunk city with neon reflections',
      durationMs: 3000,
      outputDir: testDir,
    });

    expect(fs.existsSync(assetPath)).toBe(true);
    const buf = await fs.promises.readFile(assetPath);

    // Assert file is NOT 1KB of null bytes
    expect(buf.length).toBeGreaterThan(0);
    const isAllNullBytes = buf.every((byte) => byte === 0x00);
    expect(isAllNullBytes).toBe(false);

    // Verify valid MP4 ftyp atom header
    const ftypHeader = buf.toString('ascii', 4, 8);
    expect(ftypHeader).toBe('ftyp');

    // Clean up
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  it('VoiceIsolationCloningStrategy produces valid WAV audio files with 0 null-byte stubs', async () => {
    const testDir = path.join(os.tmpdir(), 'acc_test_audio');
    const audioPath = await VoiceIsolationCloningStrategy.synthesizeClonedVoice({
      referenceAudioPath: '/path/to/ref.wav',
      targetText: 'Xin chao Viet Nam',
      language: 'vi',
      outputDir: testDir,
    });

    expect(fs.existsSync(audioPath)).toBe(true);
    const buf = await fs.promises.readFile(audioPath);

    // Assert file is NOT 1KB of null bytes
    expect(buf.length).toBeGreaterThan(44);
    const isAllNullBytes = buf.every((byte) => byte === 0x00);
    expect(isAllNullBytes).toBe(false);

    // Verify valid RIFF/WAVE header
    const riff = buf.toString('ascii', 0, 4);
    const wave = buf.toString('ascii', 8, 12);
    expect(riff).toBe('RIFF');
    expect(wave).toBe('WAVE');

    // Clean up
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  it('TextBasedEditingEngine calculates true cut ranges and ripples sequences without semantic inversion', () => {
    const tokens = [
      { word: 'Hello', startMs: 0, endMs: 500, deleted: false },
      { word: 'um', startMs: 550, endMs: 800, deleted: true },
      { word: 'world', startMs: 850, endMs: 1200, deleted: false },
      { word: 'like', startMs: 1250, endMs: 1500, deleted: true },
      { word: 'today', startMs: 1550, endMs: 2000, deleted: false },
    ];

    const cuts = TextBasedEditingEngine.calculateTimelineCutsFromDeletedWords(tokens);
    // True cut ranges: [550-800] and [1250-1500]
    expect(cuts.length).toBe(2);
    expect(cuts[0].startMs).toBe(550);
    expect(cuts[0].endMs).toBe(800);
    expect(cuts[1].startMs).toBe(1250);
    expect(cuts[1].endMs).toBe(1500);

    // Retained ranges: [0-500], [850-1200], [1550-2000]
    const retained = TextBasedEditingEngine.calculateRetainedRanges(tokens);
    expect(retained.length).toBe(3);
    expect(retained[0].startMs).toBe(0);
    expect(retained[1].startMs).toBe(850);
    expect(retained[2].startMs).toBe(1550);

    // Ripple split
    const sequences = [{ startFrame: 0, durationFrames: 60, id: 'main_clip' }];
    const rippled = TextBasedEditingEngine.splitSequencesWithRippleCuts(sequences, cuts, 30);
    expect(rippled.length).toBeGreaterThan(1);
    expect(rippled[0].startFrame).toBe(0);
  });

  it('CleanPlateEngine supports 3-tier inpainting filter chains', () => {
    const region = { x: 100, y: 100, width: 200, height: 80 };

    const fastFilter = CleanPlateEngine.generateFFmpegInpaintFilter(region, 'fast');
    expect(fastFilter).toContain('delogo=x=100:y=100:w=200:h=80');

    const patchMatch = CleanPlateEngine.generateFFmpegInpaintFilter(region, 'patchmatch');
    expect(patchMatch).toContain('tblend');
    expect(patchMatch).toContain('delogo');

    const aiFilter = CleanPlateEngine.generateFFmpegInpaintFilter(region, { tier: 'ai', aiModel: 'lama' });
    expect(aiFilter).toContain('ai_inpaint=model=lama');
  });

  it('MatchmoveVisionFacade extracts multi-frame 3D camera trajectory', async () => {
    const tracks = await MatchmoveVisionFacade.calculate3DCameraTrajectory('/test/video.mp4', 10, 30);
    expect(tracks.length).toBe(10);
    expect(tracks[0].cameraTransformMatrix.length).toBe(16);
    expect(tracks[9].frameIndex).toBe(9);
  });
});
