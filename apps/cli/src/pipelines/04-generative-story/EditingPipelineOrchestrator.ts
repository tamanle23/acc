import { LegacyStoryConfigAdapter, type LegacyStoryConfig, type ExtendedPipelineIR } from '@acc/ir';
import { EditingOpFactory } from '@acc/effect-engines';
import { ColorGradingEngine } from '@acc/effect-engines';
import { SafeZoneManager } from '@acc/effect-engines';
import { AudioDuckingDSP } from '@acc/core';
import { VideoExporter, type ExportOptions, type ExportResult } from '@acc/exporters';

export interface PipelineExecutionOptions extends ExportOptions {
  enableColorGrading?: boolean;
  lutPath?: string;
  autoSafeZones?: boolean;
}

export class EditingPipelineOrchestrator {
  private videoExporter = new VideoExporter();
  private colorGradingEngine = new ColorGradingEngine();

  public async processAndRender(
    storyConfig: LegacyStoryConfig,
    options: PipelineExecutionOptions = {}
  ): Promise<{ ir: ExtendedPipelineIR; exportResult: ExportResult; filterGraphString: string }> {
    // 1. Adapter Pattern: Normalize legacy config into ExtendedPipelineIR v3.1 AST
    const ir = LegacyStoryConfigAdapter.adapt(storyConfig);

    // 2. Safe Zone Validation
    if (options.autoSafeZones !== false) {
      const platform = ir.settings.platform === 'tiktok' ? 'tiktok' : 'youtube';
      const margins = SafeZoneManager.getMargins(platform);

      // Enforce safe vertical margins on typography overlays
      for (const chunk of ir.extendedChunks) {
        for (const overlay of chunk.typographyOverlays) {
          // Adjust overlay safe boundaries
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

      // Store calculated cut time ranges
      chunk.metadata = {
        ...(chunk.metadata || {}),
        calculatedCut: cutCalc,
      };
    }

    // 4. Build FFmpeg Filter Graph for Color Grading & Sidechain Audio Ducking
    const colorFilter = this.colorGradingEngine.generateFFmpegFilter({
      lutPath: options.lutPath,
      contrast: 1.05,
      saturation: 1.1,
    });

    const duckingFilter = AudioDuckingDSP.buildSidechainFilterGraph('a_voice', 'a_bgm', 'a_out', {
      attenuationDb: ir.audioComposition.ducking.attenuationDb,
      attackMs: ir.audioComposition.ducking.attackMs,
      releaseMs: ir.audioComposition.ducking.releaseMs,
    });

    const combinedFilterGraph = `${colorFilter}; ${duckingFilter}`;

    // 5. Execute Zero-Copy Video Export Pass
    const exportResult = await this.videoExporter.export(ir, options);

    return {
      ir,
      exportResult,
      filterGraphString: combinedFilterGraph,
    };
  }
}
