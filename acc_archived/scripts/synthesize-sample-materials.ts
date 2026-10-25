import fs from 'fs';
import path from 'path';
import { createCanvas } from '@napi-rs/canvas';

/**
 * Generates a standard PCM WAV buffer (16-bit mono).
 */
function createWavBuffer(durationSec: number, freq: number = 440, type: 'sine' | 'noise' | 'sweep' = 'sine'): Buffer {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (type === 'sine') {
      sample = Math.sin(2 * Math.PI * freq * t);
    } else if (type === 'noise') {
      sample = (Math.random() * 2 - 1) * 0.4;
    } else if (type === 'sweep') {
      const currentFreq = freq + (800 - freq) * (t / durationSec);
      sample = Math.sin(2 * Math.PI * currentFreq * t);
    }

    // Envelope fade in/out to prevent click
    const fadeDuration = Math.min(0.05, durationSec * 0.1);
    let envelope = 1;
    if (t < fadeDuration) envelope = t / fadeDuration;
    else if (t > durationSec - fadeDuration) envelope = (durationSec - t) / fadeDuration;

    sample *= envelope * 0.6; // Scale volume

    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

/**
 * Generates a synthetic PNG image with high-contrast shapes.
 */
function createSyntheticImage(
  width: number,
  height: number,
  title: string,
  subtitle: string,
  bgColor: string,
  accentColor: string
): Buffer {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Geometric subject (for 3D depth & segmentation)
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2 - 60, Math.min(width, height) * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Subtle grid/particles
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  for (let i = 0; i < 40; i++) {
    const px = (i * 97) % width;
    const py = (i * 131) % height;
    ctx.fillRect(px, py, 6, 6);
  }

  // Card backdrop
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.roundRect(width * 0.08, height * 0.65, width * 0.84, height * 0.25, 20);
  ctx.fill();

  // Typography
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, height * 0.74);

  ctx.fillStyle = '#A0AEC0';
  ctx.font = '24px sans-serif';
  ctx.fillText(subtitle, width / 2, height * 0.82);

  return canvas.toBuffer('image/png');
}

export function synthesizeAllSampleMaterials(baseDir: string = path.resolve('samples')): void {
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // -------------------------------------------------------------
  // 1. Pipeline 1: Scraper & Summarizer
  // -------------------------------------------------------------
  const p1Dir = path.join(baseDir, '01-scraper-summarizer');
  const p1Assets = path.join(p1Dir, 'assets');
  fs.mkdirSync(p1Assets, { recursive: true });

  fs.writeFileSync(
    path.join(p1Assets, 'editorial_cover.png'),
    createSyntheticImage(1080, 1920, 'TECH BREAKING NEWS', 'Autonomous Agents 2026', '#0B0F19', '#38BDF8')
  );
  fs.writeFileSync(path.join(p1Assets, 'bgm_tech.mp3'), createWavBuffer(12, 220, 'sine'));
  fs.writeFileSync(path.join(p1Assets, 'sfx_whoosh.wav'), createWavBuffer(1.2, 180, 'sweep'));
  fs.writeFileSync(path.join(p1Assets, 'sfx_notification.wav'), createWavBuffer(0.8, 880, 'sine'));

  const breakingNewsArticle = `# OpenAI & DeepMind Unveil Next-Gen Agentic Architecture

The AI landscape shifted dramatically today as major research laboratories unveiled next-generation autonomous architectures featuring real-time perceptual grounding and sub-second reasoning loops.

### Key Developments
1. **Zero-Copy Memory Transport**: Models now stream frame vectors directly into system buses without heap allocations.
2. **Deterministic Timeline Synchronization**: Autonomous multi-modal orchestrators maintain bit-identical frame reproducibility across distributed worker pools.
3. **Omnichannel Synthesis**: Single pipeline IR representations compile simultaneously into vertical video, interactive data cards, and real-time audio streams.

Industry analysts predict widespread adoption across media production workflows, with content pipelines achieving 10x throughput increases.`;

  fs.writeFileSync(path.join(p1Dir, 'breaking_news.md'), breakingNewsArticle, 'utf-8');

  fs.writeFileSync(
    path.join(p1Dir, 'source_feed.json'),
    JSON.stringify(
      {
        sourceType: 'rss',
        rawText: breakingNewsArticle,
        sourceUrl: 'https://news.ycombinator.com/item?id=42000000',
        metadata: { category: 'tech', urgency: 'high', author: 'AI Research Desk' },
        receivedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf-8'
  );

  // -------------------------------------------------------------
  // 2. Pipeline 2: DB-Templating
  // -------------------------------------------------------------
  const p2Dir = path.join(baseDir, '02-db-templating');
  const p2Assets = path.join(p2Dir, 'assets');
  fs.mkdirSync(p2Assets, { recursive: true });

  fs.writeFileSync(
    path.join(p2Assets, 'brand_logo.png'),
    createSyntheticImage(1920, 1080, 'GLOBAL TECH STATS', 'Leaderboard 2026', '#0D1117', '#10B981')
  );
  fs.writeFileSync(path.join(p2Assets, 'bgm_synth.mp3'), createWavBuffer(15, 160, 'sine'));
  fs.writeFileSync(path.join(p2Assets, 'sfx_data_blip.wav'), createWavBuffer(0.5, 960, 'sine'));
  fs.writeFileSync(path.join(p2Assets, 'sfx_sub_drop.wav'), createWavBuffer(2.0, 120, 'sweep'));

  const csvRows = [
    'rank,framework,market_share,growth_rate,active_repos',
    '1,TypeScript,94.2,18.4,1420000',
    '2,Python,91.8,24.1,1980000',
    '3,Rust,78.5,35.8,540000',
    '4,Go,72.1,12.3,460000',
    '5,C++,64.8,4.2,620000',
    '6,Kotlin,58.3,16.7,310000',
    '7,Swift,52.4,9.1,280000',
    '8,Zig,44.9,68.2,120000',
    '9,Elixir,39.1,14.5,95000',
    '10,Haskell,31.2,2.8,78000',
    '11,Scala,28.6,-1.2,65000',
    '12,Ruby,26.4,-3.8,110000',
    '13,PHP,24.1,-5.2,340000',
    '14,Dart,22.8,8.4,85000',
    '15,Lua,19.5,6.1,42000',
    '16,Julia,18.2,19.3,38000',
  ];
  fs.writeFileSync(path.join(p2Dir, 'tech_market_adoption.csv'), csvRows.join('\n'), 'utf-8');

  fs.writeFileSync(
    path.join(p2Dir, 'database_payload.json'),
    JSON.stringify(
      {
        title: 'Programming Language Adoption 2026',
        category: 'Technology',
        highlightMetric: 'market_share',
        entities: [
          { id: '1', name: 'TypeScript', category: 'Frontend/Fullstack', metrics: { market_share: 94.2 }, highlightMetric: 'market_share', badge: 'TOP 1' },
          { id: '2', name: 'Python', category: 'AI/Data', metrics: { market_share: 91.8 }, highlightMetric: 'market_share', badge: 'FASTEST' },
          { id: '3', name: 'Rust', category: 'Systems', metrics: { market_share: 78.5 }, highlightMetric: 'market_share' },
          { id: '4', name: 'Go', category: 'Cloud Infrastructure', metrics: { market_share: 72.1 }, highlightMetric: 'market_share' },
        ],
        summaryConclusion: 'TypeScript and Python dominate modern software engineering stacks in 2026.',
      },
      null,
      2
    ),
    'utf-8'
  );

  // -------------------------------------------------------------
  // 3. Pipeline 3: Repurposing Recycler
  // -------------------------------------------------------------
  const p3Dir = path.join(baseDir, '03-repurposing-recycler');
  const p3Assets = path.join(p3Dir, 'assets');
  fs.mkdirSync(p3Assets, { recursive: true });

  // Copy existing sample video if available, or create dummy video asset
  const existingVideoPath = path.resolve('sample-story/assets/b-roll-nature.mp4');
  const targetClipPath = path.join(p3Assets, 'podcast_clip.mp4');
  if (fs.existsSync(existingVideoPath)) {
    fs.copyFileSync(existingVideoPath, targetClipPath);
  } else {
    fs.writeFileSync(targetClipPath, Buffer.alloc(1024 * 1024 * 2)); // 2MB dummy placeholder
  }

  fs.writeFileSync(path.join(p3Assets, 'bgm_viral.mp3'), createWavBuffer(20, 240, 'sine'));
  fs.writeFileSync(path.join(p3Assets, 'sfx_pop.wav'), createWavBuffer(0.4, 520, 'sine'));
  fs.writeFileSync(path.join(p3Assets, 'sfx_whoosh.wav'), createWavBuffer(0.8, 190, 'sweep'));

  fs.writeFileSync(
    path.join(p3Dir, 'repurpose_transcript.json'),
    JSON.stringify(
      {
        title: 'Mastering Agentic Codebases',
        rawTranscript: 'Stop doing repetitive software development manually. Automate your engineering pipelines with universal IR architectures.',
        activeSpeakerPosition: { x: 0.5, y: 0.38 },
        wordTimestamps: [
          { word: 'Stop', startMs: 0, endMs: 400 },
          { word: 'doing', startMs: 400, endMs: 800 },
          { word: 'repetitive', startMs: 800, endMs: 1400 },
          { word: 'development', startMs: 1400, endMs: 2000 },
          { word: 'manually.', startMs: 2000, endMs: 2600 },
          { word: 'Automate', startMs: 2800, endMs: 3300 },
          { word: 'your', startMs: 3300, endMs: 3600 },
          { word: 'engineering', startMs: 3600, endMs: 4200 },
          { word: 'pipelines', startMs: 4200, endMs: 4800 },
          { word: 'with', startMs: 4800, endMs: 5100 },
          { word: 'universal', startMs: 5100, endMs: 5700 },
          { word: 'IR.', startMs: 5700, endMs: 6300 },
        ],
      },
      null,
      2
    ),
    'utf-8'
  );

  fs.writeFileSync(
    path.join(p3Dir, 'transcript.txt'),
    'Stop doing repetitive software development manually. Automate your engineering pipelines with universal IR architectures.',
    'utf-8'
  );

  // -------------------------------------------------------------
  // 4. Pipeline 4: Generative Storytelling
  // -------------------------------------------------------------
  const p4Dir = path.join(baseDir, '04-generative-storytelling');
  const p4Assets = path.join(p4Dir, 'assets');
  fs.mkdirSync(p4Assets, { recursive: true });

  fs.writeFileSync(
    path.join(p4Assets, 'scene1.png'),
    createSyntheticImage(1080, 1920, 'THE DRAGON LAIR', 'Chapter I: The Awakening', '#1E1B4B', '#F59E0B')
  );
  fs.writeFileSync(
    path.join(p4Assets, 'scene2.png'),
    createSyntheticImage(1080, 1920, 'THE GOLDEN CITADEL', 'Chapter II: The Journey', '#0F172A', '#818CF8')
  );

  fs.writeFileSync(path.join(p4Assets, 'voiceover1.mp3'), createWavBuffer(3.5, 300, 'sine'));
  fs.writeFileSync(path.join(p4Assets, 'voiceover1.txt'), 'Deep in the forgotten mountains, an ancient dragon awakened from centuries of slumber.', 'utf-8');
  fs.writeFileSync(path.join(p4Assets, 'voiceover2.mp3'), createWavBuffer(4.0, 320, 'sine'));
  fs.writeFileSync(path.join(p4Assets, 'voiceover2.txt'), 'High above the clouds stood the golden citadel, glowing with sacred celestial fire.', 'utf-8');

  fs.writeFileSync(path.join(p4Assets, 'bgm.mp3'), createWavBuffer(20, 140, 'sine'));
  fs.writeFileSync(path.join(p4Assets, 'sfx_cinematic_hit.wav'), createWavBuffer(2.5, 90, 'sweep'));
  fs.writeFileSync(path.join(p4Assets, 'sfx_kaiju_roar.wav'), createWavBuffer(2.0, 110, 'noise'));

  // -------------------------------------------------------------
  // 5. Pipeline 5: Rule & Math Logic
  // -------------------------------------------------------------
  const p5Dir = path.join(baseDir, '05-rule-logic');
  const p5Assets = path.join(p5Dir, 'assets');
  fs.mkdirSync(p5Assets, { recursive: true });

  fs.writeFileSync(
    path.join(p5Assets, 'board_diagram.png'),
    createSyntheticImage(1920, 1080, 'PYTHAGOREAN PROOF', 'a^2 + b^2 = c^2', '#142018', '#34D399')
  );
  fs.writeFileSync(path.join(p5Assets, 'bgm_classical.mp3'), createWavBuffer(16, 260, 'sine'));
  fs.writeFileSync(path.join(p5Assets, 'sfx_chalk.wav'), createWavBuffer(0.9, 480, 'noise'));
  fs.writeFileSync(path.join(p5Assets, 'sfx_success_bell.wav'), createWavBuffer(1.5, 880, 'sine'));

  const dialogueLogicTree = `[Decision Node: Logic Proof Architecture]
Choice 1: Construct Euclidean outer square with side length (a + b)
  Condition: Right angle guaranteed (theta = 90 deg)
  Branch 1A: Area = (a + b)^2 = a^2 + 2ab + b^2
Choice 2: Decompose inner region into four right triangles and central square c^2
  Branch 2A: Inner area = 4 * (1/2 * a * b) + c^2 = 2ab + c^2
Evaluation: a^2 + 2ab + b^2 = 2ab + c^2 => a^2 + b^2 = c^2 (Q.E.D.)`;

  fs.writeFileSync(path.join(p5Dir, 'dialogue_logic_tree.txt'), dialogueLogicTree, 'utf-8');

  fs.writeFileSync(
    path.join(p5Dir, 'proof_problem.json'),
    JSON.stringify(
      {
        problemTitle: 'Pythagorean Theorem Proof',
        category: 'calculus',
        problemStatement: 'Prove that for every right-angled triangle with sides a, b and hypotenuse c: a^2 + b^2 = c^2.',
        steps: [
          { stepNumber: 1, explanation: 'Construct an outer square with side (a + b)', latexFormula: 'Area_{total} = (a + b)^2' },
          { stepNumber: 2, explanation: 'Expand the algebraic square', latexFormula: 'a^2 + 2ab + b^2' },
          { stepNumber: 3, explanation: 'Subtract the four enclosed right triangles', latexFormula: '4 \\times \\frac{1}{2}ab = 2ab' },
          { stepNumber: 4, explanation: 'Equate remaining area to hypotenuse square', latexFormula: 'a^2 + b^2 = c^2', evaluatedResult: 'c^2' },
        ],
        finalAnswer: 'a^2 + b^2 = c^2 (Q.E.D.)',
      },
      null,
      2
    ),
    'utf-8'
  );

  // -------------------------------------------------------------
  // 6. Pipeline 6: Ambient Loops
  // -------------------------------------------------------------
  const p6Dir = path.join(baseDir, '06-ambient-loops');
  const p6Assets = path.join(p6Dir, 'assets');
  fs.mkdirSync(p6Assets, { recursive: true });

  fs.writeFileSync(
    path.join(p6Assets, 'ambient_texture.png'),
    createSyntheticImage(1920, 1080, 'CYBERPUNK RAIN STUDY', '24/7 Lo-Fi Soundscape', '#05050A', '#A855F7')
  );
  fs.writeFileSync(path.join(p6Assets, 'lofi_sleep_beat_loop.mp3'), createWavBuffer(25, 130, 'sine'));
  fs.writeFileSync(path.join(p6Assets, 'sfx_rain_sound.wav'), createWavBuffer(8, 100, 'noise'));
  fs.writeFileSync(path.join(p6Assets, 'sfx_tape_hiss.wav'), createWavBuffer(5, 400, 'noise'));

  fs.writeFileSync(
    path.join(p6Dir, 'ambient_config.json'),
    JSON.stringify(
      {
        title: 'Cyberpunk Rain Lo-Fi Stream',
        theme: 'cyberpunk_rain',
        loopDurationSeconds: 15,
        particleCount: 200,
        bpm: 72,
      },
      null,
      2
    ),
    'utf-8'
  );
}
