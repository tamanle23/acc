import { createSignal, createEffect } from "solid-js";

export type ThemePresetId =
  | "cyber-dark"
  | "tokyo-night"
  | "catppuccin-mocha"
  | "nord"
  | "monokai"
  | "solarized-dark"
  | "dracula"
  | "minimal-light"
  | "nord-light"
  | "solarized-light"
  | "catppuccin-latte"
  | "liquid-glass-frosted";

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  category: "dark" | "light";
  primaryColor: string; // Used for preview swatch
  accentColor: string;
  canvasBg: string;
  surfaceBg: string;
  cssVars: {
    "--bg-canvas": string;
    "--bg-surface": string;
    "--bg-surface-elevated": string;
    "--border-subtle": string;
    "--border-focus": string;
    "--text-primary": string;
    "--text-muted": string;
    "--accent-primary": string;
    "--accent-hover": string;
    "--accent-subtle": string;
    "--accent-glow": string;
    "--card-shadow": string;
  };
}

/**
 * Enterprise Theme Presets strictly compliant with WCAG 2 Level AAA:
 * - All text-primary & text-muted guarantee >= 7.0:1 contrast on both --bg-surface and --bg-surface-elevated.
 * - Layer separation (Canvas -> Surface -> Elevated) is distinctly calibrated with card shadows and crisp borders.
 */
export const THEME_PRESETS: readonly ThemePreset[] = [
  // ==================== DARK THEMES (WCAG AAA) ====================
  {
    id: "cyber-dark",
    name: "Cyberpunk Cyan",
    category: "dark",
    primaryColor: "#06b6d4",
    accentColor: "#22d3ee",
    canvasBg: "#020617",
    surfaceBg: "#0f172a",
    cssVars: {
      "--bg-canvas": "#020617",
      "--bg-surface": "#0f172a",
      "--bg-surface-elevated": "#1e293b",
      "--border-subtle": "#334155",
      "--border-focus": "#06b6d4",
      "--text-primary": "#f8fafc",      // 17.06:1 on surface (AAA)
      "--text-muted": "#cbd5e1",        // 12.02:1 on surface (AAA)
      "--accent-primary": "#06b6d4",
      "--accent-hover": "#0891b2",
      "--accent-subtle": "rgba(6, 182, 212, 0.15)",
      "--accent-glow": "rgba(6, 182, 212, 0.4)",
      "--card-shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)",
    },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    category: "dark",
    primaryColor: "#7aa2f7",
    accentColor: "#bb9af7",
    canvasBg: "#16161e",
    surfaceBg: "#1a1b26",
    cssVars: {
      "--bg-canvas": "#16161e",
      "--bg-surface": "#1a1b26",
      "--bg-surface-elevated": "#24283b",
      "--border-subtle": "#414868",
      "--border-focus": "#7aa2f7",
      "--text-primary": "#e0e6fc",      // 13.75:1 on surface (AAA)
      "--text-muted": "#b0b8dd",        // 8.75:1 on surface (AAA)
      "--accent-primary": "#7aa2f7",
      "--accent-hover": "#89ddff",
      "--accent-subtle": "rgba(122, 162, 247, 0.15)",
      "--accent-glow": "rgba(122, 162, 247, 0.4)",
      "--card-shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)",
    },
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    category: "dark",
    primaryColor: "#cba6f7",
    accentColor: "#f5c2e7",
    canvasBg: "#11111b",
    surfaceBg: "#1e1e2e",
    cssVars: {
      "--bg-canvas": "#11111b",
      "--bg-surface": "#1e1e2e",
      "--bg-surface-elevated": "#313244",
      "--border-subtle": "#45475a",
      "--border-focus": "#cba6f7",
      "--text-primary": "#cdd6f4",      // 11.34:1 on surface (AAA)
      "--text-muted": "#bac2de",        // 9.26:1 on surface (AAA)
      "--accent-primary": "#cba6f7",
      "--accent-hover": "#b4befe",
      "--accent-subtle": "rgba(203, 166, 247, 0.15)",
      "--accent-glow": "rgba(203, 166, 247, 0.4)",
      "--card-shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)",
    },
  },
  {
    id: "nord",
    name: "Nord Frost",
    category: "dark",
    primaryColor: "#88c0d0",
    accentColor: "#81a1c1",
    canvasBg: "#242933",
    surfaceBg: "#2e3440",
    cssVars: {
      "--bg-canvas": "#242933",
      "--bg-surface": "#2e3440",
      "--bg-surface-elevated": "#3b4252",
      "--border-subtle": "#4c566a",
      "--border-focus": "#88c0d0",
      "--text-primary": "#eceff4",      // 10.84:1 on surface (AAA)
      "--text-muted": "#d8dee9",        // 9.25:1 on surface (AAA)
      "--accent-primary": "#88c0d0",
      "--accent-hover": "#8fbcbb",
      "--accent-subtle": "rgba(136, 192, 208, 0.15)",
      "--accent-glow": "rgba(136, 192, 208, 0.4)",
      "--card-shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)",
    },
  },
  {
    id: "dracula",
    name: "Dracula Vamp",
    category: "dark",
    primaryColor: "#ff79c6",
    accentColor: "#bd93f9",
    canvasBg: "#191a21",
    surfaceBg: "#282a36",
    cssVars: {
      "--bg-canvas": "#191a21",
      "--bg-surface": "#282a36",
      "--bg-surface-elevated": "#3a3d4f",
      "--border-subtle": "#6272a4",
      "--border-focus": "#ff79c6",
      "--text-primary": "#f8f8f2",      // 13.36:1 on surface (AAA)
      "--text-muted": "#cfd5ed",        // 9.76:1 on surface (AAA)
      "--accent-primary": "#ff79c6",
      "--accent-hover": "#ff92d0",
      "--accent-subtle": "rgba(255, 121, 198, 0.15)",
      "--accent-glow": "rgba(255, 121, 198, 0.4)",
      "--card-shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)",
    },
  },
  {
    id: "monokai",
    name: "Monokai Pro",
    category: "dark",
    primaryColor: "#a9dc76",
    accentColor: "#ffd866",
    canvasBg: "#19181a",
    surfaceBg: "#221f22",
    cssVars: {
      "--bg-canvas": "#19181a",
      "--bg-surface": "#221f22",
      "--bg-surface-elevated": "#2d2a2e",
      "--border-subtle": "#403e41",
      "--border-focus": "#ffd866",
      "--text-primary": "#fcfcfa",      // 15.88:1 on surface (AAA)
      "--text-muted": "#c4c3c4",        // 9.28:1 on surface (AAA)
      "--accent-primary": "#a9dc76",
      "--accent-hover": "#78dce8",
      "--accent-subtle": "rgba(169, 220, 118, 0.15)",
      "--accent-glow": "rgba(169, 220, 118, 0.4)",
      "--card-shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)",
    },
  },
  {
    id: "solarized-dark",
    name: "Solarized Emerald",
    category: "dark",
    primaryColor: "#2aa198",
    accentColor: "#859900",
    canvasBg: "#00212b",
    surfaceBg: "#002b36",
    cssVars: {
      "--bg-canvas": "#00212b",
      "--bg-surface": "#002b36",
      "--bg-surface-elevated": "#073642",
      "--border-subtle": "#586e75",
      "--border-focus": "#2aa198",
      "--text-primary": "#fdf6e3",      // 13.92:1 on surface (AAA)
      "--text-muted": "#b8c5c5",        // 8.46:1 on surface (AAA)
      "--accent-primary": "#2aa198",
      "--accent-hover": "#268bd2",
      "--accent-subtle": "rgba(42, 161, 152, 0.15)",
      "--accent-glow": "rgba(42, 161, 152, 0.4)",
      "--card-shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)",
    },
  },

  // ==================== LIGHT THEMES (WCAG AAA + HIGH DISTINCTION) ====================
  {
    id: "minimal-light",
    name: "Atelier Light",
    category: "light",
    primaryColor: "#0284c7",
    accentColor: "#0369a1",
    canvasBg: "#eef2f6",               // Slate-150 backdrop: distinctly separated from pure white cards
    surfaceBg: "#ffffff",              // Pure crisp white card surface
    cssVars: {
      "--bg-canvas": "#eef2f6",
      "--bg-surface": "#ffffff",
      "--bg-surface-elevated": "#e2e8f0",
      "--border-subtle": "#cbd5e1",      // Crisp visible boundary
      "--border-focus": "#0284c7",
      "--text-primary": "#050811",      // 20.01:1 on surface (AAA) - ultra deep obsidian
      "--text-muted": "#1e293b",        // 14.63:1 on surface (AAA) - slate-800
      "--accent-primary": "#0284c7",
      "--accent-hover": "#0369a1",
      "--accent-subtle": "rgba(2, 132, 199, 0.12)",
      "--accent-glow": "rgba(2, 132, 199, 0.3)",
      "--card-shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)",
    },
  },
  {
    id: "nord-light",
    name: "Nord Snow Storm",
    category: "light",
    primaryColor: "#5e81ac",
    accentColor: "#81a1c1",
    canvasBg: "#d8dee9",               // Nord Polar backdrop
    surfaceBg: "#ffffff",              // Pure white cards
    cssVars: {
      "--bg-canvas": "#d8dee9",
      "--bg-surface": "#ffffff",
      "--bg-surface-elevated": "#e5e9f0",
      "--border-subtle": "#94a3b8",      // Distinct boundary
      "--border-focus": "#5e81ac",
      "--text-primary": "#050811",      // 20.01:1 on surface (AAA)
      "--text-muted": "#1e293b",        // 14.63:1 on surface (AAA)
      "--accent-primary": "#5e81ac",
      "--accent-hover": "#4c566a",
      "--accent-subtle": "rgba(94, 129, 172, 0.14)",
      "--accent-glow": "rgba(94, 129, 172, 0.35)",
      "--card-shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.09), 0 1px 2px -1px rgba(0, 0, 0, 0.09)",
    },
  },
  {
    id: "solarized-light",
    name: "Solarized Paper",
    category: "light",
    primaryColor: "#268bd2",
    accentColor: "#2aa198",
    canvasBg: "#eee8d5",               // Solarized base2 canvas
    surfaceBg: "#fdf6e3",              // Solarized base3 card surface
    cssVars: {
      "--bg-canvas": "#eee8d5",
      "--bg-surface": "#fdf6e3",
      "--bg-surface-elevated": "#e0dac3",
      "--border-subtle": "#93a1a1",      // Solarized base1 contrast boundary
      "--border-focus": "#268bd2",
      "--text-primary": "#002b36",      // 18.55:1 on surface (AAA)
      "--text-muted": "#073642",        // 13.56:1 on surface (AAA)
      "--accent-primary": "#268bd2",
      "--accent-hover": "#2aa198",
      "--accent-subtle": "rgba(38, 139, 210, 0.14)",
      "--accent-glow": "rgba(38, 139, 210, 0.35)",
      "--card-shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)",
    },
  },
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    category: "light",
    primaryColor: "#8839ef",
    accentColor: "#1e66f5",
    canvasBg: "#ccd0da",               // Catppuccin Surface0 backdrop
    surfaceBg: "#eff1f5",              // Base warm white card surface
    cssVars: {
      "--bg-canvas": "#ccd0da",
      "--bg-surface": "#eff1f5",
      "--bg-surface-elevated": "#dce0e8",
      "--border-subtle": "#9ca0b0",      // Distinct boundary
      "--border-focus": "#8839ef",
      "--text-primary": "#050811",      // 17.70:1 on surface (AAA)
      "--text-muted": "#1e293b",        // 12.94:1 on surface (AAA)
      "--accent-primary": "#8839ef",
      "--accent-hover": "#7287fd",
      "--accent-subtle": "rgba(136, 57, 239, 0.12)",
      "--accent-glow": "rgba(136, 57, 239, 0.35)",
      "--card-shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.09), 0 1px 2px -1px rgba(0, 0, 0, 0.09)",
    },
  },
  {
    id: "liquid-glass-frosted",
    name: "Liquid Glass (Frosted Light)",
    category: "light",
    primaryColor: "#0284c7",
    accentColor: "#38bdf8",
    canvasBg: "#e2e8f0",               // Subdued backdrop making translucent white cards pop
    surfaceBg: "rgba(255, 255, 255, 0.90)",
    cssVars: {
      "--bg-canvas": "#e2e8f0",
      "--bg-surface": "rgba(255, 255, 255, 0.90)",
      "--bg-surface-elevated": "rgba(241, 245, 249, 0.95)",
      "--border-subtle": "rgba(148, 163, 184, 0.8)",
      "--border-focus": "#0284c7",
      "--text-primary": "#050811",      // 20.01:1 effective contrast (AAA)
      "--text-muted": "#1e293b",        // 14.63:1 effective contrast (AAA)
      "--accent-primary": "#0284c7",
      "--accent-hover": "#0369a1",
      "--accent-subtle": "rgba(2, 132, 199, 0.12)",
      "--accent-glow": "rgba(2, 132, 199, 0.4)",
      "--card-shadow": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
    },
  },
];

const THEME_STORAGE_KEY = "acc_supervisor_theme";

export function createThemeStore() {
  const getInitialTheme = (): ThemePresetId => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (saved && THEME_PRESETS.some((p) => p.id === saved)) {
          return saved as ThemePresetId;
        }
      }
    } catch {}
    return "cyber-dark";
  };

  const [activeThemeId, setActiveThemeId] = createSignal<ThemePresetId>(getInitialTheme());

  const currentTheme = () =>
    THEME_PRESETS.find((p) => p.id === activeThemeId()) ?? THEME_PRESETS[0];

  const applyTheme = (preset: ThemePreset) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", preset.category === "dark");
    root.classList.toggle("light", preset.category === "light");
    root.classList.toggle("frosted-glass", preset.id === "liquid-glass-frosted");

    for (const [key, value] of Object.entries(preset.cssVars)) {
      root.style.setProperty(key, value);
    }
  };

  createEffect(() => {
    const theme = currentTheme();
    applyTheme(theme);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme.id);
      }
    } catch {}
  });

  const setTheme = (id: ThemePresetId) => {
    if (THEME_PRESETS.some((p) => p.id === id)) {
      setActiveThemeId(id);
    }
  };

  return {
    activeThemeId,
    currentTheme,
    presets: THEME_PRESETS,
    setTheme,
  };
}
