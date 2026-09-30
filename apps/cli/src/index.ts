export * from './pipelines/04-generative-story/GenerativeStoryPipeline';

import { defaultStoryPipeline } from './pipelines/04-generative-story/GenerativeStoryPipeline';

export async function runCli(argv = process.argv.slice(2)) {
  const storyDir = argv[0] || './sample-story';
  console.log(`[ACC-CLI] Launching Generative Storytelling Pipeline for: ${storyDir}`);
  const result = await defaultStoryPipeline.execute(storyDir);
  console.log(`[ACC-CLI] Render complete: ${result}`);
  return result;
}
