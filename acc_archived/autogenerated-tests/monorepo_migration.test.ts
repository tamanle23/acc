import { describe, test, expect, beforeAll } from "bun:test";
import path from "path";
import fs from "fs";
import { FFmpegManager, PythonBackend, Utils } from "@acc/core";
import { RainEffect, RegistryManager as SFXRegistryManager, PRESETS as CAPTION_PRESETS } from "@acc/effect-engines";
import { resolveStorySettings, PLATFORM_PRESETS } from "../apps/cli/src/pipelines/04-generative-story/platforms";

describe("Monorepo Legacy /src Migration & Package Integrity Suite", () => {
  beforeAll(async () => {
    await FFmpegManager.prepare();
  });

  test("@acc/core exports essential utilities and FFmpegManager", () => {
    expect(FFmpegManager).toBeDefined();
    expect(FFmpegManager.getBinDir()).toBeDefined();
    expect(PythonBackend).toBeDefined();
    expect(typeof Utils.getChecksum).toBe("function");
    expect(Utils.getChecksum("test-input")).toHaveLength(8);
  });

  test("@acc/effect-engines exports overlay generators, SFX registry, and caption presets correctly", () => {
    expect(CAPTION_PRESETS).toBeDefined();
    expect(CAPTION_PRESETS.tiktok).toBeDefined();
    expect(CAPTION_PRESETS.tiktok.primaryColor).toBe("#FFFF00");

    expect(RainEffect).toBeDefined();

    const sfxRegistry = new SFXRegistryManager();
    expect(sfxRegistry).toBeDefined();
    expect(sfxRegistry.getGenerator("ui")).toBeDefined();
  });

  test("Generative Story Pipeline 04 platforms resolve settings without legacy /src", () => {
    expect(PLATFORM_PRESETS.tiktok).toBeDefined();
    expect(PLATFORM_PRESETS.tiktok.width).toBe(1080);
    expect(PLATFORM_PRESETS.tiktok.height).toBe(1920);

    const resolved = resolveStorySettings({ platform: "tiktok" });
    expect(resolved.width).toBe(1080);
    expect(resolved.height).toBe(1920);
    expect(resolved.videoCodec).toBe("h264");
  });

  test("Root CLI entrypoints load cleanly without legacy /src imports", () => {
    const cliPath = path.resolve(process.cwd(), "cli.ts");
    const autoConfigPath = path.resolve(process.cwd(), "auto-config.ts");
    const overlayCliPath = path.resolve(process.cwd(), "overlay-effects-cli.ts");
    const sfxCliPath = path.resolve(process.cwd(), "sound-effects-cli.ts");

    expect(fs.existsSync(cliPath)).toBe(true);
    expect(fs.existsSync(autoConfigPath)).toBe(true);
    expect(fs.existsSync(overlayCliPath)).toBe(true);
    expect(fs.existsSync(sfxCliPath)).toBe(true);
  });
});
