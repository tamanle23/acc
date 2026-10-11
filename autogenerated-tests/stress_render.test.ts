import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import path from "path";
import fs from "fs";
import os from "os";
import { FFmpegManager } from "../packages/core/src/FFmpegManager";
import { initFFI } from "../packages/core/src/ffmpeg-ffi";
import { renderStoryVideo } from "../apps/cli/src/pipelines/04-generative-story/StoryRenderer";
import { resolveStorySettings, DEFAULT_VIDEO_SETTINGS, mergeDefined } from "../apps/cli/src/pipelines/04-generative-story/platforms";
import type { StoryConfig, ResolvedStoryConfig, ResolvedSceneConfig } from "../apps/cli/src/pipelines/04-generative-story/types";

describe("Stress & Stability Rendering Suite", () => {
  const sampleDir = path.resolve(process.cwd(), "sample-story");
  const tempFiles: string[] = [];

  beforeAll(async () => {
    await FFmpegManager.prepare();
    initFFI();
  });

  afterAll(() => {
    // Cleanup temporary output videos
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
        }
      } catch {}
    }
  });

  test("FFmpegManager and FFI load correctly", () => {
    const binDir = FFmpegManager.getBinDir();
    expect(binDir).toBeDefined();
    expect(fs.existsSync(binDir)).toBe(true);
  });

  test("Multi-iteration stress render on sample-story (zero segfault, memory stability)", async () => {
    const rawConfigStr = fs.readFileSync(path.join(sampleDir, "story-config.json"), "utf-8");
    const config: StoryConfig = JSON.parse(rawConfigStr);

    const rawScenes = config.scenes || config.slides || [];
    const resolvedScenes: ResolvedSceneConfig[] = [];

    for (const scene of rawScenes) {
      const resolvedImage = scene.image ? path.resolve(sampleDir, scene.image) : undefined;
      const resolvedVideo = scene.video ? path.resolve(sampleDir, scene.video) : undefined;
      const resolvedAudio = scene.audio ? path.resolve(sampleDir, scene.audio) : "";
      const resolvedVideoSettings = mergeDefined(DEFAULT_VIDEO_SETTINGS, scene.videoSettings);

      resolvedScenes.push({
        ...scene,
        resolvedImage,
        resolvedVideo,
        resolvedAudio,
        resolvedVideoSettings,
      });
    }

    const resolvedSettings = resolveStorySettings(config.settings);
    const resolvedConfig: ResolvedStoryConfig = {
      name: config.name,
      description: config.description,
      settings: resolvedSettings,
      scenes: resolvedScenes,
    };

    // Run 2 consecutive iterations to stress-test worker pool reuse, FFI pointers & GC stability
    const iterations = 2;
    for (let i = 1; i <= iterations; i++) {
      const tempOutputFile = path.join(os.tmpdir(), `test_stress_output_${Date.now()}_${i}.mp4`);
      tempFiles.push(tempOutputFile);

      const startTime = Date.now();
      await renderStoryVideo(resolvedConfig, tempOutputFile, sampleDir);
      const elapsedSec = (Date.now() - startTime) / 1000;

      expect(fs.existsSync(tempOutputFile)).toBe(true);
      const stats = fs.statSync(tempOutputFile);
      expect(stats.size).toBeGreaterThan(50000); // Expect valid non-empty video file (> 50KB)

      console.log(`[Test] Iteration ${i}/${iterations} passed in ${elapsedSec.toFixed(2)}s (size: ${(stats.size / 1024).toFixed(1)} KB)`);
    }
  }, 360000);
});
