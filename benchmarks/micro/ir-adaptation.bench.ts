import { run, bench, group } from 'mitata';
import { LegacyStoryConfigAdapter, LegacyStoryConfig } from '../../packages/ir/src/LegacyStoryConfigAdapter';

group('IR Schema & AST Transformations', () => {
  const sampleLegacyConfig: LegacyStoryConfig = {
    name: 'Benchmark Story Concept',
    description: 'High frequency AST parsing benchmark',
    settings: {
      platform: 'tiktok',
      width: 1080,
      height: 1920,
      fps: 60,
      bgm: {
        source: 'assets/bgm/cyberpunk.mp3',
        volume: 0.2,
        loop: true,
        autoDucking: true,
      },
    },
    scenes: Array.from({ length: 20 }, (_, i) => ({
      image: `images/scene_${i + 1}.jpg`,
      audio: `voiceover/scene_${i + 1}.mp3`,
      text: `Scene ${i + 1} narration script for performance testing.`,
      duration: 4.5,
      captions: [
        { text: 'Exploring', start: 0.0, end: 0.8 },
        { text: 'systematic', start: 0.8, end: 1.6 },
        { text: 'video', start: 1.6, end: 2.4 },
        { text: 'editing', start: 2.4, end: 3.2 },
        { text: 'architecture', start: 3.2, end: 4.5 },
      ],
      transition: {
        enabled: true,
        type: 'crossfade',
        duration: 0.5,
      },
      depth3d: {
        enabled: true,
        mode: 'frame_breaker',
        frameStyle: 'card',
      },
    })),
  };

  bench('LegacyStoryConfigAdapter.adapt (20 Scenes + Captions)', () => {
    const ir = LegacyStoryConfigAdapter.adapt(sampleLegacyConfig, 'bench_job_1001');
  });

  bench('JSON Serialization & Normalization of ExtendedPipelineIR', () => {
    const ir = LegacyStoryConfigAdapter.adapt(sampleLegacyConfig, 'bench_job_1002');
    const jsonStr = JSON.stringify(ir);
    const parsed = JSON.parse(jsonStr);
  });
});

if (import.meta.main) {
  run();
}
