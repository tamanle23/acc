export type ThemeMode = "dark" | "light";
export type ThemeCategory = "Studio Dark" | "Editor Classics" | "Atmospheric" | "Studio Light";

export interface ThemeTokens {
  background: string;
  foreground: string;
  surface: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  border: string;
  input: string;
  ring: string;
  radius: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  category: ThemeCategory;
  mode: ThemeMode;
  description: string;
  swatches: [string, string, string, string]; // Hex previews for the theme gallery
  tokens: ThemeTokens;
}

export const THEME_PRESETS: ThemePreset[] = [
  // --- 1. Obsidian Zinc (Default Shadcn Studio) ---
  {
    id: "obsidian-zinc",
    name: "Obsidian Zinc",
    category: "Studio Dark",
    mode: "dark",
    description: "Deep carbon zinc with electric indigo studio accents.",
    swatches: ["#09090b", "#18181b", "#6366f1", "#10b981"],
    tokens: {
      background: "240 10% 3.9%",
      foreground: "0 0% 98%",
      surface: "240 9% 6.5%",
      card: "240 10% 5.5%",
      cardForeground: "0 0% 98%",
      popover: "240 10% 6%",
      popoverForeground: "0 0% 98%",
      primary: "238.7 83.5% 60%",
      primaryForeground: "0 0% 100%",
      secondary: "240 4.5% 14%",
      secondaryForeground: "0 0% 98%",
      muted: "240 4% 11.5%",
      mutedForeground: "240 5% 65%",
      accent: "250 85% 60%",
      accentForeground: "0 0% 100%",
      destructive: "0 72% 48%",
      destructiveForeground: "0 0% 98%",
      success: "152 69% 45%",
      successForeground: "150 40% 4%",
      warning: "38 92% 55%",
      warningForeground: "0 0% 10%",
      border: "240 4.5% 15.5%",
      input: "240 4.5% 13%",
      ring: "238.7 83.5% 66.7%",
      radius: "0.75rem",
    },
  },
  // --- 2. Catppuccin Mocha ---
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    category: "Editor Classics",
    mode: "dark",
    description: "Soothing pastel mauve and lavender on warm espresso.",
    swatches: ["#1e1e2e", "#313244", "#cba6f7", "#a6e3a1"],
    tokens: {
      background: "240 21% 15%",
      foreground: "226 64% 88%",
      surface: "240 21% 12%",
      card: "237 16% 23%",
      cardForeground: "226 64% 88%",
      popover: "240 21% 15%",
      popoverForeground: "226 64% 88%",
      primary: "267 84% 81%",
      primaryForeground: "240 21% 12%",
      secondary: "234 13% 31%",
      secondaryForeground: "226 64% 88%",
      muted: "240 21% 12%",
      mutedForeground: "228 24% 72%",
      accent: "217 92% 76%",
      accentForeground: "240 21% 12%",
      destructive: "343 81% 75%",
      destructiveForeground: "240 21% 12%",
      success: "115 54% 76%",
      successForeground: "240 21% 12%",
      warning: "41 86% 83%",
      warningForeground: "240 21% 12%",
      border: "234 13% 31%",
      input: "237 16% 20%",
      ring: "267 84% 81%",
      radius: "0.75rem",
    },
  },
  // --- 3. Tokyo Night Storm ---
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    category: "Editor Classics",
    mode: "dark",
    description: "Clean neon blues and purples inspired by downtown Tokyo lights.",
    swatches: ["#1a1b26", "#24283b", "#7aa2f7", "#bb9af7"],
    tokens: {
      background: "235 19% 13%",
      foreground: "229 35% 85%",
      surface: "233 23% 17%",
      card: "233 24% 19%",
      cardForeground: "229 35% 85%",
      popover: "235 19% 13%",
      popoverForeground: "229 35% 85%",
      primary: "221 89% 72%",
      primaryForeground: "235 19% 10%",
      secondary: "232 20% 25%",
      secondaryForeground: "229 35% 85%",
      muted: "235 19% 11%",
      mutedForeground: "229 20% 62%",
      accent: "261 85% 79%",
      accentForeground: "235 19% 10%",
      destructive: "349 89% 72%",
      destructiveForeground: "235 19% 10%",
      success: "94 50% 64%",
      successForeground: "235 19% 10%",
      warning: "36 68% 64%",
      warningForeground: "235 19% 10%",
      border: "232 20% 25%",
      input: "235 19% 13%",
      ring: "221 89% 72%",
      radius: "0.75rem",
    },
  },
  // --- 4. Dracula Pro ---
  {
    id: "dracula-pro",
    name: "Dracula Pro",
    category: "Editor Classics",
    mode: "dark",
    description: "High-contrast gothic purple, vibrant pink, and cyan.",
    swatches: ["#282a36", "#44475a", "#bd93f9", "#ff79c6"],
    tokens: {
      background: "231 15% 18%",
      foreground: "60 30% 96%",
      surface: "231 15% 15%",
      card: "232 14% 22%",
      cardForeground: "60 30% 96%",
      popover: "231 15% 18%",
      popoverForeground: "60 30% 96%",
      primary: "265 89% 78%",
      primaryForeground: "231 15% 12%",
      secondary: "232 14% 31%",
      secondaryForeground: "60 30% 96%",
      muted: "231 15% 14%",
      mutedForeground: "225 27% 70%",
      accent: "326 100% 74%",
      accentForeground: "231 15% 12%",
      destructive: "0 100% 67%",
      destructiveForeground: "231 15% 10%",
      success: "135 94% 65%",
      successForeground: "231 15% 12%",
      warning: "65 92% 76%",
      warningForeground: "231 15% 12%",
      border: "232 14% 31%",
      input: "231 15% 16%",
      ring: "265 89% 78%",
      radius: "0.75rem",
    },
  },
  // --- 5. Nord Polar ---
  {
    id: "nord-polar",
    name: "Nord Polar",
    category: "Editor Classics",
    mode: "dark",
    description: "Arctic bluish-gray slate with frost cyan highlights.",
    swatches: ["#2e3440", "#3b4252", "#88c0d0", "#81a1c1"],
    tokens: {
      background: "220 16% 22%",
      foreground: "218 27% 92%",
      surface: "220 16% 19%",
      card: "222 16% 28%",
      cardForeground: "218 27% 92%",
      popover: "220 16% 22%",
      popoverForeground: "218 27% 92%",
      primary: "193 43% 67%",
      primaryForeground: "220 16% 14%",
      secondary: "220 17% 32%",
      secondaryForeground: "218 27% 92%",
      muted: "220 16% 18%",
      mutedForeground: "219 28% 76%",
      accent: "210 34% 63%",
      accentForeground: "220 16% 14%",
      destructive: "354 50% 46%",
      destructiveForeground: "218 27% 94%",
      success: "92 28% 65%",
      successForeground: "220 16% 14%",
      warning: "40 71% 73%",
      warningForeground: "220 16% 14%",
      border: "220 17% 34%",
      input: "220 16% 20%",
      ring: "193 43% 67%",
      radius: "0.625rem",
    },
  },
  // --- 6. Rose Pine Moon ---
  {
    id: "rose-pine",
    name: "Rosé Pine",
    category: "Atmospheric",
    mode: "dark",
    description: "All natural pine, faux fur, and dusty rose Soho vibes.",
    swatches: ["#191724", "#26233a", "#ebbcba", "#c4a7e7"],
    tokens: {
      background: "249 22% 12%",
      foreground: "245 50% 91%",
      surface: "247 23% 15%",
      card: "248 25% 18%",
      cardForeground: "245 50% 91%",
      popover: "249 22% 12%",
      popoverForeground: "245 50% 91%",
      primary: "2 55% 83%",
      primaryForeground: "249 22% 12%",
      secondary: "248 21% 24%",
      secondaryForeground: "245 50% 91%",
      muted: "249 22% 10%",
      mutedForeground: "248 15% 68%",
      accent: "267 57% 78%",
      accentForeground: "249 22% 12%",
      destructive: "343 76% 68%",
      destructiveForeground: "249 22% 10%",
      success: "189 43% 73%",
      successForeground: "249 22% 12%",
      warning: "35 88% 72%",
      warningForeground: "249 22% 12%",
      border: "248 21% 24%",
      input: "247 23% 14%",
      ring: "2 55% 83%",
      radius: "0.875rem",
    },
  },
  // --- 7. Gruvbox Dark Hard ---
  {
    id: "gruvbox-dark",
    name: "Gruvbox Retro",
    category: "Editor Classics",
    mode: "dark",
    description: "Warm retro terminal amber, olive green, and terracotta.",
    swatches: ["#1d2021", "#282828", "#fabd2f", "#b8bb26"],
    tokens: {
      background: "195 6% 12%",
      foreground: "43 59% 81%",
      surface: "0 0% 16%",
      card: "20 5% 19%",
      cardForeground: "43 59% 81%",
      popover: "195 6% 12%",
      popoverForeground: "43 59% 81%",
      primary: "42 95% 58%",
      primaryForeground: "195 6% 10%",
      secondary: "24 7% 25%",
      secondaryForeground: "43 59% 81%",
      muted: "195 6% 10%",
      mutedForeground: "35 17% 64%",
      accent: "27 99% 55%",
      accentForeground: "195 6% 10%",
      destructive: "6 96% 59%",
      destructiveForeground: "195 6% 10%",
      success: "61 66% 44%",
      successForeground: "195 6% 10%",
      warning: "42 95% 58%",
      warningForeground: "195 6% 10%",
      border: "24 7% 27%",
      input: "0 0% 15%",
      ring: "42 95% 58%",
      radius: "0.5rem",
    },
  },
  // --- 8. One Dark Pro ---
  {
    id: "one-dark-pro",
    name: "One Dark Pro",
    category: "Editor Classics",
    mode: "dark",
    description: "Atom's iconic balanced slate blue with sky and magenta accents.",
    swatches: ["#282c34", "#21252b", "#61afef", "#c678dd"],
    tokens: {
      background: "220 13% 15%",
      foreground: "219 14% 85%",
      surface: "220 13% 18%",
      card: "220 13% 20%",
      cardForeground: "219 14% 85%",
      popover: "220 13% 15%",
      popoverForeground: "219 14% 85%",
      primary: "207 82% 66%",
      primaryForeground: "220 13% 12%",
      secondary: "220 13% 26%",
      secondaryForeground: "219 14% 85%",
      muted: "220 13% 13%",
      mutedForeground: "219 10% 64%",
      accent: "286 60% 67%",
      accentForeground: "220 13% 12%",
      destructive: "355 65% 65%",
      destructiveForeground: "220 13% 12%",
      success: "95 38% 62%",
      successForeground: "220 13% 12%",
      warning: "39 67% 69%",
      warningForeground: "220 13% 12%",
      border: "220 13% 26%",
      input: "220 13% 16%",
      ring: "207 82% 66%",
      radius: "0.625rem",
    },
  },
  // --- 9. Monokai Spectrum ---
  {
    id: "monokai-spectrum",
    name: "Monokai Spectrum",
    category: "Editor Classics",
    mode: "dark",
    description: "Charcoal studio canvas with electric magenta, lime, and gold.",
    swatches: ["#222222", "#2d2a2e", "#ff6188", "#a9dc76"],
    tokens: {
      background: "300 4% 14%",
      foreground: "60 36% 96%",
      surface: "300 4% 17%",
      card: "300 5% 19%",
      cardForeground: "60 36% 96%",
      popover: "300 4% 14%",
      popoverForeground: "60 36% 96%",
      primary: "345 100% 69%",
      primaryForeground: "300 4% 10%",
      secondary: "300 4% 25%",
      secondaryForeground: "60 36% 96%",
      muted: "300 4% 12%",
      mutedForeground: "300 2% 65%",
      accent: "78 80% 68%",
      accentForeground: "300 4% 10%",
      destructive: "345 100% 69%",
      destructiveForeground: "300 4% 10%",
      success: "90 61% 66%",
      successForeground: "300 4% 10%",
      warning: "45 100% 70%",
      warningForeground: "300 4% 10%",
      border: "300 4% 26%",
      input: "300 4% 16%",
      ring: "345 100% 69%",
      radius: "0.625rem",
    },
  },
  // --- 10. Solarized Osaka (Dark) ---
  {
    id: "solarized-osaka",
    name: "Solarized Osaka",
    category: "Atmospheric",
    mode: "dark",
    description: "Deep oceanic teal-blue with precision cyan and solar amber.",
    swatches: ["#001419", "#002b36", "#2aa198", "#268bd2"],
    tokens: {
      background: "192 100% 6%",
      foreground: "186 13% 84%",
      surface: "192 100% 9%",
      card: "192 100% 11%",
      cardForeground: "186 13% 84%",
      popover: "192 100% 8%",
      popoverForeground: "186 13% 84%",
      primary: "175 59% 46%",
      primaryForeground: "192 100% 6%",
      secondary: "192 80% 16%",
      secondaryForeground: "186 13% 84%",
      muted: "192 90% 8%",
      mutedForeground: "186 12% 62%",
      accent: "205 69% 49%",
      accentForeground: "192 100% 6%",
      destructive: "1 71% 52%",
      destructiveForeground: "0 0% 100%",
      success: "68 100% 35%",
      successForeground: "192 100% 6%",
      warning: "45 100% 42%",
      warningForeground: "192 100% 6%",
      border: "192 70% 18%",
      input: "192 85% 10%",
      ring: "175 59% 46%",
      radius: "0.75rem",
    },
  },
  // --- 11. GitHub Dark Dimmed ---
  {
    id: "github-dark-dimmed",
    name: "GitHub Dimmed",
    category: "Studio Dark",
    mode: "dark",
    description: "Balanced engineering slate with trustworthy primer blue.",
    swatches: ["#1c2128", "#22272e", "#539bf5", "#57ab5a"],
    tokens: {
      background: "215 18% 13%",
      foreground: "213 18% 85%",
      surface: "215 15% 16%",
      card: "215 15% 17%",
      cardForeground: "213 18% 85%",
      popover: "215 18% 13%",
      popoverForeground: "213 18% 85%",
      primary: "213 89% 64%",
      primaryForeground: "215 18% 10%",
      secondary: "215 14% 23%",
      secondaryForeground: "213 18% 85%",
      muted: "215 18% 11%",
      mutedForeground: "212 12% 62%",
      accent: "213 89% 64%",
      accentForeground: "215 18% 10%",
      destructive: "3 76% 48%",
      destructiveForeground: "0 0% 100%",
      success: "122 33% 51%",
      successForeground: "215 18% 10%",
      warning: "41 68% 54%",
      warningForeground: "215 18% 10%",
      border: "215 14% 24%",
      input: "215 16% 15%",
      ring: "213 89% 64%",
      radius: "0.5rem",
    },
  },
  // --- 12. Synthwave '84 ---
  {
    id: "synthwave-84",
    name: "Synthwave '84",
    category: "Atmospheric",
    mode: "dark",
    description: "Outrun sunset magenta and cyber cyan on deep ultraviolet.",
    swatches: ["#241b2f", "#262335", "#ff7edb", "#36f9f6"],
    tokens: {
      background: "267 27% 14%",
      foreground: "280 30% 95%",
      surface: "250 21% 17%",
      card: "252 23% 19%",
      cardForeground: "280 30% 95%",
      popover: "267 27% 14%",
      popoverForeground: "280 30% 95%",
      primary: "317 100% 75%",
      primaryForeground: "267 27% 10%",
      secondary: "255 22% 26%",
      secondaryForeground: "280 30% 95%",
      muted: "267 27% 11%",
      mutedForeground: "260 20% 70%",
      accent: "179 94% 59%",
      accentForeground: "267 27% 10%",
      destructive: "354 95% 65%",
      destructiveForeground: "267 27% 10%",
      success: "153 91% 65%",
      successForeground: "267 27% 10%",
      warning: "46 97% 64%",
      warningForeground: "267 27% 10%",
      border: "258 25% 28%",
      input: "250 21% 16%",
      ring: "317 100% 75%",
      radius: "0.875rem",
    },
  },
  // --- 13. Cyberpunk Edgerunner ---
  {
    id: "cyberpunk-neon",
    name: "Cyberpunk Neon",
    category: "Atmospheric",
    mode: "dark",
    description: "High-voltage cyber yellow and optic cyan over pitch night.",
    swatches: ["#0b0c10", "#141824", "#fcee09", "#00f0ff"],
    tokens: {
      background: "228 19% 5%",
      foreground: "60 30% 96%",
      surface: "225 28% 9%",
      card: "225 28% 11%",
      cardForeground: "60 30% 96%",
      popover: "228 19% 6%",
      popoverForeground: "60 30% 96%",
      primary: "56 97% 51%",
      primaryForeground: "228 19% 5%",
      secondary: "225 25% 18%",
      secondaryForeground: "60 30% 96%",
      muted: "228 20% 8%",
      mutedForeground: "220 15% 65%",
      accent: "184 100% 50%",
      accentForeground: "228 19% 5%",
      destructive: "346 100% 58%",
      destructiveForeground: "228 19% 5%",
      success: "150 100% 45%",
      successForeground: "228 19% 5%",
      warning: "56 97% 51%",
      warningForeground: "228 19% 5%",
      border: "225 25% 20%",
      input: "225 28% 9%",
      ring: "56 97% 51%",
      radius: "0.375rem",
    },
  },
  // --- 14. Kanagawa Wave ---
  {
    id: "kanagawa-wave",
    name: "Kanagawa Wave",
    category: "Atmospheric",
    mode: "dark",
    description: "Hokusai woodblock ink blue with samurai gold and sakura.",
    swatches: ["#1f1f28", "#2a2a37", "#7e9cd8", "#dca561"],
    tokens: {
      background: "240 13% 14%",
      foreground: "46 35% 84%",
      surface: "240 13% 17%",
      card: "240 13% 19%",
      cardForeground: "46 35% 84%",
      popover: "240 13% 14%",
      popoverForeground: "46 35% 84%",
      primary: "220 53% 67%",
      primaryForeground: "240 13% 10%",
      secondary: "240 13% 25%",
      secondaryForeground: "46 35% 84%",
      muted: "240 13% 11%",
      mutedForeground: "45 15% 64%",
      accent: "33 63% 62%",
      accentForeground: "240 13% 10%",
      destructive: "356 68% 62%",
      destructiveForeground: "240 13% 10%",
      success: "96 34% 56%",
      successForeground: "240 13% 10%",
      warning: "33 63% 62%",
      warningForeground: "240 13% 10%",
      border: "240 13% 26%",
      input: "240 13% 16%",
      ring: "220 53% 67%",
      radius: "0.625rem",
    },
  },
  // --- 15. Everforest Dark ---
  {
    id: "everforest-dark",
    name: "Everforest Botanical",
    category: "Atmospheric",
    mode: "dark",
    description: "Eye-friendly woodland moss greens and warm parchment text.",
    swatches: ["#272e33", "#2e383c", "#a7c080", "#83c092"],
    tokens: {
      background: "205 13% 18%",
      foreground: "40 38% 83%",
      surface: "197 13% 21%",
      card: "197 13% 23%",
      cardForeground: "40 38% 83%",
      popover: "205 13% 18%",
      popoverForeground: "40 38% 83%",
      primary: "83 34% 63%",
      primaryForeground: "205 13% 12%",
      secondary: "197 12% 28%",
      secondaryForeground: "40 38% 83%",
      muted: "205 13% 15%",
      mutedForeground: "40 15% 65%",
      accent: "135 34% 63%",
      accentForeground: "205 13% 12%",
      destructive: "358 65% 68%",
      destructiveForeground: "205 13% 12%",
      success: "83 34% 63%",
      successForeground: "205 13% 12%",
      warning: "40 62% 67%",
      warningForeground: "205 13% 12%",
      border: "197 12% 29%",
      input: "197 13% 19%",
      ring: "83 34% 63%",
      radius: "0.75rem",
    },
  },
  // --- 16.Night Owl Studio ---
  {
    id: "night-owl",
    name: "Night Owl",
    category: "Studio Dark",
    mode: "dark",
    description: "Deep midnight ocean optimized for low-light audio/AI work.",
    swatches: ["#011627", "#0b2942", "#82aaff", "#c792ea"],
    tokens: {
      background: "207 95% 8%",
      foreground: "213 37% 88%",
      surface: "207 75% 12%",
      card: "207 71% 14%",
      cardForeground: "213 37% 88%",
      popover: "207 95% 8%",
      popoverForeground: "213 37% 88%",
      primary: "221 100% 75%",
      primaryForeground: "207 95% 8%",
      secondary: "207 60% 20%",
      secondaryForeground: "213 37% 88%",
      muted: "207 85% 10%",
      mutedForeground: "210 25% 66%",
      accent: "276 68% 75%",
      accentForeground: "207 95% 8%",
      destructive: "350 84% 65%",
      destructiveForeground: "207 95% 8%",
      success: "152 68% 56%",
      successForeground: "207 95% 8%",
      warning: "41 90% 68%",
      warningForeground: "207 95% 8%",
      border: "207 55% 22%",
      input: "207 75% 11%",
      ring: "221 100% 75%",
      radius: "0.75rem",
    },
  },
  // --- 17. Vercel Carbon Monochrome ---
  {
    id: "vercel-carbon",
    name: "Vercel Geist",
    category: "Studio Dark",
    mode: "dark",
    description: "Pure pitch black OLED monochrome with razor-sharp hairlines.",
    swatches: ["#000000", "#111111", "#ffffff", "#0070f3"],
    tokens: {
      background: "0 0% 0%",
      foreground: "0 0% 98%",
      surface: "0 0% 4%",
      card: "0 0% 6%",
      cardForeground: "0 0% 98%",
      popover: "0 0% 5%",
      popoverForeground: "0 0% 98%",
      primary: "212 100% 46%",
      primaryForeground: "0 0% 100%",
      secondary: "0 0% 12%",
      secondaryForeground: "0 0% 98%",
      muted: "0 0% 8%",
      mutedForeground: "0 0% 62%",
      accent: "212 100% 46%",
      accentForeground: "0 0% 100%",
      destructive: "0 84% 50%",
      destructiveForeground: "0 0% 100%",
      success: "145 78% 45%",
      successForeground: "0 0% 0%",
      warning: "38 95% 52%",
      warningForeground: "0 0% 5%",
      border: "0 0% 15%",
      input: "0 0% 9%",
      ring: "212 100% 52%",
      radius: "0.5rem",
    },
  },
  // --- 18. Emerald Matrix ---
  {
    id: "emerald-matrix",
    name: "Emerald Matrix",
    category: "Studio Dark",
    mode: "dark",
    description: "Obsidian cyber-security terminal with phosphor emerald telemetry.",
    swatches: ["#050b08", "#0b1912", "#10b981", "#34d399"],
    tokens: {
      background: "150 38% 4%",
      foreground: "152 35% 94%",
      surface: "152 35% 7%",
      card: "152 35% 8.5%",
      cardForeground: "152 35% 94%",
      popover: "150 38% 5%",
      popoverForeground: "152 35% 94%",
      primary: "158 84% 42%",
      primaryForeground: "150 40% 4%",
      secondary: "152 28% 15%",
      secondaryForeground: "152 35% 94%",
      muted: "152 30% 9%",
      mutedForeground: "152 18% 64%",
      accent: "160 84% 52%",
      accentForeground: "150 40% 4%",
      destructive: "0 78% 50%",
      destructiveForeground: "0 0% 100%",
      success: "158 84% 42%",
      successForeground: "150 40% 4%",
      warning: "42 92% 56%",
      warningForeground: "150 40% 4%",
      border: "152 28% 17%",
      input: "152 32% 10%",
      ring: "158 84% 42%",
      radius: "0.625rem",
    },
  },
  // --- 19. Catppuccin Latte (Light) ---
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    category: "Studio Light",
    mode: "light",
    description: "Warm daylight alabaster with rich violet and sapphire ink.",
    swatches: ["#eff1f5", "#ffffff", "#8839ef", "#1e66f5"],
    tokens: {
      background: "220 23% 95%",
      foreground: "234 16% 22%",
      surface: "220 22% 92%",
      card: "0 0% 100%",
      cardForeground: "234 16% 22%",
      popover: "0 0% 100%",
      popoverForeground: "234 16% 22%",
      primary: "266 85% 58%",
      primaryForeground: "0 0% 100%",
      secondary: "223 16% 87%",
      secondaryForeground: "234 16% 22%",
      muted: "220 21% 89%",
      mutedForeground: "233 12% 41%",
      accent: "220 91% 54%",
      accentForeground: "0 0% 100%",
      destructive: "347 87% 44%",
      destructiveForeground: "0 0% 100%",
      success: "109 58% 32%",
      successForeground: "0 0% 100%",
      warning: "35 77% 44%",
      warningForeground: "234 16% 15%",
      border: "223 16% 82%",
      input: "223 16% 88%",
      ring: "266 85% 58%",
      radius: "0.75rem",
    },
  },
  // --- 20. Daylight Alabaster (Studio Light) ---
  {
    id: "daylight-alabaster",
    name: "Daylight Studio",
    category: "Studio Light",
    mode: "light",
    description: "Crisp architectural white with cobalt blue and slate contrast.",
    swatches: ["#f8fafc", "#ffffff", "#4f46e5", "#0f172a"],
    tokens: {
      background: "210 40% 98%",
      foreground: "222 47% 11%",
      surface: "210 35% 95%",
      card: "0 0% 100%",
      cardForeground: "222 47% 11%",
      popover: "0 0% 100%",
      popoverForeground: "222 47% 11%",
      primary: "243 75% 59%",
      primaryForeground: "0 0% 100%",
      secondary: "214 32% 91%",
      secondaryForeground: "222 47% 11%",
      muted: "210 40% 93%",
      mutedForeground: "215 16% 42%",
      accent: "243 75% 59%",
      accentForeground: "0 0% 100%",
      destructive: "0 84% 48%",
      destructiveForeground: "0 0% 100%",
      success: "152 69% 30%",
      successForeground: "0 0% 100%",
      warning: "38 92% 45%",
      warningForeground: "222 47% 11%",
      border: "214 32% 86%",
      input: "214 32% 90%",
      ring: "243 75% 59%",
      radius: "0.75rem",
    },
  },
];

export const DEFAULT_THEME_ID = "obsidian-zinc";

export function applyThemeToDom(theme: ThemePreset): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme.mode);
  root.setAttribute("data-theme", theme.id);

  const t = theme.tokens;
  const cssVars: Record<string, string> = {
    "--background": t.background,
    "--foreground": t.foreground,
    "--surface": t.surface,
    "--card": t.card,
    "--card-foreground": t.cardForeground,
    "--popover": t.popover,
    "--popover-foreground": t.popoverForeground,
    "--primary": t.primary,
    "--primary-foreground": t.primaryForeground,
    "--secondary": t.secondary,
    "--secondary-foreground": t.secondaryForeground,
    "--muted": t.muted,
    "--muted-foreground": t.mutedForeground,
    "--accent": t.accent,
    "--accent-foreground": t.accentForeground,
    "--destructive": t.destructive,
    "--destructive-foreground": t.destructiveForeground,
    "--success": t.success,
    "--success-foreground": t.successForeground,
    "--warning": t.warning,
    "--warning-foreground": t.warningForeground,
    "--border": t.border,
    "--input": t.input,
    "--ring": t.ring,
    "--radius": t.radius,
  };

  for (const [key, val] of Object.entries(cssVars)) {
    root.style.setProperty(key, val);
  }
}

/**
 * WCAG 2.1/2.2 Color Contrast Utilities (ISO-9241-3 & W3C REC-WCAG21-20180605)
 */
export function hslToSrgb(hslStr: string): [number, number, number] {
  const parts = hslStr.trim().split(/\s+/);
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1].replace("%", "")) / 100;
  const l = parseFloat(parts[2].replace("%", "")) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h >= 0 && h < 60) {
    r1 = c; g1 = x; b1 = 0;
  } else if (h >= 60 && h < 120) {
    r1 = x; g1 = c; b1 = 0;
  } else if (h >= 120 && h < 180) {
    r1 = 0; g1 = c; b1 = x;
  } else if (h >= 180 && h < 240) {
    r1 = 0; g1 = x; b1 = c;
  } else if (h >= 240 && h < 300) {
    r1 = x; g1 = 0; b1 = c;
  } else if (h >= 300 && h < 360) {
    r1 = c; g1 = 0; b1 = x;
  }

  return [r1 + m, g1 + m, b1 + m];
}

export function calculateRelativeLuminance(r: number, g: number, b: number): number {
  const adjust = (val: number) =>
    val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  const rLin = adjust(r);
  const gLin = adjust(g);
  const bLin = adjust(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

export function calculateContrastRatio(hsl1: string, hsl2: string): number {
  const lum1 = calculateRelativeLuminance(...hslToSrgb(hsl1));
  const lum2 = calculateRelativeLuminance(...hslToSrgb(hsl2));
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

export interface ThemeContrastReport {
  themeId: string;
  themeName: string;
  mode: ThemeMode;
  compliantAA: boolean;
  compliantAAA: boolean;
  bodyRatio: number;
  cardRatio: number;
  mutedRatio: number;
  primaryRatio: number;
  minRatio: number;
  pairs: Array<{ fg: string; bg: string; label: string; ratio: number; passAA: boolean }>;
}

export function auditThemeContrast(theme: ThemePreset): ThemeContrastReport {
  const t = theme.tokens;
  const checkList: Array<{ fgKey: keyof ThemeTokens; bgKey: keyof ThemeTokens; label: string }> = [
    { fgKey: "foreground", bgKey: "background", label: "Page Body Text" },
    { fgKey: "foreground", bgKey: "surface", label: "Surface Text" },
    { fgKey: "cardForeground", bgKey: "card", label: "Card Text" },
    { fgKey: "popoverForeground", bgKey: "popover", label: "Popover Text" },
    { fgKey: "mutedForeground", bgKey: "background", label: "Muted on Background" },
    { fgKey: "mutedForeground", bgKey: "surface", label: "Muted on Surface" },
    { fgKey: "mutedForeground", bgKey: "card", label: "Muted on Card" },
    { fgKey: "primaryForeground", bgKey: "primary", label: "Primary Button Text" },
    { fgKey: "secondaryForeground", bgKey: "secondary", label: "Secondary Button Text" },
    { fgKey: "accentForeground", bgKey: "accent", label: "Accent Text" },
    { fgKey: "destructiveForeground", bgKey: "destructive", label: "Destructive Button Text" },
    { fgKey: "successForeground", bgKey: "success", label: "Success Text" },
    { fgKey: "warningForeground", bgKey: "warning", label: "Warning Text" },
  ];

  const pairs: Array<{ fg: string; bg: string; label: string; ratio: number; passAA: boolean }> = [];
  let minRatio = 999;
  let allAA = true;
  let allAAA = true;

  for (const item of checkList) {
    const fgVal = t[item.fgKey];
    const bgVal = t[item.bgKey];
    if (fgVal && bgVal && fgVal.includes("%") && bgVal.includes("%")) {
      const ratio = calculateContrastRatio(fgVal, bgVal);
      const passAA = ratio >= 4.5;
      if (!passAA) allAA = false;
      if (ratio < 7.0) allAAA = false;
      if (ratio < minRatio) minRatio = ratio;
      pairs.push({
        fg: item.fgKey,
        bg: item.bgKey,
        label: item.label,
        ratio,
        passAA,
      });
    }
  }

  return {
    themeId: theme.id,
    themeName: theme.name,
    mode: theme.mode,
    compliantAA: allAA,
    compliantAAA: allAAA,
    bodyRatio: calculateContrastRatio(t.foreground, t.background),
    cardRatio: calculateContrastRatio(t.cardForeground, t.card),
    mutedRatio: calculateContrastRatio(t.mutedForeground, t.card),
    primaryRatio: calculateContrastRatio(t.primaryForeground, t.primary),
    minRatio: minRatio === 999 ? 0 : minRatio,
    pairs,
  };
}
