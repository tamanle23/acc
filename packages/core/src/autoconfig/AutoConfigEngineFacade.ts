import fs from 'fs';
import path from 'path';
import { MediaAssetProberChain } from './MediaAssetProberChain';
import { PipelineClassifierRegistry } from './PipelineClassifierRegistry';
import { PipelineIRBuilder } from './builders/PipelineIRBuilder';
import { DirectorPresetFactory } from './factories/DirectorPresetFactory';
import { AutoConfigLegacyBridgeAdapter } from './adapters/AutoConfigLegacyBridgeAdapter';
import type {
  AutoScaffoldOptions,
  AutoScaffoldResult,
  DiscoveredAssetManifest,
  PipelineResolutionResult,
} from './types';
import { Logger } from '../logger';

/**
 * AutoConfigEngineFacade (GoF Facade Pattern)
 *
 * Provides a unified, high-level API to automate the end-to-end media discovery,
 * pipeline archetype classification, Universal PipelineIR construction,
 * fine-grained cinematography configuration, and dual legacy bridge file generation.
 */
export class AutoConfigEngineFacade {
  /**
   * Non-destructive inspection of a media directory.
   * Performs technical probing and heuristic archetype scoring without writing files.
   */
  public static async inspectDirectory(
    dirPath: string
  ): Promise<{ manifest: DiscoveredAssetManifest; resolution: PipelineResolutionResult }> {
    const resolvedDir = path.resolve(dirPath);
    if (!fs.existsSync(resolvedDir)) {
      throw new Error(`Target directory does not exist: ${resolvedDir}`);
    }

    const proberChain = MediaAssetProberChain.createDefault();
    const manifest = await proberChain.probeDirectory(resolvedDir);
    const resolution = PipelineClassifierRegistry.resolve(manifest);

    return { manifest, resolution };
  }

  /**
   * Universal autonomous project scaffolding.
   * Chains Prober -> Classifier Registry -> PipelineIR Builder -> Director Preset Factory -> Legacy Bridge Adapter.
   *
   * Emits project artifacts:
   * 1. pipeline-ir.json (Universal PipelineIR v3.0.0 AST)
   * 2. omnichannel-config.json (Omnichannel fine-grained director configurations)
   * 3. story-config.json (Legacy bridge format for backwards compatibility)
   */
  public static async scaffoldDirectory(
    dirPath: string,
    options: AutoScaffoldOptions = {}
  ): Promise<AutoScaffoldResult> {
    const resolvedDir = path.resolve(dirPath);
    if (!fs.existsSync(resolvedDir)) {
      throw new Error(`Target directory does not exist: ${resolvedDir}`);
    }

    Logger.info('AutoConfigEngineFacade', `Scaffolding media directory: ${resolvedDir}`);

    // 1. Media Discovery via Prober Chain
    const proberChain = MediaAssetProberChain.createDefault();
    const manifest = await proberChain.probeDirectory(resolvedDir);

    // 2. Heuristic Pipeline Archetype Resolution
    const resolution = PipelineClassifierRegistry.resolve(manifest, options.pipelineOverride);
    Logger.info(
      'AutoConfigEngineFacade',
      `Resolved Pipeline ${resolution.strategy.pipelineId} (${resolution.strategy.name}) with ${(resolution.confidence * 100).toFixed(1)}% confidence`
    );

    // 3. PipelineIR AST Synthesis via Builder
    let projectTitle = manifest.suggestedTitle || resolution.defaults.suggestedTitle;
    const existingStoryConfigPath = path.join(resolvedDir, 'story-config.json');
    if (fs.existsSync(existingStoryConfigPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(existingStoryConfigPath, 'utf-8'));
        if (raw?.name) projectTitle = raw.name;
      } catch {
        // Ignore unparseable file
      }
    }

    const builder = new PipelineIRBuilder(resolution.defaults.canonicalPipelineId);
    builder.populateFromManifest(manifest, resolution.defaults);
    builder.setTitle(projectTitle);
    if (options.aspectRatio) {
      builder.setDistributionHints({ targetAspectRatios: [options.aspectRatio] });
    }
    const pipelineIR = builder.build();

    // 4. Fine-Grained Video Director Config Synthesis via Factory
    const videoConfig = DirectorPresetFactory.createForArchetype(
      resolution.strategy.pipelineId,
      manifest,
      options
    );

    // 5. Legacy StoryConfig Synthesis via Adapter (if requested)
    let legacyStoryConfig: Record<string, unknown> | undefined;
    if (options.exportLegacyStoryConfig !== false) {
      const storyConfig = AutoConfigLegacyBridgeAdapter.toStoryConfig(
        pipelineIR,
        videoConfig,
        manifest
      );
      legacyStoryConfig = storyConfig as unknown as Record<string, unknown>;
    }

    // 6. Persistence & File Output (unless dryRun)
    const savedFiles: AutoScaffoldResult['savedFiles'] = {};

    if (!options.dryRun) {
      // 6a. Emit pipeline-ir.json
      const pipelineIRPath = path.join(resolvedDir, 'pipeline-ir.json');
      fs.writeFileSync(pipelineIRPath, JSON.stringify(pipelineIR, null, 2), 'utf-8');
      savedFiles.pipelineIRPath = pipelineIRPath;

      // 6b. Emit omnichannel-config.json
      const omnichannelConfigPath = path.join(resolvedDir, 'omnichannel-config.json');
      const omnichannelPayload = {
        title: pipelineIR.metadata.title,
        pipelineId: resolution.strategy.pipelineId,
        canonicalPipeline: resolution.defaults.canonicalPipelineId,
        suggestedModalities: options.requestedModalities || resolution.defaults.suggestedModalities,
        videoConfig,
      };
      fs.writeFileSync(omnichannelConfigPath, JSON.stringify(omnichannelPayload, null, 2), 'utf-8');
      savedFiles.omnichannelConfigPath = omnichannelConfigPath;

      // 6c. Emit story-config.json
      if (legacyStoryConfig) {
        const storyConfigPath = path.join(resolvedDir, 'story-config.json');
        fs.writeFileSync(storyConfigPath, JSON.stringify(legacyStoryConfig, null, 2), 'utf-8');
        savedFiles.storyConfigPath = storyConfigPath;
      }
    }

    return {
      pipelineId: resolution.strategy.pipelineId,
      pipelineIR,
      videoConfig,
      suggestedModalities: options.requestedModalities || resolution.defaults.suggestedModalities,
      legacyStoryConfig,
      savedFiles,
    };
  }
}
