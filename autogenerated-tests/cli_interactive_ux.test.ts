import { describe, test, expect } from 'bun:test';
import { parseCliArgs, resolvePipelineInput } from '../apps/cli/src/index';

describe('CLI Interactive UX & Input Resolution', () => {
  test('parseCliArgs correctly handles help and command options', () => {
    const helpOptions = parseCliArgs(['--help']);
    expect(helpOptions.command).toBe('help');

    const runOptions = parseCliArgs(['run', 'story', '-c', './sample-story']);
    expect(runOptions.command).toBe('run');
    expect(runOptions.pipelineId).toBe('story');
    expect(runOptions.configPath).toBe('./sample-story');
  });

  test('resolvePipelineInput resolves input safely without throwing exists error', async () => {
    const input = await resolvePipelineInput('scraper', { configPath: './non-existent-file.json' });
    expect(input).toBeDefined();
    expect(input.sourceUrl).toBe('https://news.ycombinator.com');
  });
});
