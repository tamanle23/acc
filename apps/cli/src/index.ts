#!/usr/bin/env bun
import fs from 'fs';
import path from 'path';
import { parseArgs } from 'node:util';
import {
  AmbientStreamPipeline,
  ScraperEngine,
} from './pipelines';
import { DefaultPipelineRegistry, fileExists } from '@acc/core';
import { bootstrapServer } from './bootstrap';
import {
  intro,
  outro,
  promptSelect,
  promptPath,
  spinner,
  log,
} from './prompts';
import { Logger, MediaEngineType } from '@acc/core-isomorphic';

export type CliCommand =
  | 'run'
  | 'stream'
  | 'serve'
  | 'list'
  | 'overlay'
  | 'sfx'
  | 'help'
  | 'ir-render'
  | 'studio';

export interface CliOptions {
  command?: CliCommand;
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
  conductorSandbox?: boolean;
  chunkStart?: number;
  chunkEnd?: number;
  concurrency?: number;
  traceparent?: string;
  mediaEngine?: MediaEngineType;
}

const KNOWN_COMMANDS = new Set<CliCommand>([
  'run',
  'stream',
  'serve',
  'list',
  'overlay',
  'sfx',
  'ir-render',
  'studio',
  'help',
]);

export function parseCliArgs(args: string[]): CliOptions {
  if (!args || args.length === 0) {
    return { command: 'help' };
  }

  const firstArg = args[0].toLowerCase();
  if (firstArg === '-h' || firstArg === '--help' || firstArg === 'help') {
    return { command: 'help' };
  }

  let command: CliCommand | undefined;
  let rawArgs = args;
  let defaultPipelineId: string | undefined;

  if (KNOWN_COMMANDS.has(firstArg as CliCommand)) {
    command = firstArg as CliCommand;
    rawArgs = args.slice(1);
  } else if (
    fs.existsSync(args[0]) ||
    args[0].startsWith('./') ||
    args[0].startsWith('../') ||
    args[0].includes('/') ||
    args[0].includes('\\')
  ) {
    command = 'run';
    defaultPipelineId = 'story';
    rawArgs = ['-c', args[0], ...args.slice(1)];
  } else {
    return { command: 'help' };
  }

  try {
    const { values, positionals } = parseArgs({
      args: rawArgs,
      options: {
        config: { type: 'string', short: 'c' },
        input: { type: 'string', short: 'i' },
        out: { type: 'string', short: 'o' },
        output: { type: 'string' },
        format: { type: 'string', short: 'f' },
        container: { type: 'string' },
        exporters: { type: 'string', short: 'e' },
        rtmp: { type: 'string', short: 'r' },
        port: { type: 'string', short: 'p' },
        duration: { type: 'string', short: 'd' },
        'dry-run': { type: 'boolean', short: 'n' },
        'chunk-start': { type: 'string' },
        'chunk-end': { type: 'string' },
        concurrency: { type: 'string', short: 'j' },
        threads: { type: 'string' },
        'conductor-url': { type: 'string', short: 'w' },
        sandbox: { type: 'boolean', short: 's' },
        traceparent: { type: 'string' },
        'trace-parent': { type: 'string' },
        engine: { type: 'string' },
        'media-engine': { type: 'string' },
        effect: { type: 'string' },
        variant: { type: 'string', short: 'v' },
        'sub-variant': { type: 'string' },
        composite: { type: 'string' },
        'custom-prompt': { type: 'string' },
        'ai-model': { type: 'string' },
        fps: { type: 'string' },
        width: { type: 'string' },
        height: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: true,
    });

    if (values.help) {
      return { command: 'help' };
    }

    const pipelineId = positionals[0]?.toLowerCase() || defaultPipelineId;
    const configPath = (values.config || values.input) as string | undefined;
    const outDir = (values.out || values.output) as string | undefined;
    const format = ((values.format || values.container) as string | undefined)?.toLowerCase();
    const mediaEngine = ((values.engine || values['media-engine']) as any) || undefined;
    const traceparent = (values.traceparent || values['trace-parent']) as string | undefined;
    const concurrencyStr = (values.concurrency || values.threads) as string | undefined;

    return {
      command,
      pipelineId,
      configPath,
      outDir,
      format,
      exporters: values.exporters
        ? (values.exporters as string).split(',').map((s) => s.trim().toLowerCase())
        : undefined,
      rtmpUrl: values.rtmp as string | undefined,
      port: values.port ? parseInt(values.port as string, 10) : undefined,
      duration: values.duration ? parseInt(values.duration as string, 10) : undefined,
      dryRun: Boolean(values['dry-run']),
      chunkStart: values['chunk-start'] ? parseInt(values['chunk-start'] as string, 10) : undefined,
      chunkEnd: values['chunk-end'] ? parseInt(values['chunk-end'] as string, 10) : undefined,
      concurrency: concurrencyStr ? parseInt(concurrencyStr, 10) : undefined,
      conductorUrl: values['conductor-url'] as string | undefined,
      conductorSandbox: Boolean(values.sandbox),
      traceparent,
      mediaEngine,
    };
  } catch (error: any) {
    Logger.error('ACC-CLI', `Invalid CLI argument: ${error.message}`);
    return { command: 'help' };
  }
}

export function printHelp(): void {
  Logger.info(
    'ACC-CLI',
    `
ACC (Automated Content Creator) - Multi-Pipeline Engine CLI v3.0

USAGE:
  acc run <pipeline_id> [options]
  acc ir-render --config <ir.json|story_dir> [options]
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
  --engine <type>            Media engine backend: bun-ffi, fluent-ffmpeg, mediabunny-server, mediabunny-client (Default: bun-ffi)
  --chunk-start <frame>      Start frame index for distributed temporal chunk rendering
  --chunk-end <frame>        End frame index for distributed temporal chunk rendering
  --traceparent <header>     W3C traceparent distributed tracing header (00-{traceId}-{spanId}-{flags})
  -h, --help                 Display this CLI guide
`
  );
}

export function listPipelines(): void {
  Logger.info(
    'ACC-CLI',
    `
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
`
  );
}

async function probeCanonicalConfig(dirPath: string): Promise<any | null> {
  const candidates = ['pipeline-ir.json', 'story-config.json', 'omnichannel-config.json'];
  for (const filename of candidates) {
    const candidatePath = path.join(dirPath, filename);
    if (fs.existsSync(candidatePath)) {
      try {
        return JSON.parse(await fs.promises.readFile(candidatePath, 'utf-8'));
      } catch { }
    }
  }
  return null;
}

export async function resolvePipelineInput(pipelineId: string, options: CliOptions): Promise<any> {
  const normId = pipelineId.toLowerCase();

  let isDirectory = false;
  let parsedFromDir: any = null;
  if (options.configPath && fs.existsSync(options.configPath)) {
    try {
      const stats = fs.statSync(options.configPath);
      isDirectory = stats.isDirectory();
      if (isDirectory) {
        parsedFromDir = await probeCanonicalConfig(options.configPath);
      }
    } catch { }
  }

  if (normId === '1' || normId === 'scraper' || normId === 'scraper-summarizer') {
    let event: any = {
      eventId: `evt_${Date.now()}`,
      sourceUrl: 'https://news.ycombinator.com',
      rawText: 'OpenAI and DeepMind announce next-generation agent architectures with sub-second latency.',
      receivedAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };
    if (parsedFromDir) {
      return parsedFromDir;
    }
    if (options.configPath && !isDirectory && (await fileExists(options.configPath))) {
      event = JSON.parse(await fs.promises.readFile(options.configPath, 'utf-8'));
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
    if (parsedFromDir) {
      return parsedFromDir;
    }
    if (options.configPath && !isDirectory && (await fileExists(options.configPath))) {
      dataset = JSON.parse(await fs.promises.readFile(options.configPath, 'utf-8'));
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
    if (parsedFromDir) {
      return { ...repurposeOpts, ...parsedFromDir };
    }
    if (options.configPath && !isDirectory && (await fileExists(options.configPath))) {
      repurposeOpts = { ...repurposeOpts, ...JSON.parse(await fs.promises.readFile(options.configPath, 'utf-8')) };
    }
    return repurposeOpts;
  }

  if (normId === '4' || normId === 'story' || normId === 'generative-storytelling' || normId === 'storyteller') {
    if (!options.configPath) {
      throw new Error(`Pipeline 'story' requires a configuration directory or story-config file. Provide one with -c or --config.`);
    }
    return options.configPath;
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
    if (parsedFromDir) {
      return parsedFromDir;
    }
    if (options.configPath && !isDirectory && (await fileExists(options.configPath))) {
      proof = JSON.parse(await fs.promises.readFile(options.configPath, 'utf-8'));
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
    if (parsedFromDir) {
      return { ...config, ...parsedFromDir };
    }
    if (options.configPath && !isDirectory && (await fileExists(options.configPath))) {
      config = { ...config, ...JSON.parse(await fs.promises.readFile(options.configPath, 'utf-8')) };
    }
    return config;
  }

  if (parsedFromDir) {
    return parsedFromDir;
  }
  if (options.configPath && !isDirectory && (await fileExists(options.configPath))) {
    try {
      return JSON.parse(await fs.promises.readFile(options.configPath, 'utf-8'));
    } catch {
      return options.configPath;
    }
  }
  return options.configPath || {};
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

export async function run(customArgs?: string[]): Promise<any> {
  const rawArgs = customArgs !== undefined ? customArgs : process.argv.slice(2);
  const options = parseCliArgs(rawArgs);

  if (rawArgs.length > 0) {
    if (options.command === 'help') {
      printHelp();
      return { success: true, command: 'help' };
    }
    if (options.command === 'list') {
      listPipelines();
      return { success: true, command: 'list' };
    }
    if (options.command === 'overlay') {
      const { runOverlayCommand } = await import('./commands/overlay');
      await runOverlayCommand(rawArgs.slice(1));
      return { success: true, command: 'overlay' };
    }
    if (options.command === 'sfx') {
      const { runSFXCommand } = await import('./commands/sfx');
      await runSFXCommand(rawArgs.slice(1));
      return { success: true, command: 'sfx' };
    }
    if (options.command === 'ir-render') {
      if (!options.configPath) {
        Logger.error('IRRenderCommand', 'Error: -c / --config <ir.json|project_dir> is required for ir-render.');
        return { success: false, error: 'Missing --config flag' };
      }
      const { handleIrRenderCommand } = await import('./commands/ir-render');
      await handleIrRenderCommand({
        input: options.configPath,
        output: options.outDir,
        engine: options.mediaEngine,
        dryRun: options.dryRun,
        chunkStart: options.chunkStart,
        chunkEnd: options.chunkEnd,
        concurrency: options.concurrency,
        traceparent: options.traceparent,
      });
      return { success: true, command: 'ir-render' };
    }
    if (options.command === 'studio') {
      const targetInput = options.configPath || rawArgs[1];
      if (!targetInput) {
        Logger.error('StudioCommand', 'Error: -c / --config <ir.json|project_dir> or positional path is required for studio.');
        return { success: false, error: 'Missing studio input path' };
      }
      const { handleStudioCommand } = await import('./commands/studio');
      const studio = await handleStudioCommand({
        input: targetInput,
        port: options.port || 3300,
        keepAlive: true,
      });
      return { success: true, command: 'studio', serverUrl: studio.getUrl() };
    }
    if (options.command === 'stream') {
      if (!options.rtmpUrl) {
        Logger.error('ACC-CLI', 'Error: --rtmp <url> is required for stream command.');
        return { success: false, error: 'Missing --rtmp flag' };
      }
      const pipelineId = options.pipelineId || 'ambient';
      Logger.info('ACC-CLI', `Initializing RTMP Live Stream for pipeline '${pipelineId}' -> ${options.rtmpUrl}`);

      if (pipelineId === '6' || pipelineId === 'ambient') {
        const ambientPipeline = new AmbientStreamPipeline();
        const duration = options.duration || 10;
        const maxFrames = Math.round(duration * 30);
        const res = await ambientPipeline.streamToRtmp(options.rtmpUrl, undefined, maxFrames);
        Logger.info('ACC-CLI', `Stream finished successfully. Pushed ${res.framesSent} frames.`);
        return { success: true, framesSent: res.framesSent };
      } else {
        throw new Error(`Pipeline '${pipelineId}' does not support live RTMP streaming.`);
      }
    }
    if (options.command === 'serve') {
      const port = options.port || 3000;
      Logger.info('ACC-CLI', `Starting Webhook Ingestion Daemon on port ${port}...`);
      const scraper = new ScraperEngine();
      const server = scraper.startWebhookServer(port);
      Logger.info('ACC-CLI', `Webhook Ingestion Daemon active on http://127.0.0.1:${port}/webhook`);
      return { success: true, server, port };
    }
    if (options.command === 'run') {
      const targetPipeline = options.pipelineId || 'story';
      const targetConfig = options.configPath || rawArgs[0];
      return await runPipeline(targetPipeline, targetConfig, options);
    }
  }

  // Interactive Clack Menu when invoked with zero arguments
  intro('ACC — Automated Content Creator');

  const commandSelection = await promptSelect<CliCommand>({
    message: 'ACC CLI command:',
    options: [
      { label: 'Run', value: 'run', hint: 'Execute a canonical pipeline (scraper, db, repurposing, story, rule, ambient)' },
      { label: 'Studio', value: 'studio', hint: 'Launch interactive Web/UI Studio preview server with live playhead scrubbing' },
      { label: 'IR-Render', value: 'ir-render', hint: 'Render directly from a Video IR v3.1 AST document or story folder' },
      { label: 'Stream', value: 'stream', hint: 'Stream live video output to RTMP ingestion endpoint' },
      { label: 'Overlay', value: 'overlay', hint: 'Generate dynamic canvas procedural visual lower thirds or overlays' },
      { label: 'SFX', value: 'sfx', hint: 'Synthesize procedural audio DSP sound effects and foley markers' },
    ],
  });

  switch (commandSelection) {
    case 'studio': {
      const configLocation = await promptPath({
        message: 'Path to Video IR document or project folder:',
        placeholder: './projects/my-video-project',
      });
      const { handleStudioCommand } = await import('./commands/studio');
      const studio = await handleStudioCommand({
        input: configLocation,
        port: options.port || 3300,
        keepAlive: true,
      });
      return { success: true, command: 'studio', serverUrl: studio.getUrl() };
    }
    case 'ir-render': {
      const configLocation = await promptPath({
        message: 'Path to Video IR document or project folder:',
        placeholder: './projects/video-ir.json',
      });
      const { handleIrRenderCommand } = await import('./commands/ir-render');
      await handleIrRenderCommand({
        input: configLocation,
      });
      return { success: true, command: 'ir-render' };
    }
    case 'overlay': {
      const { runOverlayCommand } = await import('./commands/overlay');
      await runOverlayCommand([]);
      return { success: true, command: 'overlay' };
    }
    case 'sfx': {
      const { runSFXCommand } = await import('./commands/sfx');
      await runSFXCommand([]);
      return { success: true, command: 'sfx' };
    }
    case 'stream': {
      if (!options.rtmpUrl) {
        log.error('Error: --rtmp <url> is required for stream command.');
        return { success: false, error: 'Missing --rtmp flag' };
      }
      const pipelineId = options.pipelineId || 'ambient';
      log.info(`Initializing RTMP Live Stream for pipeline '${pipelineId}' -> ${options.rtmpUrl}`);

      if (pipelineId === '6' || pipelineId === 'ambient') {
        const ambientPipeline = new AmbientStreamPipeline();
        const duration = options.duration || 10;
        const maxFrames = Math.round(duration * 30);
        const res = await ambientPipeline.streamToRtmp(options.rtmpUrl, undefined, maxFrames);
        log.success(`Stream finished successfully. Pushed ${res.framesSent} frames.`);
        return { success: true, framesSent: res.framesSent };
      } else {
        throw new Error(`Pipeline '${pipelineId}' does not support live RTMP streaming.`);
      }
    }
    case 'run': {
      const summaries = DefaultPipelineRegistry.getSummaries();
      const pipelineId = await promptSelect({
        message: 'Select Pipeline:',
        options: summaries.map((p) => {
          const aliasHint = p.aliases.length > 0 ? `Aliases: ${p.aliases.join(', ')}` : p.description || p.id;
          return {
            label: `${p.name} (${p.id})`,
            value: p.id,
            hint: aliasHint,
          };
        }),
      });

      const configLocation = await promptPath({
        message: 'Path to pipeline configuration folder or input file:',
        placeholder: './projects/config.json',
      });

      const { executionResult, outputPaths } = await runPipeline(pipelineId, configLocation);
      return {
        ...executionResult,
        success: true,
        outputPath: outputPaths[0],
        outputPaths,
      };
    }
  }
}

if (import.meta.main) {
  await bootstrapServer();
  run()
    .then(async (result) => {
      if (result?.success === false) {
        Logger.error('ACC-CLI', `❌ Render failed: ${result.error || 'Unknown error'}`);
        process.exit(1);
      } else {
        Logger.info('ACC-CLI', '✅ Pipeline execution completed successfully!');
      }
    })
    .catch((error: any) => {
      Logger.error('ACC-CLI', `❌ Execution failed: ${error}`);
      process.exit(1);
    });
}

async function runPipeline(
  pipelineSelection: string,
  configLocation?: string,
  cliOptions: CliOptions = {}
) {
  const pipelineId = (pipelineSelection || 'story').toLowerCase();
  Logger.info('ACC-CLI', `Executing Pipeline [${pipelineId}] via Orchestrator...`);

  const mergedOptions: CliOptions = { command: 'run', pipelineId, configPath: configLocation, ...cliOptions };
  const input = await resolvePipelineInput(pipelineId, mergedOptions);
  const executionResult = await DefaultPipelineRegistry.execute(pipelineId, input, {
    outDir: cliOptions.outDir,
    format: cliOptions.format,
    duration: cliOptions.duration,
    exporters: cliOptions.exporters,
    dryRun: cliOptions.dryRun,
  });

  const outputPaths = executionResult.exportResults ? extractOutputPaths(executionResult.exportResults) : [];
  if ((executionResult as any).outputFilePath && !outputPaths.includes((executionResult as any).outputFilePath)) {
    outputPaths.push((executionResult as any).outputFilePath);
  }

  Logger.info('ACC-CLI', `Pipeline [${pipelineId}] completed. Output: ${JSON.stringify(outputPaths)}`);
  return {
    ...executionResult,
    executionResult,
    outputPaths,
    success: true,
  };
}
