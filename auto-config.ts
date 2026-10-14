#!/usr/bin/env bun
import fs from 'fs';
import path from 'path';
import * as prompt from '@clack/prompts';
import {
  AutoConfigEngineFacade,
  PipelineClassifierRegistry,
  Logger,
  type AutoScaffoldOptions,
  type ContentModality,
} from '@acc/core';

// Parse command line arguments
const args = process.argv.slice(2);
const isAutoYes = args.includes('--yes') || args.includes('-y');
const isDryRun = args.includes('--dry-run') || args.includes('-n');

function getArgValue(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  const prefix = `${flag}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

// Target directory resolution
let targetDirArg = args.find((a) => !a.startsWith('-'));
if (!targetDirArg) {
  targetDirArg = getArgValue('--dir') || './sample-story';
}
const targetDir = path.resolve(process.cwd(), targetDirArg);

// CLI Flags
const pipelineOverride = getArgValue('--pipeline') as AutoScaffoldOptions['pipelineOverride'];
const frameworkOverride = getArgValue('--framework');
const durationOverride = getArgValue('--duration') ? parseFloat(getArgValue('--duration')!) : undefined;
const aspectOverride = getArgValue('--aspect') as AutoScaffoldOptions['aspectRatio'];
const fpsOverride = getArgValue('--fps') ? (parseInt(getArgValue('--fps')!, 10) as 24 | 30 | 60) : undefined;
const depthArg = args.includes('--depth') ? true : args.includes('--no-depth') ? false : undefined;
const transitionsArg = args.includes('--transitions') ? true : args.includes('--no-transitions') ? false : undefined;

async function run(): Promise<void> {
  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Target directory does not exist: ${targetDir}`);
    process.exit(1);
  }

  if (isAutoYes) {
    // Non-interactive automated execution
    Logger.info('auto-config', `Running in non-interactive mode for: ${targetDir}`);
    const result = await AutoConfigEngineFacade.scaffoldDirectory(targetDir, {
      pipelineOverride: pipelineOverride || (frameworkOverride ? '4' : 'auto'),
      aspectRatio: aspectOverride,
      fps: fpsOverride,
      enableDepth3D: depthArg,
      enableTransitions: transitionsArg,
      dryRun: isDryRun,
      scriptingFramework: frameworkOverride,
      targetDurationSec: durationOverride,
    });

    Logger.info('auto-config', `✅ Scaffolding complete for Pipeline ${result.pipelineId}`);
    if (result.savedFiles.pipelineIRPath) {
      Logger.info('auto-config', `  - PipelineIR: ${result.savedFiles.pipelineIRPath}`);
    }
    if (result.savedFiles.omnichannelConfigPath) {
      Logger.info('auto-config', `  - Omnichannel Config: ${result.savedFiles.omnichannelConfigPath}`);
    }
    if (result.savedFiles.storyConfigPath) {
      Logger.info('auto-config', `  - Legacy Story Config: ${result.savedFiles.storyConfigPath}`);
    }
    return;
  }

  // Interactive Clack UI
  prompt.intro(`┌─────────────────────────────────────────────────────────────┐\n│         ACC Universal Auto-Config Engine (v3.0)            │\n└─────────────────────────────────────────────────────────────┘`);

  const spin = prompt.spinner();
  spin.start(`Inspecting media assets in: ${targetDir}...`);

  const { manifest, resolution } = await AutoConfigEngineFacade.inspectDirectory(targetDir);
  spin.stop(`Asset discovery complete.`);

  // Display discovered media overview
  const visualSummary = `${manifest.visuals.length} visual(s)`;
  const audioSummary = `${manifest.audio.length} audio file(s)`;
  const scriptSummary = `${manifest.scripts.length} script(s)`;
  const dataSummary = `${manifest.data.length} data file(s)`;
  prompt.log.info(`Discovered: ${visualSummary}, ${audioSummary}, ${scriptSummary}, ${dataSummary}`);

  const confidencePct = Math.round(resolution.confidence * 100);
  prompt.log.success(
    `Heuristic Classification: Pipeline ${resolution.strategy.pipelineId} (${resolution.strategy.name}) [${confidencePct}% Confidence]`
  );

  // Pipeline selection prompt
  let chosenPipeline = resolution.strategy.pipelineId;
  const confirmPipeline = await prompt.confirm({
    message: `Proceed with Pipeline ${resolution.strategy.pipelineId} (${resolution.strategy.name})?`,
    initialValue: true,
  });

  if (prompt.isCancel(confirmPipeline)) {
    prompt.cancel('Operation cancelled.');
    process.exit(0);
  }

  if (!confirmPipeline) {
    const allStrategies = PipelineClassifierRegistry.list();
    const selection = await prompt.select({
      message: 'Select target Canonical Pipeline archetype:',
      options: allStrategies.map((s) => ({
        label: `Pipeline ${s.pipelineId}: ${s.name} - ${s.description}`,
        value: s.pipelineId,
      })),
    });

    if (prompt.isCancel(selection)) {
      prompt.cancel('Operation cancelled.');
      process.exit(0);
    }
    chosenPipeline = selection as '1' | '2' | '3' | '4' | '5' | '6';
  }

  // Aspect ratio prompt
  const chosenAspect = await prompt.select({
    message: 'Select Target Aspect Ratio:',
    options: [
      { label: '9:16 (Vertical - TikTok / Instagram Reels / YouTube Shorts)', value: '9:16' },
      { label: '16:9 (Horizontal - YouTube / Television)', value: '16:9' },
      { label: '1:1 (Square - Instagram Feed / LinkedIn)', value: '1:1' },
      { label: '4:5 (Portrait - Instagram Portrait)', value: '4:5' },
    ],
    initialValue: aspectOverride || resolution.defaults.defaultAspect || '9:16',
  });

  if (prompt.isCancel(chosenAspect)) {
    prompt.cancel('Operation cancelled.');
    process.exit(0);
  }

  // Deliverable Modalities prompt
  const chosenModalities = await prompt.multiselect({
    message: 'Select Deliverable Modalities to scaffold:',
    options: [
      { label: 'Video (Rendered MP4 via Universal Video IR)', value: 'video' },
      { label: 'Social Media (Twitter Threads & LinkedIn Carousel)', value: 'social' },
      { label: 'Audio Broadcast (Podcasts & Voice Notes)', value: 'audio' },
      { label: 'Static Web (Markdown / HTML Articles)', value: 'web' },
      { label: 'Interactive Web (HTML5 Interactive Widgets & Logic)', value: 'interactive' },
    ],
    initialValues: resolution.defaults.suggestedModalities as string[],
    required: true,
  });

  if (prompt.isCancel(chosenModalities)) {
    prompt.cancel('Operation cancelled.');
    process.exit(0);
  }

  // Narrative Scripting Framework resolution
  let chosenFramework = frameworkOverride;
  if (!chosenFramework && (chosenPipeline === '4' || (chosenModalities as string[]).includes('video'))) {
    const { ScriptingFrameworkRegistry } = await import('@acc/core');
    const frameworks = ScriptingFrameworkRegistry.list();
    const selectFramework = await prompt.select({
      message: 'Select Narrative Scripting Framework (Pacing & Emotional Arc):',
      options: [
        { label: 'Auto (Heuristic classification from topic/content)', value: 'auto' },
        ...frameworks.map((f) => ({
          label: `${f.name} (${f.id}) - ${f.targetStyles.join(', ')}`,
          value: f.id,
        })),
      ],
      initialValue: 'auto',
    });

    if (prompt.isCancel(selectFramework)) {
      prompt.cancel('Operation cancelled.');
      process.exit(0);
    }
    chosenFramework = selectFramework === 'auto' ? undefined : (selectFramework as string);
  }

  const scaffoldSpin = prompt.spinner();
  scaffoldSpin.start('Synthesizing Universal PipelineIR, Director Config, and Legacy Bridge...');

  const result = await AutoConfigEngineFacade.scaffoldDirectory(targetDir, {
    pipelineOverride: chosenPipeline,
    aspectRatio: chosenAspect as AutoScaffoldOptions['aspectRatio'],
    requestedModalities: chosenModalities as ContentModality[],
    fps: fpsOverride,
    enableDepth3D: depthArg,
    enableTransitions: transitionsArg,
    dryRun: isDryRun,
    scriptingFramework: chosenFramework,
    targetDurationSec: durationOverride,
  });

  scaffoldSpin.stop('Synthesized project configurations successfully!');

  if (!isDryRun) {
    prompt.log.step('Saved Artifacts:');
    if (result.savedFiles.pipelineIRPath) {
      prompt.log.message(`  ✔ ${result.savedFiles.pipelineIRPath} (Universal PipelineIR v3.0.0)`);
    }
    if (result.savedFiles.omnichannelConfigPath) {
      prompt.log.message(`  ✔ ${result.savedFiles.omnichannelConfigPath} (Director Video Config)`);
    }
    if (result.savedFiles.storyConfigPath) {
      prompt.log.message(`  ✔ ${result.savedFiles.storyConfigPath} (Legacy story-config.json Bridge)`);
    }

    prompt.log.info(
      `Render instantly with:\n  bun run cli.ts "${path.relative(process.cwd(), targetDir)}" --omnichannel`
    );
  } else {
    prompt.log.info('Dry run completed. No files were written.');
  }

  prompt.outro('Autonomous Scaffolding Complete! 🚀');
}

run().catch((err) => {
  console.error('Auto-config failed:', err);
  process.exit(1);
});
