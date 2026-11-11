// ============================================================================
// KINETIX STUDIO v6.0 - WINTERTC AI CO-PILOT GATEWAY ADAPTER (ECMA-429)
// Universal standard fetch gateway with deterministic offline fallback.
// ============================================================================

import type { StudioState } from '@/types/studio';
import type { DirectorTake } from '@/core/domain/ai-copilot/copilot-types';
import { deterministicCopilot } from '@/lib/ai-copilot/deterministic-copilot';

export interface WinterTcCopilotConfig {
  readonly endpointUrl?: string;
  readonly apiKey?: string;
  readonly timeoutMs?: number;
}

export class WinterTcCopilotAdapter {
  public constructor(private readonly config: WinterTcCopilotConfig = {}) {}

  /**
   * Directs creative concepts for a prompt using remote LLM if configured,
   * otherwise deterministically runs the offline client-side Copilot pipeline.
   */
  public async directConcept(
    prompt: string,
    baseState: StudioState,
    abortSignal?: AbortSignal
  ): Promise<DirectorTake[]> {
    const { endpointUrl, apiKey, timeoutMs = 8000 } = this.config;

    // Fast-path: Offline deterministic engine if no remote endpoint configured
    if (!endpointUrl || !apiKey) {
      return deterministicCopilot.generateTakes(prompt, baseState);
    }

    // Remote WinterTC fetch call with timeout & schema validation
    try {
      const timeoutController = new AbortController();
      let combinedSignal: AbortSignal = timeoutController.signal;

      if (abortSignal) {
        if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).any === 'function') {
          combinedSignal = (AbortSignal as any).any([abortSignal, timeoutController.signal]);
        } else if (abortSignal.aborted) {
          timeoutController.abort();
        } else {
          abortSignal.addEventListener('abort', () => timeoutController.abort(), { once: true });
        }
      }

      const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

      const request = new Request(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          currentArchetype: baseState.archetypeId,
          bpm: baseState.bpm,
          format: 'kinetix-v6-director-takes',
        }),
        signal: combinedSignal,
      });

      const response = await fetch(request);
      clearTimeout(timer);

      if (!response.ok) {
        console.warn(`Upstream AI copilot returned ${response.status}, falling back to offline engine.`);
        return deterministicCopilot.generateTakes(prompt, baseState);
      }

      const json = await response.json();
      if (Array.isArray(json?.takes) && json.takes.length > 0) {
        return json.takes as DirectorTake[];
      }

      return deterministicCopilot.generateTakes(prompt, baseState);
    } catch (err) {
      console.warn('WinterTC AI Copilot remote request failed, using deterministic engine:', err);
      return deterministicCopilot.generateTakes(prompt, baseState);
    }
  }
}

export const winterTcCopilotAdapter = new WinterTcCopilotAdapter();
