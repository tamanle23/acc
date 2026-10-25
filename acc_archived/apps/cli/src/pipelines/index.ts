import { DefaultPipelineRegistry } from '@acc/core';
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
  DefaultPipelineRegistry.register(new ScraperPipeline(), ['1', 'scraper', 'scraper-summarizer']);
  DefaultPipelineRegistry.register(new DBTemplatingPipeline(), ['2', 'db', 'db-templating', 'database']);
  DefaultPipelineRegistry.register(new RepurposingPipeline(), ['3', 'repurpose', 'repurposing', 'recycler']);
  DefaultPipelineRegistry.register(new GenerativeStoryPipeline(), ['4', 'story', 'generative-storytelling', 'storyteller']);
  DefaultPipelineRegistry.register(new RuleLogicPipeline(), ['5', 'rule', 'math', 'logic', 'rule-logic']);
  DefaultPipelineRegistry.register(new AmbientStreamPipeline(), ['6', 'ambient', 'ambient-stream', 'loop']);
}

// Auto-register on module evaluation
registerAllPipelines();
