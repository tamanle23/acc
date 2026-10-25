import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  MediaAssetProberChain,
  ImageProberHandler,
  VideoProberHandler,
  AudioProberHandler,
  ScriptProberHandler,
  DataProberHandler,
} from '../../packages/core/src/autoconfig';

describe('Universal Auto-Config Phase 1: Headless Prober Chain & Asset Manifest', () => {
  const sampleStoryDir = path.resolve('sample-story');
  let tempTestDir: string;

  beforeAll(async () => {
    tempTestDir = path.join(os.tmpdir(), `acc_prober_test_${Date.now()}`);
    await fs.promises.mkdir(tempTestDir, { recursive: true });

    // Create synthetic test files
    await fs.promises.writeFile(
      path.join(tempTestDir, 'script.txt'),
      '# Intro Scene\nWelcome to the automated crypto alpha show.\nHere is our second point about Ethereum.'
    );

    await fs.promises.writeFile(
      path.join(tempTestDir, 'metrics.csv'),
      'timestamp,token,price,change\n1700000000,BTC,95000,+5.2%\n1700000001,ETH,3800,+2.1%\n1700000002,SOL,240,+8.5%'
    );

    await fs.promises.writeFile(
      path.join(tempTestDir, 'dataset.json'),
      JSON.stringify([
        { id: 1, label: 'Alpha', score: 98 },
        { id: 2, label: 'Beta', score: 84 },
      ])
    );

    // Dummy audio and video files (empty or text)
    await fs.promises.writeFile(path.join(tempTestDir, 'audio_1.mp3'), 'dummy mp3 data');
    await fs.promises.writeFile(path.join(tempTestDir, 'bgm_synth.wav'), 'dummy wav data');
    await fs.promises.writeFile(path.join(tempTestDir, 'clip_hero.mp4'), 'dummy mp4 data');
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempTestDir)) {
        await fs.promises.rm(tempTestDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('Chain of Responsibility Mechanics', () => {
    it('should link handlers properly and support custom root handler', () => {
      const img = new ImageProberHandler();
      const vid = new VideoProberHandler();
      const aud = new AudioProberHandler();

      img.setNext(vid).setNext(aud);
      expect(img.id).toBe('prober.image');
      expect(vid.id).toBe('prober.video');
      expect(aud.id).toBe('prober.audio');
    });

    it('should build complete default chain with 5 specialized probers', () => {
      const chain = new MediaAssetProberChain();
      expect(chain).toBeDefined();
    });
  });

  describe('Directory Crawling & Metadata Probing', () => {
    it('should probe synthetic directory and discover all asset types without error', async () => {
      const chain = new MediaAssetProberChain();
      const manifest = await chain.probeDirectory(tempTestDir, { probeDeepMetadata: false });

      expect(manifest.baseDir).toBe(path.resolve(tempTestDir));
      expect(manifest.scannedAt).toBeGreaterThan(0);

      // Check visuals
      expect(manifest.visuals.length).toBe(1);
      expect(manifest.visuals[0].fileName).toBe('clip_hero.mp4');
      expect(manifest.visuals[0].type).toBe('video');

      // Check audio
      expect(manifest.audio.length).toBe(2);
      const voiceover = manifest.audio.find((a) => a.fileName === 'audio_1.mp3');
      const bgm = manifest.audio.find((a) => a.fileName === 'bgm_synth.wav');
      expect(voiceover?.classification).toBe('voiceover');
      expect(bgm?.classification).toBe('music');

      expect(manifest.hasVoiceover).toBe(true);
      expect(manifest.hasBackgroundMusic).toBe(true);

      // Check scripts
      expect(manifest.scripts.length).toBe(1);
      const script = manifest.scripts[0];
      expect(script.fileName).toBe('script.txt');
      expect(script.lines.length).toBe(2); // excluded comments
      expect(script.wordCount).toBeGreaterThan(10);
      expect(script.estimatedSpeechDurationMs).toBeGreaterThan(4000);

      // Check structured data
      expect(manifest.data.length).toBe(2);
      const csv = manifest.data.find((d) => d.extension === 'csv');
      expect(csv?.headers).toEqual(['timestamp', 'token', 'price', 'change']);
      expect(csv?.rowCount).toBe(3);

      const json = manifest.data.find((d) => d.extension === 'json');
      expect(json?.rowCount).toBe(2);
    });

    it('should probe real sample-story directory with high fidelity', async () => {
      if (!fs.existsSync(sampleStoryDir)) return;

      const chain = new MediaAssetProberChain();
      const manifest = await chain.probeDirectory(sampleStoryDir, { probeDeepMetadata: true });

      expect(manifest.visuals.length).toBeGreaterThan(0);
      expect(manifest.audio.length).toBeGreaterThan(0);

      // Check image aspect ratio detection
      const firstImage = manifest.visuals.find((v) => v.type === 'image');
      if (firstImage) {
        expect(firstImage.width).toBeGreaterThan(0);
        expect(firstImage.height).toBeGreaterThan(0);
        expect(firstImage.aspectRatio).toBeDefined();
      }

      // Check pairing logic (e.g. 1.png matching audio_1.mp3)
      expect(manifest.pairedPairs.length).toBeGreaterThan(0);
      const pair1 = manifest.pairedPairs[0];
      expect(pair1.visual).toBeDefined();
    });

    it('should throw clear error payload if target directory does not exist', async () => {
      const chain = new MediaAssetProberChain();
      const nonExistent = path.join(os.tmpdir(), `non_existent_${Date.now()}`);

      expect(chain.probeDirectory(nonExistent)).rejects.toThrow(
        /Target directory does not exist/
      );
    });
  });
});
