import { createSignal, createEffect } from "solid-js";

export type ThemePresetId =
  | "cyber-dark"
  | "tokyo-night"
  | "catppuccin-mocha"
  | "nord"
  | "monokai"
  | "solarized-dark"
  | "dracula"
  | "minimal-light";

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

export const THEME_PRESETS: readonly ThemePreset[] = [
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
      "--text-primary": "#f8fafc",
      "--text-muted": "#94a3b8",
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
    surfaceBg: "#24283b",
    cssVars: {
      "--bg-canvas": "#16161e",
      "--bg-surface": "#1a1b26",
      "--bg-surface-elevated": "#24283b",
      "--border-subtle": "#414868",
      "--border-focus": "#7aa2f7",
      "--text-primary": "#c0caf5",
      "--text-muted": "#7982a9",
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
      "--text-primary": "#cdd6f4",
      "--text-muted": "#a6adc8",
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
      "--text-primary": "#eceff4",
      "--text-muted": "#d8dee9",
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
      "--bg-surface-elevated": "#44475a",
      "--border-subtle": "#6272a4",
      "--border-focus": "#ff79c6",
      "--text-primary": "#f8f8f2",
      "--text-muted": "#6272a4",
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
      "--text-primary": "#fcfcfa",
      "--text-muted": "#939293",
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
      "--text-primary": "#fdf6e3",
      "--text-muted": "#93a1a1",
      "--accent-primary": "#2aa198",
      "--accent-hover": "#268bd2",
      "--accent-subtle": "rgba(42, 161, 152, 0.15)",
      "--accent-glow": "rgba(42, 161, 152, 0.4)",
    },
  },
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
      "--border-subtle": "#e2e8f0",
      "--border-focus": "#0284c7",
      "--text-primary": "#0f172a",
      "--text-muted": "#64748b",
      "--accent-primary": "#0284c7",
      "--accent-hover": "#0369a1",
      "--accent-subtle": "rgba(2, 132, 199, 0.12)",
      "--accent-glow": "rgba(2, 132, 199, 0.3)",
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
