import fs from 'fs';
import path from 'path';
import {
  ScraperPipeline,
  DBTemplatingPipeline,
  RepurposingPipeline,
  GenerativeStoryPipeline,
  RuleLogicPipeline,
  AmbientStreamPipeline,
  ScraperEngine,
  defaultStoryPipeline,
} from './pipelines';

export interface CliOptions {
  command?: 'run' | 'stream' | 'serve' | 'list' | 'help';
  pipelineId?: string;
  configPath?: string;
  exporters?: string[];
  outDir?: string;
  rtmpUrl?: string;
  port?: number;
  duration?: number;
  format?: 'mp4' | 'mkv' | 'mov' | 'webm' | string;
}

export function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  if (!args || args.length === 0) {
    options.command = 'help';
    return options;
  }

  const firstArg = args[0].toLowerCase();
  let startIndex = 0;

  if (['run', 'stream', 'serve', 'list', 'help', '--help', '-h'].includes(firstArg)) {
    if (firstArg === '--help' || firstArg === '-h') {
      options.command = 'help';
    } else {
      options.command = firstArg as any;
    }
    startIndex = 1;
  } else {
    // If first argument is not a known command, check if it's a directory or config path
    if (fs.existsSync(args[0]) || args[0].startsWith('./') || args[0].startsWith('../') || args[0].includes('/') || args[0].includes('\\')) {
      options.command = 'run';
      options.pipelineId = 'story';
      options.configPath = args[0];
      startIndex = 1;
    } else {
      options.command = 'help';
      return options;
    }
  }

  // Parse remaining arguments
  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i];

    if (!options.pipelineId && (options.command === 'run' || options.command === 'stream') && !arg.startsWith('-')) {
      options.pipelineId = arg.toLowerCase();
      continue;
    }

    if (arg === '--config' || arg === '-c') {
      options.configPath = args[++i];
    } else if (arg === '--exporters' || arg === '-e') {
      options.exporters = (args[++i] || '').split(',').map(s => s.trim().toLowerCase());
    } else if (arg === '--out' || arg === '-o') {
      options.outDir = args[++i];
    } else if (arg === '--rtmp' || arg === '-r') {
      options.rtmpUrl = args[++i];
    } else if (arg === '--port' || arg === '-p') {
      options.port = parseInt(args[++i], 10);
    } else if (arg === '--duration' || arg === '-d') {
      options.duration = parseFloat(args[++i]);
    } else if (arg === '--format' || arg === '-f' || arg === '--container') {
      options.format = args[++i]?.toLowerCase();
    }
  }

  return options;
}

export function printHelp(): void {
  console.log(`
ACC (Automated Content Creator) - Multi-Pipeline Engine CLI v3.0

USAGE:
  acc run <pipeline_id> [options]
  acc stream <pipeline_id> --rtmp <url> [options]
  acc serve [--port <number>]
  acc list
  acc <story_folder> (Legacy Generative Storyteller shorthand)

PIPELINE IDENTIFIERS:
  1 | scraper     Event-Driven Scraper & Fast-Paced Summarizer
  2 | db          Structured Data / Database Templating (Bar Chart Race, etc.)
  3 | repurposing Long-form Recycler (9:16 Smart-Crop & Subtitles)
  4 | story       Generative Storytelling (Multi-scene 3D Depth Video)
  5 | rule | math Rule & Math Logic Engine (Chalkboard Proof Solver)
  6 | ambient     Procedural Ambient Stream (24/7 Generative Loop)

OPTIONS:
  -c, --config <file|dir>    Input data/configuration JSON file or story folder
  -e, --exporters <list>     Comma-separated exporters: video, audio, social, web
  -o, --out <dir>            Output directory for rendered assets
  -f, --format <fmt>         Output video container: mp4, mkv, mov, webm (Default: mp4)
  -r, --rtmp <url>           RTMP/RTMPS server ingestion endpoint
  -p, --port <port>          Webhook listener HTTP port (Default: 3000)
  -d, --duration <seconds>   Stream or loop duration limit in seconds
  -h, --help                 Display this CLI guide
`);
}

export function listPipelines(): void {
  console.log(`
=== ACC Multi-Pipeline Engine Registry ===
1. [scraper]     Event-Driven Scraper & Summarizer
   Supported Exporters: video (alert card), audio (Kokoro TTS), social (breaking alert), web (markdown)
2. [db]          Database / Structured Templating
   Supported Exporters: video (bar chart race), audio, social (carousel stats), web (JSONB report)
3. [repurposing] Long-form Recycler
   Supported Exporters: video (9:16 vertical crop + karaoke subtitles), audio
4. [story]       Generative Storytelling Engine
   Supported Exporters: video (16:9 / 9:16 3D Depth, xfade, NVENC FFI zero-copy)
5. [rule / math] Rule & Math Logic Engine
   Supported Exporters: video (Manim chalkboard step-by-step), social, web
6. [ambient]     Procedural Ambient Stream
   Supported Exporters: video, audio, live-stream (YouTube Live 2.0s GOP RTMP)
`);
}

export async function runCli(argv = process.argv.slice(2)): Promise<any> {
  const options = parseCliArgs(argv);

  switch (options.command) {
    case 'help':
      printHelp();
      return { success: true, command: 'help' };

    case 'list':
      listPipelines();
      return { success: true, command: 'list' };

    case 'serve': {
      const port = options.port || 3000;
      console.log(`[ACC-CLI] Starting Webhook Ingestion Daemon on port ${port}...`);
      const scraper = new ScraperEngine();
      const server = scraper.startWebhookServer(port);
      console.log(`[ACC-CLI] Webhook Ingestion Daemon active on http://127.0.0.1:${port}/webhook`);
      return { success: true, server, port };
    }

    case 'stream': {
      if (!options.rtmpUrl) {
        console.error(`Error: --rtmp <url> is required for stream command.`);
        return { success: false, error: 'Missing --rtmp flag' };
      }
      const pipelineId = options.pipelineId || 'ambient';
      console.log(`[ACC-CLI] Initializing RTMP Live Stream for pipeline '${pipelineId}' -> ${options.rtmpUrl}`);

      if (pipelineId === '6' || pipelineId === 'ambient') {
        const ambientPipeline = new AmbientStreamPipeline();
        const duration = options.duration || 10;
        const maxFrames = Math.round(duration * 30);
        const res = await ambientPipeline.streamToRtmp(options.rtmpUrl, undefined, maxFrames);
        console.log(`[ACC-CLI] Stream finished successfully. Pushed ${res.framesSent} frames.`);
        return { success: true, framesSent: res.framesSent };
      } else {
        throw new Error(`Pipeline '${pipelineId}' does not support live RTMP streaming.`);
      }
    }

    case 'run': {
      const pipelineId = (options.pipelineId || 'story').toLowerCase();
      console.log(`[ACC-CLI] Executing Pipeline [${pipelineId}]...`);

function extractOutputPaths(results: any): string[] {
  const paths: string[] = [];
  if (!results) return paths;
  for (const exp of [results.video, results.audio, results.social, results.staticWeb]) {
    if (exp?.outputPath) {
      if (Array.isArray(exp.outputPath)) {
        paths.push(...exp.outputPath);
      } else {
        paths.push(exp.outputPath);
      }
    }
  }
  return paths;
}

      if (pipelineId === '1' || pipelineId === 'scraper') {
        const pipeline = new ScraperPipeline();
        let event = {
          eventId: `evt_${Date.now()}`,
          sourceUrl: 'https://news.ycombinator.com',
          rawText: 'OpenAI and DeepMind announce next-generation agent architectures with sub-second latency.',
          timestamp: new Date().toISOString(),
        };
        if (options.configPath && fs.existsSync(options.configPath)) {
          event = JSON.parse(fs.readFileSync(options.configPath, 'utf-8'));
        }
        const res = await pipeline.run(event, options.outDir);
        const outputPaths = extractOutputPaths(res.exportResults);
        console.log(`[ACC-CLI] Pipeline [scraper] completed. Output:`, outputPaths);
        return { ...res, outputPaths };
      }

      if (pipelineId === '2' || pipelineId === 'db') {
        const pipeline = new DBTemplatingPipeline();
        let dataset: any = {
          title: 'Programming Language Adoption 2026',
          category: 'Technology',
          highlightMetric: 'popularity',
          entities: [
            { id: '1', name: 'TypeScript', category: 'Frontend', metrics: { popularity: 92 }, highlightMetric: 'popularity' },
            { id: '2', name: 'Python', category: 'AI/Backend', metrics: { popularity: 89 }, highlightMetric: 'popularity' },
            { id: '3', name: 'Rust', category: 'Systems', metrics: { popularity: 74 }, highlightMetric: 'popularity' },
            { id: '4', name: 'Go', category: 'Cloud', metrics: { popularity: 68 }, highlightMetric: 'popularity' },
          ],
        };
        if (options.configPath && fs.existsSync(options.configPath)) {
          dataset = JSON.parse(fs.readFileSync(options.configPath, 'utf-8'));
        }
        const res = await pipeline.run(dataset, options.outDir);
        const outputPaths = extractOutputPaths(res.exportResults);
        console.log(`[ACC-CLI] Pipeline [db] completed. Output:`, outputPaths);
        return { ...res, outputPaths };
      }

      if (pipelineId === '3' || pipelineId === 'repurpose') {
        const pipeline = new RepurposingPipeline();
        let repurposeOpts = {
          rawVideoPath: 'sample.mp4',
          audioPath: 'sample.mp3',
          captions: [
            { text: 'Stop doing repetitive work manually.', startTimeMs: 0, endTimeMs: 1500 },
            { text: 'Automate everything with ACC engines.', startTimeMs: 1500, endTimeMs: 3000 },
          ],
          outputDir: options.outDir,
        };
        if (options.configPath && fs.existsSync(options.configPath)) {
          repurposeOpts = { ...repurposeOpts, ...JSON.parse(fs.readFileSync(options.configPath, 'utf-8')) };
        }
        const res = await pipeline.run(repurposeOpts);
        const outputPaths = extractOutputPaths(res.exportResults);
        console.log(`[ACC-CLI] Pipeline [repurpose] completed. Output:`, outputPaths);
        return { ...res, outputPaths };
      }

      if (pipelineId === '4' || pipelineId === 'story') {
        const storyDir = options.configPath || './sample-story';
        console.log(`[ACC-CLI] Launching Generative Storytelling Pipeline for: ${storyDir}`);
        const result = await defaultStoryPipeline.execute(storyDir);
        console.log(`[ACC-CLI] Render complete: ${result}`);
        return { success: true, outputPath: result, outputPaths: [result] };
      }

      if (pipelineId === '5' || pipelineId === 'rule' || pipelineId === 'math') {
        const pipeline = new RuleLogicPipeline();
        let proof: any = {
          problemTitle: 'Pythagorean Theorem Proof',
          category: 'Geometry',
          problemStatement: 'Prove that a^2 + b^2 = c^2 for any right triangle.',
          steps: [
            { stepNumber: 1, ruleApplied: 'Geometric Area', statement: 'Construct square on hypotenuse c', result: 'Area = c^2' },
            { stepNumber: 2, ruleApplied: 'Algebraic Expansion', statement: 'Expand outer square (a + b)^2', result: 'a^2 + 2ab + b^2' },
            { stepNumber: 3, ruleApplied: 'Subtraction', statement: 'Subtract 4 right triangles (2ab)', result: 'a^2 + b^2 = c^2' },
          ],
          finalAnswer: 'a^2 + b^2 = c^2 (Q.E.D.)',
        };
        if (options.configPath && fs.existsSync(options.configPath)) {
          proof = JSON.parse(fs.readFileSync(options.configPath, 'utf-8'));
        }
        const res = await pipeline.run(proof, options.outDir);
        const outputPaths = extractOutputPaths(res.exportResults);
        console.log(`[ACC-CLI] Pipeline [rule/math] completed. Output:`, outputPaths);
        return { ...res, outputPaths };
      }

      if (pipelineId === '6' || pipelineId === 'ambient') {
        const pipeline = new AmbientStreamPipeline();
        let config = {
          title: 'Deep Space Procedural Loop',
          theme: 'deep_space' as const,
          loopDurationSeconds: options.duration || 5,
          particleCount: 150,
        };
        if (options.configPath && fs.existsSync(options.configPath)) {
          config = { ...config, ...JSON.parse(fs.readFileSync(options.configPath, 'utf-8')) };
        }
        const res = await pipeline.run(config, options.outDir);
        const outputPaths = extractOutputPaths(res.exportResults);
        console.log(`[ACC-CLI] Pipeline [ambient] completed. Output:`, outputPaths);
        return { ...res, outputPaths };
      }

      throw new Error(`Unknown pipeline identifier: '${pipelineId}'. Run 'acc list' for available pipelines.`);
    }

    default:
      printHelp();
      return { success: true };
  }
}

// Allow direct execution when invoked as a script
if (import.meta.main) {
  runCli().catch((err) => {
    console.error(`[ACC-CLI] Fatal Error:`, err);
    process.exit(1);
  });
}
