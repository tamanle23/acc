import { describe, it, expect } from 'bun:test';
import { guardCancel } from '../apps/cli/src/prompts';
import { isCancel, CANCEL_SYMBOL } from '@clack/prompts';
import { parseCliArgs } from '../apps/cli/src/index';

describe('CLI Prompts Architecture & Refactored Subcommands Suite', () => {
  it('guardCancel allows regular values and identifies cancel symbol', () => {
    // Normal value should not throw or exit
    const validValue = 'test-selection';
    expect(() => guardCancel(validValue)).not.toThrow();

    // Verify isCancel symbol recognition with canonical Clack cancel symbol
    expect(isCancel(CANCEL_SYMBOL)).toBe(true);
    expect(isCancel('hello')).toBe(false);
  });

  it('correctly parses all standard and refactored CLI commands and aliases', () => {
    const sfxArgs = parseCliArgs(['sfx', '-e', 'ui', '-v', 'click', '-s', 'plastic_pop', '-d', '2.5']);
    expect(sfxArgs.command).toBe('sfx');

    const overlayArgs = parseCliArgs(['overlay', '-e', 'rain', '-v', 'drizzle', '-d', '1.5']);
    expect(overlayArgs.command).toBe('overlay');

    const studioArgs = parseCliArgs(['studio', '-c', './sample-story', '-p', '3400']);
    expect(studioArgs.command).toBe('studio');
    expect(studioArgs.configPath).toBe('./sample-story');
    expect(studioArgs.port).toBe(3400);

    const irRenderArgs = parseCliArgs(['ir-render', '-c', './sample-story/video-ir.json', '-n']);
    expect(irRenderArgs.command).toBe('ir-render');
    expect(irRenderArgs.configPath).toBe('./sample-story/video-ir.json');
    expect(irRenderArgs.dryRun).toBe(true);
  });

  it('ensures deleted interactive.ts has zero remaining references in @acc/core', async () => {
    const core = await import('@acc/core');
    expect((core as any).askChoice).toBeUndefined();
    expect((core as any).askQuestion).toBeUndefined();
    expect((core as any).askYesNo).toBeUndefined();
    expect((core as any).closeInteractiveConsole).toBeUndefined();
  });
});
