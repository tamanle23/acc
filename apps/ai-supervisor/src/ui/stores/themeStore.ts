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
  };
}

/**
 * Enterprise Theme Presets compliant with WCAG 2 Level AAA:
 * - All text-primary & text-muted guarantee >= 7.0:1 contrast on both --bg-surface and --bg-surface-elevated.
 * - Essential interactive components & focus borders guarantee >= 3.0:1 graphical contrast.
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
      "--text-primary": "#f8fafc",      // 17.06:1 on surface, 13.98:1 on elevated (AAA)
      "--text-muted": "#cbd5e1",        // 12.02:1 on surface, 9.85:1 on elevated (AAA)
      "--accent-primary": "#06b6d4",
      "--accent-hover": "#0891b2",
      "--accent-subtle": "rgba(6, 182, 212, 0.15)",
      "--accent-glow": "rgba(6, 182, 212, 0.4)",
    },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    category: "dark",
    primaryColor: "#7aa2f7",
    accentColor: "#bb9af7",
    canvasBg: "#1a1b26",
    surfaceBg: "#1a1b26",
    cssVars: {
      "--bg-canvas": "#16161e",
      "--bg-surface": "#1a1b26",
      "--bg-surface-elevated": "#24283b",
      "--border-subtle": "#414868",
      "--border-focus": "#7aa2f7",
      "--text-primary": "#e0e6fc",      // 13.75:1 on surface, 11.72:1 on elevated (AAA)
      "--text-muted": "#b0b8dd",        // 8.75:1 on surface, 7.45:1 on elevated (AAA)
      "--accent-primary": "#7aa2f7",
      "--accent-hover": "#89ddff",
      "--accent-subtle": "rgba(122, 162, 247, 0.15)",
      "--accent-glow": "rgba(122, 162, 247, 0.4)",
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
      "--text-primary": "#cdd6f4",      // 11.34:1 on surface, 8.69:1 on elevated (AAA)
      "--text-muted": "#bac2de",        // 9.26:1 on surface, 7.10:1 on elevated (AAA)
      "--accent-primary": "#cba6f7",
      "--accent-hover": "#b4befe",
      "--accent-subtle": "rgba(203, 166, 247, 0.15)",
      "--accent-glow": "rgba(203, 166, 247, 0.4)",
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
      "--text-primary": "#eceff4",      // 10.84:1 on surface, 8.73:1 on elevated (AAA)
      "--text-muted": "#d8dee9",        // 9.25:1 on surface, 7.45:1 on elevated (AAA)
      "--accent-primary": "#88c0d0",
      "--accent-hover": "#8fbcbb",
      "--accent-subtle": "rgba(136, 192, 208, 0.15)",
      "--accent-glow": "rgba(136, 192, 208, 0.4)",
    },
  },
  {
    id: "dracula",
    name: "Dracula Vamp",
    category: "dark",
    primaryColor: "#ff79c6",
    accentColor: "#bd93f9",
    canvasBg: "#21222c",
    surfaceBg: "#282a36",
    cssVars: {
      "--bg-canvas": "#191a21",
      "--bg-surface": "#282a36",
      "--bg-surface-elevated": "#3a3d4f",
      "--border-subtle": "#6272a4",
      "--border-focus": "#ff79c6",
      "--text-primary": "#f8f8f2",      // 13.36:1 on surface, 10.05:1 on elevated (AAA)
      "--text-muted": "#cfd5ed",        // 9.76:1 on surface, 7.34:1 on elevated (AAA)
      "--accent-primary": "#ff79c6",
      "--accent-hover": "#ff92d0",
      "--accent-subtle": "rgba(255, 121, 198, 0.15)",
      "--accent-glow": "rgba(255, 121, 198, 0.4)",
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
      "--text-primary": "#fcfcfa",      // 15.88:1 on surface, 13.79:1 on elevated (AAA)
      "--text-muted": "#c4c3c4",        // 9.28:1 on surface, 8.06:1 on elevated (AAA)
      "--accent-primary": "#a9dc76",
      "--accent-hover": "#78dce8",
      "--accent-subtle": "rgba(169, 220, 118, 0.15)",
      "--accent-glow": "rgba(169, 220, 118, 0.4)",
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
      "--text-primary": "#fdf6e3",      // 13.92:1 on surface, 12.05:1 on elevated (AAA)
      "--text-muted": "#b8c5c5",        // 8.46:1 on surface, 7.32:1 on elevated (AAA)
      "--accent-primary": "#2aa198",
      "--accent-hover": "#268bd2",
      "--accent-subtle": "rgba(42, 161, 152, 0.15)",
      "--accent-glow": "rgba(42, 161, 152, 0.4)",
    },
  },

  // ==================== LIGHT THEMES (WCAG AAA) ====================
  {
    id: "minimal-light",
    name: "Atelier Light",
    category: "light",
    primaryColor: "#0284c7",
    accentColor: "#0369a1",
    canvasBg: "#f8fafc",
    surfaceBg: "#ffffff",
    cssVars: {
      "--bg-canvas": "#f8fafc",
      "--bg-surface": "#ffffff",
      "--bg-surface-elevated": "#f1f5f9",
      "--border-subtle": "#cbd5e1",
      "--border-focus": "#0284c7",
      "--text-primary": "#0f172a",      // 17.85:1 on surface, 16.30:1 on elevated (AAA)
      "--text-muted": "#334155",        // 10.35:1 on surface, 9.45:1 on elevated (AAA)
      "--accent-primary": "#0284c7",
      "--accent-hover": "#0369a1",
      "--accent-subtle": "rgba(2, 132, 199, 0.12)",
      "--accent-glow": "rgba(2, 132, 199, 0.3)",
    },
  },
  {
    id: "nord-light",
    name: "Nord Snow Storm",
    category: "light",
    primaryColor: "#5e81ac",
    accentColor: "#81a1c1",
    canvasBg: "#eceff4",
    surfaceBg: "#ffffff",
    cssVars: {
      "--bg-canvas": "#eceff4",
      "--bg-surface": "#ffffff",
      "--bg-surface-elevated": "#eceff4",
      "--border-subtle": "#d8dee9",
      "--border-focus": "#5e81ac",
      "--text-primary": "#2e3440",      // 12.49:1 on surface, 10.84:1 on elevated (AAA)
      "--text-muted": "#3b4252",        // 10.06:1 on surface, 8.73:1 on elevated (AAA)
      "--accent-primary": "#5e81ac",
      "--accent-hover": "#4c566a",
      "--accent-subtle": "rgba(94, 129, 172, 0.14)",
      "--accent-glow": "rgba(94, 129, 172, 0.35)",
    },
  },
  {
    id: "solarized-light",
    name: "Solarized Paper",
    category: "light",
    primaryColor: "#268bd2",
    accentColor: "#2aa198",
    canvasBg: "#eee8d5",
    surfaceBg: "#fdf6e3",
    cssVars: {
      "--bg-canvas": "#eee8d5",
      "--bg-surface": "#fdf6e3",
      "--bg-surface-elevated": "#eee8d5",
      "--border-subtle": "#d33682",
      "--border-focus": "#268bd2",
      "--text-primary": "#002b36",      // 13.92:1 on surface, 12.25:1 on elevated (AAA)
      "--text-muted": "#073642",        // 12.05:1 on surface, 10.61:1 on elevated (AAA)
      "--accent-primary": "#268bd2",
      "--accent-hover": "#2aa198",
      "--accent-subtle": "rgba(38, 139, 210, 0.14)",
      "--accent-glow": "rgba(38, 139, 210, 0.35)",
    },
  },
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    category: "light",
    primaryColor: "#8839ef",
    accentColor: "#1e66f5",
    canvasBg: "#dce0e8",
    surfaceBg: "#eff1f5",
    cssVars: {
      "--bg-canvas": "#dce0e8",
      "--bg-surface": "#eff1f5",
      "--bg-surface-elevated": "#e6e9ef",
      "--border-subtle": "#bcc0cc",
      "--border-focus": "#8839ef",
      "--text-primary": "#2b2c3d",      // 12.13:1 on surface, 11.28:1 on elevated (AAA)
      "--text-muted": "#3c3e53",        // 9.90:1 on surface, 9.21:1 on elevated (AAA)
      "--accent-primary": "#8839ef",
      "--accent-hover": "#7287fd",
      "--accent-subtle": "rgba(136, 57, 239, 0.12)",
      "--accent-glow": "rgba(136, 57, 239, 0.35)",
    },
  },
  {
    id: "liquid-glass-frosted",
    name: "Liquid Glass (Frosted Light)",
    category: "light",
    primaryColor: "#0284c7",
    accentColor: "#38bdf8",
    canvasBg: "#f0f4f9",
    surfaceBg: "rgba(255, 255, 255, 0.85)",
    cssVars: {
      "--bg-canvas": "#f0f4f9",
      "--bg-surface": "rgba(255, 255, 255, 0.85)",
      "--bg-surface-elevated": "rgba(241, 245, 249, 0.92)",
      "--border-subtle": "rgba(203, 213, 225, 0.8)",
      "--border-focus": "#0284c7",
      "--text-primary": "#090d16",      // 18.57:1 effective contrast (AAA)
      "--text-muted": "#283347",        // 12.13:1 effective contrast (AAA)
      "--accent-primary": "#0284c7",
      "--accent-hover": "#0369a1",
      "--accent-subtle": "rgba(2, 132, 199, 0.12)",
      "--accent-glow": "rgba(2, 132, 199, 0.4)",
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
