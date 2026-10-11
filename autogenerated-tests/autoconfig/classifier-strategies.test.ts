import { describe, it, expect, beforeAll } from 'bun:test';
import path from 'path';
import fs from 'fs';
import {
  PipelineClassifierRegistry,
  MediaAssetProberChain,
  type DiscoveredAssetManifest,
} from '../../packages/core/src/autoconfig';

describe('Universal Auto-Config Phase 2: Pipeline Classifier Strategies & Registry', () => {
  beforeAll(() => {
    PipelineClassifierRegistry.initialize();
  });

  const createBaseManifest = (): DiscoveredAssetManifest => ({
    baseDir: '/test/media',
    scannedAt: Date.now(),
    visuals: [],
    audio: [],
    scripts: [],
    data: [],
    pairedPairs: [],
    suggestedTitle: 'Test Media Package',
    totalVisualCount: 0,
    totalAudioCount: 0,
    hasVoiceover: false,
    hasBackgroundMusic: false,
  });

  describe('Registry Mechanics', () => {
    it('should register and list all 6 canonical pipeline strategies', () => {
      const list = PipelineClassifierRegistry.list();
      expect(list.length).toBe(6);

      const ids = list.map((s) => s.pipelineId);
      expect(ids).toContain('1');
      expect(ids).toContain('2');
      expect(ids).toContain('3');
      expect(ids).toContain('4');
      expect(ids).toContain('5');
      expect(ids).toContain('6');
    });

    it('should look up strategies by numeric ID and canonical pipeline name', () => {
      expect(PipelineClassifierRegistry.get('1')?.name).toContain('Scraper');
      expect(PipelineClassifierRegistry.get('scraper-summarizer')?.pipelineId).toBe('1');

      expect(PipelineClassifierRegistry.get('2')?.name).toContain('Database');
      expect(PipelineClassifierRegistry.get('db-templating')?.pipelineId).toBe('2');

      expect(PipelineClassifierRegistry.get('3')?.name).toContain('Repurposing');
      expect(PipelineClassifierRegistry.get('repurposing-recycler')?.pipelineId).toBe('3');

      expect(PipelineClassifierRegistry.get('4')?.name).toContain('Generative');
      expect(PipelineClassifierRegistry.get('generative-storytelling')?.pipelineId).toBe('4');

      expect(PipelineClassifierRegistry.get('5')?.name).toContain('Rule-Logic');
      expect(PipelineClassifierRegistry.get('rule-logic')?.pipelineId).toBe('5');

      expect(PipelineClassifierRegistry.get('6')?.name).toContain('Ambient');
      expect(PipelineClassifierRegistry.get('ambient-loops')?.pipelineId).toBe('6');
    });
  });

  describe('Heuristic Classification Accuracy', () => {
    it('should classify text-heavy folder as Pipeline 1 (Scraper & Summarizer)', () => {
      const manifest = createBaseManifest();
      manifest.scripts.push({
        relativePath: 'article.md',
        absolutePath: '/test/media/article.md',
        fileName: 'article.md',
        extension: '.md',
        content: 'This is a comprehensive article about macroeconomic policy and market trends...',
        lines: ['Intro', 'Point 1', 'Point 2', 'Conclusion'],
        wordCount: 150,
        estimatedSpeechDurationMs: 60000,
      });

      const res = PipelineClassifierRegistry.resolve(manifest);
      expect(res.strategy.pipelineId).toBe('1');
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.defaults.canonicalPipelineId).toBe('scraper-summarizer');
      expect(res.defaults.suggestedModalities).toContain('static-web');
    });

    it('should classify tabular dataset as Pipeline 2 (DB-Templating)', () => {
      const manifest = createBaseManifest();
      manifest.data.push({
        relativePath: 'crypto_rankings.csv',
        absolutePath: '/test/media/crypto_rankings.csv',
        fileName: 'crypto_rankings.csv',
        extension: 'csv',
        rowCount: 25,
        headers: ['token', 'price', 'market_cap'],
      });

      const res = PipelineClassifierRegistry.resolve(manifest);
      expect(res.strategy.pipelineId).toBe('2');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
      expect(res.defaults.canonicalPipelineId).toBe('db-templating');
      expect(res.defaults.defaultFps).toBe(60); // 60 FPS for data animations
    });

    it('should classify long video as Pipeline 3 (Repurposing Recycler)', () => {
      const manifest = createBaseManifest();
      manifest.visuals.push({
        relativePath: 'interview_podcast.mp4',
        absolutePath: '/test/media/interview_podcast.mp4',
        fileName: 'interview_podcast.mp4',
        baseName: 'interview_podcast',
        extension: '.mp4',
        type: 'video',
        sizeBytes: 15 * 1024 * 1024,
        durationMs: 180000,
      });

      const res = PipelineClassifierRegistry.resolve(manifest);
      expect(res.strategy.pipelineId).toBe('3');
      expect(res.confidence).toBeGreaterThanOrEqual(0.95);
      expect(res.defaults.canonicalPipelineId).toBe('repurposing-recycler');
      expect(res.defaults.defaultAspect).toBe('9:16'); // Auto vertical crop
    });

    it('should classify real sample-story as Pipeline 4 (Generative Storytelling)', async () => {
      const sampleStoryDir = path.resolve('sample-story');
      if (!fs.existsSync(sampleStoryDir)) return;

      const prober = new MediaAssetProberChain();
      const manifest = await prober.probeDirectory(sampleStoryDir, { probeDeepMetadata: false });

      const res = PipelineClassifierRegistry.resolve(manifest);
      expect(res.strategy.pipelineId).toBe('4');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
      expect(res.defaults.canonicalPipelineId).toBe('generative-storytelling');
      expect(res.defaults.suggestedModalities).toContain('video');
    });

    it('should classify decision tree script as Pipeline 5 (Rule-Logic)', () => {
      const manifest = createBaseManifest();
      manifest.scripts.push({
        relativePath: 'dialogue_tree.txt',
        absolutePath: '/test/media/dialogue_tree.txt',
        fileName: 'dialogue_tree.txt',
        extension: '.txt',
        content: 'Choice 1: Go left to the castle.\nChoice 2: Go right through the forest.\nIf condition met...',
        lines: ['Choice 1', 'Choice 2'],
        wordCount: 30,
        estimatedSpeechDurationMs: 12000,
      });

      const res = PipelineClassifierRegistry.resolve(manifest);
      expect(res.strategy.pipelineId).toBe('5');
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.defaults.canonicalPipelineId).toBe('rule-logic');
      expect(res.defaults.suggestedModalities).toContain('interactive-web');
    });

    it('should classify relaxation beat / lofi audio without speech as Pipeline 6 (Ambient Loops)', () => {
      const manifest = createBaseManifest();
      manifest.audio.push({
        relativePath: 'lofi_sleep_beat_loop.mp3',
        absolutePath: '/test/media/lofi_sleep_beat_loop.mp3',
        fileName: 'lofi_sleep_beat_loop.mp3',
        baseName: 'lofi_sleep_beat_loop',
        extension: '.mp3',
        sizeBytes: 4 * 1024 * 1024,
        classification: 'music',
      });

      const res = PipelineClassifierRegistry.resolve(manifest);
      expect(res.strategy.pipelineId).toBe('6');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
      expect(res.defaults.canonicalPipelineId).toBe('ambient-loops');
      expect(res.defaults.chunkDurationMs).toBe(60000);
    });
  });

  describe('Manual Override Handling', () => {
    it('should enforce explicit manual override regardless of detected files', () => {
      const manifest = createBaseManifest();
      // Manifest contains data which would normally select Pipeline 2
      manifest.data.push({
        relativePath: 'metrics.csv',
        absolutePath: '/test/media/metrics.csv',
        fileName: 'metrics.csv',
        extension: 'csv',
        rowCount: 50,
      });

      // User explicitly forces Pipeline 3 (Repurposing)
      const res = PipelineClassifierRegistry.resolve(manifest, '3');
      expect(res.strategy.pipelineId).toBe('3');
      expect(res.isOverride).toBe(true);
      expect(res.confidence).toBe(1.0);
      expect(res.defaults.canonicalPipelineId).toBe('repurposing-recycler');
    });
  });
});
