# Visual Storytelling Generator with Bun & Revideo

Below is the complete scaffolded project for your visual storytelling generator. It is tailored for **Bun** and uses `@revideo/core`, `@revideo/2d`, and `@revideo/renderer`.

## Step 1: Scaffolding Instructions

To initialize the project and install the exact Revideo dependencies, open your terminal and run the following commands:

```bash
# 1. Initialize a new Bun project (creates package.json, tsconfig.json, etc.)
bun init -y

# 2. Install the required Revideo packages
bun add @revideo/core @revideo/2d @revideo/renderer

# 3. Install TypeScript and Node types as dev dependencies
bun add -d typescript @types/node
```

> **Note:** If you are running on Windows, execute the commands sequentially or separate them using `;` (PowerShell) or `&&` (Command Prompt/Git Bash).

---

## Step 2: JSON Schema Interface

Create a file named `src/types.ts` to strictly type the incoming JSON configuration.

**`src/types.ts`**
```typescript
export interface CaptionConfig {
  text: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface SlideConfig {
  image: string; // Filename like "image1.jpg"
  audio: string; // Filename like "audio1.mp3"
  captions: CaptionConfig[];
}

export interface StoryConfig {
  settings: {
    width: number;
    height: number;
    fps: number;
  };
  slides: SlideConfig[];
}

// Internal types for resolved absolute file paths
export interface ResolvedSlideConfig extends Omit<SlideConfig, 'image' | 'audio'> {
  image: string;
  audio: string;
  resolvedImage: string;
  resolvedAudio: string;
}

export interface ResolvedStoryConfig {
  settings: StoryConfig['settings'];
  slides: ResolvedSlideConfig[];
}
```

---

## Step 3: The Scene Logic

Create the main scene that handles the sequential fading of images and the precise, word-by-word caption syncing with audio.

**`src/scenes/storyScene.tsx`**
```tsx
import { makeScene2D, Img, Audio, Txt } from '@revideo/2d';
import { all, waitFor, useScene, createRef } from '@revideo/core';
import type { ResolvedStoryConfig } from '../types';

export default makeScene2D(function* (view) {
  // Access variables passed programmatically from the CLI renderer
  const payload = useScene().variables.payload as ResolvedStoryConfig;
  
  if (!payload || !payload.slides) {
    return;
  }

  for (const slide of payload.slides) {
    const imgRef = createRef<Img>();
    const captionRef = createRef<Txt>();

    // 1. Add visual elements to the scene with initial 0 opacity
    view.add(
      <Img
        ref={imgRef}
        src={slide.resolvedImage}
        opacity={0}
        width={'100%'}
        height={'100%'}
      />
    );

    view.add(
      <Txt
        ref={captionRef}
        text=""
        fill="#ffffff"
        fontSize={64}
        fontFamily="Arial"
        y={(payload.settings.height / 2) - 150} // Position at the bottom
        textAlign="center"
        shadowBlur={10}
        shadowColor="rgba(0,0,0,0.8)"
      />
    );

    // Fade in the image before starting audio/captions
    yield* imgRef().opacity(1, 0.5);

    // 2. Add and auto-play the audio element precisely when visual sequence starts
    const audioRef = createRef<Audio>();
    view.add(
      <Audio
        ref={audioRef}
        src={slide.resolvedAudio}
        play={true}
      />
    );

    // 3. Sync captions word-by-word based on timestamps
    let currentTime = 0;
    for (const caption of slide.captions) {
      // Wait for the exact start time of the word
      const delay = caption.start - currentTime;
      if (delay > 0) {
        yield* waitFor(delay);
      }
      
      // Display the word
      captionRef().text(caption.text);
      
      // Wait for the duration of the word
      const duration = caption.end - caption.start;
      yield* waitFor(duration);
      
      currentTime = caption.end;
      
      // Clear word after it finishes
      captionRef().text('');
    }

    // 4. Fade out visuals gracefully
    yield* all(
      imgRef().opacity(0, 0.5),
      captionRef().opacity(0, 0.5)
    );

    // 5. Clean up nodes to prevent memory bloat in long stories
    imgRef().remove();
    captionRef().remove();
    audioRef().remove();
  }
});
```

---

## Step 4: The Project Definition and Headless Renderer / CLI

First, we need to bind the scene to a Revideo project.

**`src/project.ts`**
```typescript
import { makeProject } from '@revideo/core';
import storyScene from './scenes/storyScene';

export default makeProject({
  scenes: [storyScene],
});
```

Finally, we write the CLI runner script. It reads the local folder, safely resolves local pathing for Puppeteer using the `file://` protocol, and hands the process to Revideo's `renderVideo()`.

**`cli.ts`**
```typescript
import fs from 'fs';
import path from 'path';
import { renderVideo } from '@revideo/renderer';
import type { StoryConfig, ResolvedStoryConfig, ResolvedSlideConfig } from './src/types';
import myProject from './src/project';

async function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0];

  if (!targetDir) {
    console.error('Usage: bun run cli.ts /path/to/my-story-folder');
    process.exit(1);
  }

  const absoluteDir = path.resolve(targetDir);
  const configPath = path.join(absoluteDir, 'story-config.json');

  // Verify paths exist
  if (!fs.existsSync(absoluteDir)) {
    console.error(`Directory not found: ${absoluteDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  // Parse story-config.json
  const rawConfig = fs.readFileSync(configPath, 'utf-8');
  let config: StoryConfig;
  try {
    config = JSON.parse(rawConfig);
  } catch (error) {
    console.error('Failed to parse story-config.json:', error);
    process.exit(1);
  }

  // Resolve absolute paths for all slides (critical for Headless Chrome to load local assets)
  const resolvedSlides: ResolvedSlideConfig[] = config.slides.map(slide => {
    const resolvedImage = path.join(absoluteDir, slide.image);
    const resolvedAudio = path.join(absoluteDir, slide.audio);

    if (!fs.existsSync(resolvedImage)) {
      console.warn(`Warning: Image file not found: ${resolvedImage}`);
    }
    if (!fs.existsSync(resolvedAudio)) {
      console.warn(`Warning: Audio file not found: ${resolvedAudio}`);
    }

    // Convert local paths to file URI scheme for Revideo/Browser context
    const fileUrlImage = `file:///${resolvedImage.replace(/\\/g, '/')}`;
    const fileUrlAudio = `file:///${resolvedAudio.replace(/\\/g, '/')}`;

    return {
      ...slide,
      resolvedImage: fileUrlImage,
      resolvedAudio: fileUrlAudio,
    };
  });

  const resolvedConfig: ResolvedStoryConfig = {
    settings: config.settings,
    slides: resolvedSlides,
  };

  const outputFilePath = path.join(absoluteDir, 'output.mp4');

  console.log(`Starting headless video render for ${resolvedConfig.slides.length} slides...`);
  console.log(`Output will be saved to: ${outputFilePath}`);
  
  try {
    // Pass the imported project and programmatic variables
    await renderVideo({
      project: myProject,
      variables: { payload: resolvedConfig },
      settings: { 
        outFile: outputFilePath 
      }
    });

    console.log('Video rendering successfully completed!');
  } catch (error) {
    console.error('Render failed:', error);
    process.exit(1);
  }
}

main();
```
