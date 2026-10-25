import { EditingOpFactory } from '@acc/core';
import {
  LegacyStoryConfigAdapter,
  type LegacyStoryConfig,
  type ExtendedPipelineIR,
} from '@acc/ir';
import { SafeZoneManager } from '@acc/effect-engines';
import type { ExportOptions } from '@acc/exporters';

export interface PipelineExecutionOptions extends ExportOptions {
  enableColorGrading?: boolean;
  lutPath?: string;
  autoSafeZones?: boolean;
}

/**
 * Isolated legacy AST adapter that enriches ExtendedPipelineIR with safe-zone validation
 * and NLE cut calculations for legacy story-config consumers.
 *
 * @deprecated Use Universal Video IR documents (`VideoIRDocument`) and `RelationalDAGCompiler`.
 */
export class LegacyIRPreparationAdapter {
  public static prepareIR(
    storyConfig: LegacyStoryConfig,
    options: PipelineExecutionOptions = {}
  ): ExtendedPipelineIR {
    // 1. Adapter Pattern: Normalize legacy config into ExtendedPipelineIR v3.1 AST
    const ir = LegacyStoryConfigAdapter.adapt(storyConfig);

    // 2. Safe Zone Validation
    if (options.autoSafeZones !== false) {
      const platform = ir.settings.platform === 'tiktok' ? 'tiktok' : 'youtube';
      const margins = SafeZoneManager.getMargins(platform);

      // Enforce safe vertical margins on typography overlays
      for (const chunk of ir.extendedChunks) {
        for (const overlay of chunk.typographyOverlays) {
          if (overlay.type === 'dynamic_caption' && platform === 'tiktok') {
            overlay.stylePreset = 'tiktok';
          }
        }
      }
    }

    // 3. Strategy Factory Resolution for Cuts & Compositing
    for (const chunk of ir.extendedChunks) {
      const cutStrategy = EditingOpFactory.getCutStrategy(
        chunk.videoOffsetMs ? 'j_cut' : 'standard_cut'
      );
      const cutCalc = cutStrategy.calculateCut(chunk);

      chunk.metadata = {
        ...(chunk.metadata || {}),
        calculatedCut: cutCalc,
      };
    }

    return ir;
  }
}
