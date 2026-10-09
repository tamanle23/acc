import { FFmpegManager, intro, outro, isCancel, cancel } from '@acc/core';
import { run } from '@acc/cli';
import * as prompt from '@clack/prompts';

async function main() {
  await FFmpegManager.prepare();
  const rawArgs = process.argv.slice(2);

  // If arguments are provided, delegate directly to the unified CLI runner
  if (rawArgs.length > 0) {
    const result = await run(rawArgs);
    if (rawArgs[0]?.toLowerCase() !== 'serve') {
      process.exit(result?.success === false ? 1 : 0);
    }
    return;
  }

  // Interactive Clack prompt fallback when no arguments are passed
  intro('--- ACC - Automated Content Creator ---');

  const dirPrompt = await prompt.text({
    message: 'Please enter the path to your story folder:',
    placeholder: './sample-story',
    validate: (val) => (!val || val.trim() === '' ? 'Path cannot be empty.' : undefined),
  });

  if (isCancel(dirPrompt)) {
    cancel('Operation cancelled.');
    process.exit(0);
  }

  const targetDir = (dirPrompt as string).trim().replace(/^["']|["']$/g, '');
  if (!targetDir) {
    outro('No folder path provided. Exiting.');
    process.exit(1);
  }

  try {
    const result = await run(['run', 'story', targetDir]);
    if (result?.success === false) {
      outro(`Render failed: ${result.error || 'Unknown error'}`);
      process.exit(1);
    } else {
      outro('Story generation completed successfully!');
    }
  } catch (error: any) {
    outro(`Render failed: ${error.message || error}`);
    process.exit(1);
  }
}

main();
