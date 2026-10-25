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
    "--bg-canvas-image": string;
    "--bg-surface": string;
    "--bg-surface-elevated": string;
    "--surface-backdrop": string;
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

const standardDarkVars = (
  canvas: string,
  surface: string,
  elevated: string,
  borderSubtle: string,
  borderFocus: string,
  textPrimary: string,
  textMuted: string,
  accentPrimary: string,
  accentHover: string,
  accentSubtle: string,
  accentGlow: string
) => ({
  "--bg-canvas": canvas,
  "--bg-canvas-image": "none",
  "--bg-surface": surface,
  "--bg-surface-elevated": elevated,
  "--surface-backdrop": "none",
  "--border-subtle": borderSubtle,
  "--border-focus": borderFocus,
  "--text-primary": textPrimary,
  "--text-muted": textMuted,
  "--accent-primary": accentPrimary,
  "--accent-hover": accentHover,
  "--accent-subtle": accentSubtle,
  "--accent-glow": accentGlow,
  "--card-shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)",
});

const standardLightVars = (
  canvas: string,
  surface: string,
  elevated: string,
  borderSubtle: string,
  borderFocus: string,
  textPrimary: string,
  textMuted: string,
  accentPrimary: string,
  accentHover: string,
  accentSubtle: string,
  accentGlow: string,
  shadow: string = "0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)"
) => ({
  "--bg-canvas": canvas,
  "--bg-canvas-image": "none",
  "--bg-surface": surface,
  "--bg-surface-elevated": elevated,
  "--surface-backdrop": "none",
  "--border-subtle": borderSubtle,
  "--border-focus": borderFocus,
  "--text-primary": textPrimary,
  "--text-muted": textMuted,
  "--accent-primary": accentPrimary,
  "--accent-hover": accentHover,
  "--accent-subtle": accentSubtle,
  "--accent-glow": accentGlow,
  "--card-shadow": shadow,
});

/**
 * Enterprise Theme Presets strictly compliant with WCAG 2 Level AAA:
 * - All text-primary & text-muted guarantee >= 7.0:1 contrast on both --bg-surface and --bg-surface-elevated.
 * - Liquid Glass integrates optical refraction, backdrop-filter, and specular bezel directly into cssVars.
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
    cssVars: standardDarkVars(
      "#020617",
      "#0f172a",
      "#1e293b",
      "#334155",
      "#06b6d4",
      "#f8fafc",
      "#cbd5e1",
      "#06b6d4",
      "#0891b2",
      "rgba(6, 182, 212, 0.15)",
      "rgba(6, 182, 212, 0.4)"
    ),
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    category: "dark",
    primaryColor: "#7aa2f7",
    accentColor: "#bb9af7",
    canvasBg: "#16161e",
    surfaceBg: "#1a1b26",
    cssVars: standardDarkVars(
      "#16161e",
      "#1a1b26",
      "#24283b",
      "#414868",
      "#7aa2f7",
      "#e0e6fc",
      "#b0b8dd",
      "#7aa2f7",
      "#89ddff",
      "rgba(122, 162, 247, 0.15)",
      "rgba(122, 162, 247, 0.4)"
    ),
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    category: "dark",
    primaryColor: "#cba6f7",
    accentColor: "#f5c2e7",
    canvasBg: "#11111b",
    surfaceBg: "#1e1e2e",
    cssVars: standardDarkVars(
      "#11111b",
      "#1e1e2e",
      "#313244",
      "#45475a",
      "#cba6f7",
      "#cdd6f4",
      "#bac2de",
      "#cba6f7",
      "#b4befe",
      "rgba(203, 166, 247, 0.15)",
      "rgba(203, 166, 247, 0.4)"
    ),
  },
  {
    id: "nord",
    name: "Nord Frost",
    category: "dark",
    primaryColor: "#88c0d0",
    accentColor: "#81a1c1",
    canvasBg: "#242933",
    surfaceBg: "#2e3440",
    cssVars: standardDarkVars(
      "#242933",
      "#2e3440",
      "#3b4252",
      "#4c566a",
      "#88c0d0",
      "#eceff4",
      "#d8dee9",
      "#88c0d0",
      "#8fbcbb",
      "rgba(136, 192, 208, 0.15)",
      "rgba(136, 192, 208, 0.4)"
    ),
  },
  {
    id: "dracula",
    name: "Dracula Vamp",
    category: "dark",
    primaryColor: "#ff79c6",
    accentColor: "#bd93f9",
    canvasBg: "#191a21",
    surfaceBg: "#282a36",
    cssVars: standardDarkVars(
      "#191a21",
      "#282a36",
      "#3a3d4f",
      "#6272a4",
      "#ff79c6",
      "#f8f8f2",
      "#cfd5ed",
      "#ff79c6",
      "#ff92d0",
      "rgba(255, 121, 198, 0.15)",
      "rgba(255, 121, 198, 0.4)"
    ),
  },
  {
    id: "monokai",
    name: "Monokai Pro",
    category: "dark",
    primaryColor: "#a9dc76",
    accentColor: "#ffd866",
    canvasBg: "#19181a",
    surfaceBg: "#221f22",
    cssVars: standardDarkVars(
      "#19181a",
      "#221f22",
      "#2d2a2e",
      "#403e41",
      "#ffd866",
      "#fcfcfa",
      "#c4c3c4",
      "#a9dc76",
      "#78dce8",
      "rgba(169, 220, 118, 0.15)",
      "rgba(169, 220, 118, 0.4)"
    ),
  },
  {
    id: "solarized-dark",
    name: "Solarized Emerald",
    category: "dark",
    primaryColor: "#2aa198",
    accentColor: "#859900",
    canvasBg: "#00212b",
    surfaceBg: "#002b36",
    cssVars: standardDarkVars(
      "#00212b",
      "#002b36",
      "#073642",
      "#586e75",
      "#2aa198",
      "#fdf6e3",
      "#b8c5c5",
      "#2aa198",
      "#268bd2",
      "rgba(42, 161, 152, 0.15)",
      "rgba(42, 161, 152, 0.4)"
    ),
  },

  // ==================== LIGHT THEMES (WCAG AAA) ====================
  {
    id: "minimal-light",
    name: "Atelier Light",
    category: "light",
    primaryColor: "#0284c7",
    accentColor: "#0369a1",
    canvasBg: "#eef2f6",
    surfaceBg: "#ffffff",
    cssVars: standardLightVars(
      "#eef2f6",
      "#ffffff",
      "#e2e8f0",
      "#cbd5e1",
      "#0284c7",
      "#050811",
      "#1e293b",
      "#0284c7",
      "#0369a1",
      "rgba(2, 132, 199, 0.12)",
      "rgba(2, 132, 199, 0.3)"
    ),
  },
  {
    id: "nord-light",
    name: "Nord Snow Storm",
    category: "light",
    primaryColor: "#5e81ac",
    accentColor: "#81a1c1",
    canvasBg: "#d8dee9",
    surfaceBg: "#ffffff",
    cssVars: standardLightVars(
      "#d8dee9",
      "#ffffff",
      "#e5e9f0",
      "#94a3b8",
      "#5e81ac",
      "#050811",
      "#1e293b",
      "#5e81ac",
      "#4c566a",
      "rgba(94, 129, 172, 0.14)",
      "rgba(94, 129, 172, 0.35)",
      "0 1px 3px 0 rgba(0, 0, 0, 0.09), 0 1px 2px -1px rgba(0, 0, 0, 0.09)"
    ),
  },
  {
    id: "solarized-light",
    name: "Solarized Paper",
    category: "light",
    primaryColor: "#268bd2",
    accentColor: "#2aa198",
    canvasBg: "#eee8d5",
    surfaceBg: "#fdf6e3",
    cssVars: standardLightVars(
      "#eee8d5",
      "#fdf6e3",
      "#e0dac3",
      "#93a1a1",
      "#268bd2",
      "#002b36",
      "#073642",
      "#268bd2",
      "#2aa198",
      "rgba(38, 139, 210, 0.14)",
      "rgba(38, 139, 210, 0.35)"
    ),
  },
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    category: "light",
    primaryColor: "#8839ef",
    accentColor: "#1e66f5",
    canvasBg: "#ccd0da",
    surfaceBg: "#eff1f5",
    cssVars: standardLightVars(
      "#ccd0da",
      "#eff1f5",
      "#dce0e8",
      "#9ca0b0",
      "#8839ef",
      "#050811",
      "#1e293b",
      "#8839ef",
      "#7287fd",
      "rgba(136, 57, 239, 0.12)",
      "rgba(136, 57, 239, 0.35)",
      "0 1px 3px 0 rgba(0, 0, 0, 0.09), 0 1px 2px -1px rgba(0, 0, 0, 0.09)"
    ),
  },

  // ==================== LIQUID GLASS FROSTED (DEEPLY INTEGRATED PRESET) ====================
  {
    id: "liquid-glass-frosted",
    name: "Liquid Glass (Frosted Light)",
    category: "light",
    primaryColor: "#0284c7",
    accentColor: "#38bdf8",
    canvasBg: "#edf2f7",
    surfaceBg: "rgba(255, 255, 255, 0.72)",
    cssVars: {
      "--bg-canvas": "#edf2f7",
      "--bg-canvas-image": "radial-gradient(at 0% 0%, #e0e7ff 0px, transparent 50%), radial-gradient(at 100% 100%, #bae6fd 0px, transparent 50%)",
      "--bg-surface": "rgba(255, 255, 255, 0.72)",
      "--bg-surface-elevated": "rgba(241, 245, 249, 0.85)",
      "--surface-backdrop": "blur(20px) saturate(180%)",
      "--border-subtle": "rgba(255, 255, 255, 0.85)",
      "--border-focus": "#0284c7",
      "--text-primary": "#020617",      // 19.63:1 effective contrast (AAA)
      "--text-muted": "#1e293b",        // 14.23:1 effective contrast (AAA)
      "--accent-primary": "#0284c7",
      "--accent-hover": "#0369a1",
      "--accent-subtle": "rgba(2, 132, 199, 0.12)",
      "--accent-glow": "rgba(2, 132, 199, 0.4)",
      "--card-shadow": "inset 0 1px 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.05), 0 16px 36px -4px rgba(15, 23, 42, 0.10)",
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
