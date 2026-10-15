/**
 * Universal Auto-Config Asset Probing Types
 *
 * Implements the domain model for headless media asset discovery,
 * technical probing, and manifest synthesis across Pipelines 1–6.
 */

export interface DiscoveredVisualAsset {
  relativePath: string;
  absolutePath: string;
  fileName: string;
  baseName: string;
  extension: string;
  type: 'image' | 'video';
  sizeBytes: number;
  width?: number;
  height?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5' | 'custom';
  durationMs?: number;
  fps?: number;
  codec?: string;
}

export interface DiscoveredAudioAsset {
  relativePath: string;
  absolutePath: string;
  fileName: string;
  baseName: string;
  extension: string;
  sizeBytes: number;
  durationMs?: number;
  channels?: number;
  sampleRate?: number;
  classification: 'music' | 'voiceover' | 'sfx' | 'ambient' | 'unknown';
}

export interface DiscoveredScriptAsset {
  relativePath: string;
  absolutePath: string;
  fileName: string;
  extension: string;
  content: string;
  lines: string[];
  wordCount: number;
  estimatedSpeechDurationMs: number;
}

export interface DiscoveredDataAsset {
  relativePath: string;
  absolutePath: string;
  fileName: string;
  extension: 'csv' | 'json';
  rowCount: number;
  headers?: string[];
  sampleData?: unknown;
}

export interface DiscoveredAssetManifest {
  baseDir: string;
  scannedAt: number;
  visuals: DiscoveredVisualAsset[];
  audio: DiscoveredAudioAsset[];
  scripts: DiscoveredScriptAsset[];
  data: DiscoveredDataAsset[];
  pairedPairs: Array<{
    index: number;
    visual?: DiscoveredVisualAsset;
    audio?: DiscoveredAudioAsset;
    scriptText?: string;
  }>;
  suggestedTitle: string;
  dominantVisualAspect?: '9:16' | '16:9' | '1:1';
  totalVisualCount: number;
  totalAudioCount: number;
  hasVoiceover: boolean;
  hasBackgroundMusic: boolean;
}

export interface ProberScanOptions {
  recursive?: boolean;
  maxFiles?: number;
  ignoreDirectories?: string[];
  probeDeepMetadata?: boolean;
}

/**
 * IMediaAssetProberHandler:
 * Handler interface in the Chain of Responsibility for inspecting discovered files.
 */
export interface IMediaAssetProberHandler {
  readonly id: string;
  readonly name: string;
  setNext(handler: IMediaAssetProberHandler): IMediaAssetProberHandler;
  handle(filePath: string, baseDir: string, manifest: DiscoveredAssetManifest, options?: ProberScanOptions): Promise<boolean>;
}

import type { ContentModality } from '../conductor/interfaces/IContentTaskStrategy';
import type { PipelineIR, FineGrainedVideoDirectorConfig } from '@acc/ir';

export interface ArchetypeScaffoldConfig {
  pipelineId: '1' | '2' | '3' | '4' | '5' | '6';
  canonicalPipelineId: PipelineIR['pipelineId'];
  suggestedTitle: string;
  suggestedModalities: ContentModality[];
  defaultAspect: '9:16' | '16:9' | '1:1';
  defaultFps: number;
  chunkDurationMs: number;
  theme?: string;
  archetypeNotes?: string;
}

export interface IPipelineClassifierStrategy {
  readonly pipelineId: '1' | '2' | '3' | '4' | '5' | '6';
  readonly name: string;
  readonly description: string;
  calculateConfidence(manifest: DiscoveredAssetManifest): Promise<number>;
  generateArchetypeDefaults(manifest: DiscoveredAssetManifest): ArchetypeScaffoldConfig;
}

export interface PipelineResolutionResult {
  strategy: IPipelineClassifierStrategy;
  confidence: number;
  isOverride: boolean;
  defaults: ArchetypeScaffoldConfig;
  allCandidates: Array<{
    pipelineId: string;
    name: string;
    confidence: number;
  }>;
}

export interface AutoScaffoldOptions {
  pipelineOverride?: 'auto' | '1' | '2' | '3' | '4' | '5' | '6';
  requestedModalities?: ContentModality[];
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
  fps?: 24 | 30 | 60;
  enableDepth3D?: boolean;
  enableTransitions?: boolean;
  exportLegacyStoryConfig?: boolean;
  autoTranscribeWhisper?: boolean;
  dryRun?: boolean;
  scriptingFramework?: string;
  targetDurationSec?: number;
}

export interface AutoScaffoldResult {
  pipelineId: string;
  pipelineIR: PipelineIR;
  videoConfig: FineGrainedVideoDirectorConfig;
  suggestedModalities: ContentModality[];
  legacyStoryConfig?: Record<string, unknown>;
  savedFiles: {
    pipelineIRPath?: string;
    omnichannelConfigPath?: string;
    storyConfigPath?: string;
  };
}
