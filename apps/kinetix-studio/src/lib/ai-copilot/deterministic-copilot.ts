// ============================================================================
// KINETIX STUDIO v6.0 - DETERMINISTIC AI CREATIVE CO-PILOT (ECMA-429)
// 100% offline, zero-network rule generator producing 3 curated Director Takes.
// ============================================================================

import type { StudioState } from '@/types/studio';
import type { DirectorTake, CreativeBrief } from '@/core/domain/ai-copilot/copilot-types';
import { CopilotPipeline } from '@/core/domain/ai-copilot/copilot-pipeline';

export class DeterministicCopilot {
  private readonly pipeline = new CopilotPipeline();

  /**
   * Generates 3 curated Director Takes deterministically without any network or external LLM.
   */
  public async generateTakes(prompt: string, baseState: StudioState): Promise<DirectorTake[]> {
    const brief: CreativeBrief = {
      prompt: prompt.trim(),
    };

    return this.pipeline.run(brief, baseState);
  }
}

export const deterministicCopilot = new DeterministicCopilot();
