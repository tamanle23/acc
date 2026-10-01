import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import path from "path";
import fs from "fs";
import os from "os";
import { createCanvas } from "@napi-rs/canvas";
import { FFmpegManager } from "../packages/core/src/FFmpegManager";
import { initFFI } from "../packages/core/src/ffmpeg-ffi";
import { FFIVideoEncoder } from "../packages/core/src/ffmpeg-ffi/FFIVideoEncoder";
import { resolveStorySettings } from "../apps/cli/src/pipelines/04-generative-story/platforms";

describe("4K Resolution Memory & Pointer Safety Suite", () => {
  const tempFiles: string[] = [];

  beforeAll(async () => {
    await FFmpegManager.prepare();
    initFFI();
  });

  afterAll(() => {
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
  });

  test("Platform resolution caps 4K concurrency safely to prevent RAM exhaustion", () => {
    const settings4k = resolveStorySettings({
      platform: "youtube-4k",
      concurrency: "auto",
    });
    expect(settings4k.width).toBe(3840);
    expect(settings4k.height).toBe(2160);
    expect(settings4k.concurrency).toBeLessThanOrEqual(2);

    const manualClamped = resolveStorySettings({
      platform: "youtube-4k",
      concurrency: 6,
    });
    expect(manualClamped.concurrency).toBeLessThanOrEqual(3);
  });

  test("FFIVideoEncoder 4K continuous encoding maintains bounded RSS and zero segfault", async () => {
    const width = 3840;
    const height = 2160;
    const fps = 30;
    const tempOutput = path.join(os.tmpdir(), `test_4k_mem_${Date.now()}.mp4`);
    tempFiles.push(tempOutput);

    const encoder = new FFIVideoEncoder(width, height, fps, tempOutput, 20);
    encoder.initialize();

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#112233";
    ctx.fillRect(0, 0, width, height);

    const framesToEncode = 45; // 1.5s of 4K video (45 frames * 33.2MB = ~1.5 GB raw data)
    for (let f = 0; f < framesToEncode; f++) {
      ctx.fillStyle = f % 2 === 0 ? "#FF0000" : "#00FF00";
      ctx.fillRect(100, 100, 400, 200);

      const rawData = canvas.data();
      encoder.encodeRgbaFrame(rawData);

      if (f % 15 === 0) {
        if (typeof Bun !== "undefined" && (Bun as any).gc) {
          (Bun as any).gc(true);
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    encoder.close();

    expect(fs.existsSync(tempOutput)).toBe(true);
    const stats = fs.statSync(tempOutput);
    expect(stats.size).toBeGreaterThan(10000);

    const rssMb = process.memoryUsage().rss / 1024 / 1024;
    console.log(`[4K Memory Test] 45 4K frames encoded. Output size: ${(stats.size / 1024).toFixed(1)} KB. RSS: ${rssMb.toFixed(1)} MB`);
    expect(rssMb).toBeLessThan(1500); // Must remain bounded well below 1.5 GB
  }, 30000);
});
