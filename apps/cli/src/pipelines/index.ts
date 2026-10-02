import { defaultPipelineRegistry } from '@acc/core';
import { ScraperPipeline } from './01-scraper';
import { DBTemplatingPipeline } from './02-db-templating';
import { RepurposingPipeline } from './03-repurposing';
import { GenerativeStoryPipeline } from './04-generative-story/GenerativeStoryPipeline';
import { RuleLogicPipeline } from './05-rule-logic';
import { AmbientStreamPipeline } from './06-ambient-stream';

export * from './01-scraper';
export * from './02-db-templating';
export * from './03-repurposing';
export * from './04-generative-story/GenerativeStoryPipeline';
export * from './05-rule-logic';
export * from './06-ambient-stream';

export function registerAllPipelines(): void {
  defaultPipelineRegistry.register(new ScraperPipeline(), ['1', 'scraper', 'scraper-summarizer']);
  defaultPipelineRegistry.register(new DBTemplatingPipeline(), ['2', 'db', 'db-templating', 'database']);
  defaultPipelineRegistry.register(new RepurposingPipeline(), ['3', 'repurpose', 'repurposing', 'recycler']);
  defaultPipelineRegistry.register(new GenerativeStoryPipeline(), ['4', 'story', 'generative-storytelling', 'storyteller']);
  defaultPipelineRegistry.register(new RuleLogicPipeline(), ['5', 'rule', 'math', 'logic', 'rule-logic']);
  defaultPipelineRegistry.register(new AmbientStreamPipeline(), ['6', 'ambient', 'ambient-stream', 'loop']);
}

// Auto-register on module evaluation
registerAllPipelines();
