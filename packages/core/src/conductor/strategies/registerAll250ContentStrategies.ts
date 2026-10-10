import { ContentStrategyRegistry } from './ContentStrategyRegistry';
import { createPhase1Strategies } from './phase1/Phase1StaticWebStrategies';
import { createPhase2Strategies } from './phase2/Phase2SocialStrategies';
import { createPhase3Strategies } from './phase3/Phase3VideoStrategies';
import { createPhase4Strategies } from './phase4/Phase4AudioStrategies';
import { createPhase5Strategies } from './phase5/Phase5InteractiveStrategies';

/**
 * Registers all 250 concrete content task strategies across all 5 modalities
 * into the central ContentStrategyRegistry.
 */
export function registerAll250ContentStrategies(): void {
  ContentStrategyRegistry.clear();

  // Phase 1: Items 1 to 50 (Static Web CMS)
  ContentStrategyRegistry.registerAll(createPhase1Strategies());

  // Phase 2: Items 51 to 100 (Social Media Automation)
  ContentStrategyRegistry.registerAll(createPhase2Strategies());

  // Phase 3: Items 101 to 150 (Short-Form & Long-Form Video)
  ContentStrategyRegistry.registerAll(createPhase3Strategies());

  // Phase 4: Items 151 to 200 (Audio & Podcasts)
  ContentStrategyRegistry.registerAll(createPhase4Strategies());

  // Phase 5: Items 201 to 250 (Interactive Web & Logic)
  ContentStrategyRegistry.registerAll(createPhase5Strategies());
}
