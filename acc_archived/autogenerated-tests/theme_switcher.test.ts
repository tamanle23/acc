import { describe, it, expect } from "bun:test";
import { THEME_PRESETS, createThemeStore } from "../apps/ai-supervisor/src/ui/stores/themeStore";

describe("ThemeSwitcher & Popular Theme Presets", () => {
  it("provides comprehensive popular theme presets", () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(8);

    const presetIds = THEME_PRESETS.map((p) => p.id);
    expect(presetIds).toContain("cyber-dark");
    expect(presetIds).toContain("tokyo-night");
    expect(presetIds).toContain("catppuccin-mocha");
    expect(presetIds).toContain("nord");
    expect(presetIds).toContain("dracula");
    expect(presetIds).toContain("monokai");
    expect(presetIds).toContain("solarized-dark");
    expect(presetIds).toContain("minimal-light");

    for (const preset of THEME_PRESETS) {
      expect(preset.name).toBeDefined();
      expect(preset.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.cssVars["--bg-canvas"]).toBeDefined();
      expect(preset.cssVars["--bg-surface"]).toBeDefined();
      expect(preset.cssVars["--text-primary"]).toBeDefined();
      expect(preset.cssVars["--accent-primary"]).toBeDefined();
    }
  });

  it("initializes theme store with default preset and allows switching", () => {
    const store = createThemeStore();
    expect(store.activeThemeId()).toBe("cyber-dark");
    expect(store.currentTheme().name).toBe("Cyberpunk Cyan");

    store.setTheme("dracula");
    expect(store.activeThemeId()).toBe("dracula");
    expect(store.currentTheme().name).toBe("Dracula Vamp");
    expect(store.currentTheme().primaryColor).toBe("#ff79c6");

    store.setTheme("nord");
    expect(store.activeThemeId()).toBe("nord");
    expect(store.currentTheme().name).toBe("Nord Frost");
  });
});
