import { runWorkerDaemon } from './commands/WorkerCommand';
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
import { intro, defaultPipelineRegistry } from '@acc/core';

export interface CliOptions {
  command?: 'run' | 'stream' | 'serve' | 'list' | 'overlay' | 'sfx' | 'help' | 'worker';
  pipelineId?: string;
  configPath?: string;
  outDir?: string;
  exporters?: string[];
  format?: string;
  dryRun?: boolean;
  rtmpUrl?: string;
  port?: number;
  duration?: number;
  conductorUrl?: string;
}

export function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  if (!args || args.length === 0) {
    options.command = 'help';
    return options;
  }

  const firstArg = args[0].toLowerCase();
  let startIndex = 0;

  if (['run', 'stream', 'serve', 'list', 'overlay', 'sfx', 'worker', 'help', '--help', '-h'].includes(firstArg)) {
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
      options.configPath = args[0];
      startIndex = 1;
    } else {
      // Default to help if unrecognized
      options.command = 'help';
      return options;
    }
  }

  // Parse remaining arguments
  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-w' || arg === '--conductor-url') {
      options.conductorUrl = args[++i];
      continue;
    }
    if (arg === '-c' || arg === '--config') {
      options.configPath = args[++i];
      continue;
    }
    if (arg === '-e' || arg === '--exporters') {
      options.exporters = args[++i].split(',');
      continue;
    }
    if (arg === '-o' || arg === '--out') {
      options.outDir = args[++i];
      continue;
    }
    if (arg === '-f' || arg === '--format') {
      options.format = args[++i];
      continue;
    }
    if (arg === '-r' || arg === '--rtmp') {
      options.rtmpUrl = args[++i];
      continue;
    }
    if (arg === '-p' || arg === '--port') {
      options.port = parseInt(args[++i], 10);
      continue;
    }
    if (arg === '-d' || arg === '--duration') {
      options.duration = parseInt(args[++i], 10);
      continue;
    }
    if (arg === '-n' || arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      options.command = 'help';
      break;
    }
    if (!options.pipelineId && options.command === 'run') {
      options.pipelineId = arg;
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
  acc overlay [options]
  acc sfx [options]
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
  -n, --dry-run              Inspect and validate pipeline AST & assets without file encoding
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

export function resolvePipelineInput(pipelineId: string, options: CliOptions): any {
  const normId = pipelineId.toLowerCase();

  if (normId === '1' || normId === 'scraper' || normId === 'scraper-summarizer') {
    let event: any = {
      eventId: `evt_${Date.now()}`,
      sourceUrl: 'https://news.ycombinator.com',
      rawText: 'OpenAI and DeepMind announce next-generation agent architectures with sub-second latency.',
      receivedAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };
    if (options.configPath && fs.existsSync(options.configPath)) {
      event = JSON.parse(fs.readFileSync(options.configPath, 'utf-8'));
    }
    return event;
  }

  if (normId === '2' || normId === 'db' || normId === 'db-templating' || normId === 'database') {
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
    return dataset;
  }

  if (normId === '3' || normId === 'repurpose' || normId === 'repurposing' || normId === 'recycler') {
    let repurposeOpts: any = {
      title: 'Repurposed Video Highlight',
      rawTranscript: 'Stop doing repetitive work manually. Automate everything with ACC engines.',
      captions: [
        { text: 'Stop doing repetitive work manually.', startTimeMs: 0, endTimeMs: 1500 },
        { text: 'Automate everything with ACC engines.', startTimeMs: 1500, endTimeMs: 3000 },
      ],
      activeSpeakerPosition: { x: 0.5, y: 0.35 },
    };
    if (options.configPath && fs.existsSync(options.configPath)) {
      repurposeOpts = { ...repurposeOpts, ...JSON.parse(fs.readFileSync(options.configPath, 'utf-8')) };
    }
    return repurposeOpts;
  }

  if (normId === '4' || normId === 'story' || normId === 'generative-storytelling' || normId === 'storyteller') {
    return options.configPath || './sample-story';
  }

  if (normId === '5' || normId === 'rule' || normId === 'math' || normId === 'logic' || normId === 'rule-logic') {
    let proof: any = {
      problemTitle: 'Pythagorean Theorem Proof',
      category: 'Geometry',
      problemStatement: 'Prove that a^2 + b^2 = c^2 for any right triangle.',
      steps: [
        { stepNumber: 1, explanation: 'Construct square on hypotenuse c', latexFormula: 'Area = c^2' },
        { stepNumber: 2, explanation: 'Expand outer square (a + b)^2', latexFormula: 'a^2 + 2ab + b^2' },
        { stepNumber: 3, explanation: 'Subtract 4 right triangles (2ab)', latexFormula: 'a^2 + b^2 = c^2', evaluatedResult: 'c^2' },
      ],
      finalAnswer: 'a^2 + b^2 = c^2 (Q.E.D.)',
    };
    if (options.configPath && fs.existsSync(options.configPath)) {
      proof = JSON.parse(fs.readFileSync(options.configPath, 'utf-8'));
    }
    return proof;
  }

  if (normId === '6' || normId === 'ambient' || normId === 'ambient-stream' || normId === 'loop') {
    let config: any = {
      title: 'Deep Space Procedural Loop',
      theme: 'deep_space' as const,
      loopDurationSeconds: options.duration || 5,
      particleCount: 150,
    };
    if (options.configPath && fs.existsSync(options.configPath)) {
      config = { ...config, ...JSON.parse(fs.readFileSync(options.configPath, 'utf-8')) };
    }
    return config;
  }

  if (options.configPath && fs.existsSync(options.configPath)) {
    try {
      return JSON.parse(fs.readFileSync(options.configPath, 'utf-8'));
    } catch {
      return options.configPath;
    }
  }
  return {};
}

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

export async function runCli(argv = process.argv.slice(2)): Promise<any> {
  const options = parseCliArgs(argv);
  intro('ACC - Automated Content Creator');
  switch (options.command) {
    case 'help':
      printHelp();
      return { success: true, command: 'help' };

    case 'list':
      listPipelines();
      return { success: true, command: 'list' };

    case 'overlay': {
      const { runOverlayCommand } = await import('./commands/overlay');
      await runOverlayCommand(argv.slice(1));
      return { success: true, command: 'overlay' };
    }

    case 'sfx': {
      const { runSFXCommand } = await import('./commands/sfx');
      await runSFXCommand(argv.slice(1));
      return { success: true, command: 'sfx' };
    }

    case 'serve': {
      const port = options.port || 3000;
      console.log(`[ACC-CLI] Starting Webhook Ingestion Daemon on port ${port}...`);
      const scraper = new ScraperEngine();
      const server = scraper.startWebhookServer(port);
      console.log(`[ACC-CLI] Webhook Ingestion Daemon active on http://127.0.0.1:${port}/webhook`);
      return { success: true, server, port };
    }

    case 'worker': {
      if (!options.conductorUrl) {
        console.error("Error: --conductor-url <url> is required for the worker daemon command.");
        return { success: false, error: 'Missing --conductor-url flag' };
      }
      await runWorkerDaemon({ conductorUrl: options.conductorUrl });
      return { success: true, command: 'worker' };
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
      console.log(`[ACC-CLI] Executing Pipeline [${pipelineId}] via Orchestrator...`);

      if (!defaultPipelineRegistry.has(pipelineId)) {
        throw new Error(`Unknown pipeline identifier: '${pipelineId}'. Run 'acc list' for available pipelines.`);
      }

      const input = resolvePipelineInput(pipelineId, options);
      const executionResult = await defaultPipelineRegistry.execute(pipelineId, input, {
        outDir: options.outDir,
        format: options.format,
        duration: options.duration,
        exporters: options.exporters,
        dryRun: options.dryRun,
      });

      const outputPaths = executionResult.exportResults ? extractOutputPaths(executionResult.exportResults) : [];
      if ((executionResult as any).outputFilePath && !outputPaths.includes((executionResult as any).outputFilePath)) {
        outputPaths.push((executionResult as any).outputFilePath);
      }

      console.log(`[ACC-CLI] Pipeline [${pipelineId}] completed. Output:`, outputPaths);
      return {
        ...executionResult,
        success: true,
        outputPath: outputPaths[0],
        outputPaths,
      };
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

