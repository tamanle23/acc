/**
 * Studio Grade Theme Presets Catalog
 * 20 Curated Iconic Theme Presets for ACC NLE Studio
 * Fully synchronized with Tailwind CSS v4 @theme and Liquid Glass design tokens.
 */

export type ThemePresetCategory = 'dark' | 'light' | 'cyber' | 'creative' | 'retro' | 'minimal';

export interface ThemeTokens {
  background: string;
  foreground: string;
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
  border: string;
  input: string;
  ring: string;

  // Studio Liquid Glass Tokens
  accentPrimary: string;
  colorBrandAccent: string;
  accentGlow: string;
  glassBg: string;
  glassBorder: string;
  glassBorderHighlight: string;
  glassSpecular: string;
  glassShadow: string;
  ambientMesh: string;
}

export interface StudioThemePreset {
  id: string;
  name: string;
  category: ThemePresetCategory;
  mode: 'dark' | 'light';
  description: string;
  preview: {
    bg: string;
    surface: string;
    primary: string;
    accent: string;
  };
  tokens: ThemeTokens;
}

export const STUDIO_THEME_PRESETS: StudioThemePreset[] = [
  // 1. Obsidian Studio (Default Pro NLE Charcoal)
  {
    id: 'obsidian',
    name: 'Obsidian Studio',
    category: 'dark',
    mode: 'dark',
    description: 'Pro NLE deep charcoal with vibrant electric cyan highlights.',
    preview: {
      bg: '#0b1121',
      surface: '#111827',
      primary: '#06b6d4',
      accent: '#38bdf8',
    },
    tokens: {
      background: '222.2 84% 4.9%',
      foreground: '210 40% 98%',
      card: '222.2 84% 4.9%',
      cardForeground: '210 40% 98%',
      popover: '222.2 84% 4.9%',
      popoverForeground: '210 40% 98%',
      primary: '189 94% 43%',
      primaryForeground: '222.2 47.4% 11.2%',
      secondary: '217.2 32.6% 17.5%',
      secondaryForeground: '210 40% 98%',
      muted: '217.2 32.6% 17.5%',
      mutedForeground: '215 20.2% 65.1%',
      accent: '217.2 32.6% 17.5%',
      accentForeground: '210 40% 98%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '210 40% 98%',
      border: '217.2 32.6% 17.5%',
      input: '217.2 32.6% 17.5%',
      ring: '189 94% 43%',
      accentPrimary: '#06b6d4',
      colorBrandAccent: '#06b6d4',
      accentGlow: 'rgba(6, 182, 212, 0.4)',
      glassBg: 'rgba(11, 17, 33, 0.75)',
      glassBorder: 'rgba(255, 255, 255, 0.09)',
      glassBorderHighlight: 'rgba(255, 255, 255, 0.22)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.16)',
      glassShadow: '0 16px 40px -8px rgba(0, 0, 0, 0.65)',
      ambientMesh: 'radial-gradient(at 10% 10%, color-mix(in srgb, #06b6d4 12%, transparent) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(139, 92, 246, 0.10) 0px, transparent 45%)',
    },
  },

  // 2. Tokyo Night
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    category: 'dark',
    mode: 'dark',
    description: 'Clean deep indigo night with neon cyan and electric violet accents.',
    preview: {
      bg: '#1a1b26',
      surface: '#24283b',
      primary: '#bb9af7',
      accent: '#7dcfff',
    },
    tokens: {
      background: '235 44% 11%',
      foreground: '228 54% 84%',
      card: '235 40% 14%',
      cardForeground: '228 54% 84%',
      popover: '235 40% 14%',
      popoverForeground: '228 54% 84%',
      primary: '260 84% 75%',
      primaryForeground: '235 44% 11%',
      secondary: '235 30% 22%',
      secondaryForeground: '228 54% 84%',
      muted: '235 30% 20%',
      mutedForeground: '226 23% 60%',
      accent: '235 30% 22%',
      accentForeground: '228 54% 84%',
      destructive: '350 89% 60%',
      destructiveForeground: '210 40% 98%',
      border: '235 30% 24%',
      input: '235 30% 24%',
      ring: '260 84% 75%',
      accentPrimary: '#bb9af7',
      colorBrandAccent: '#bb9af7',
      accentGlow: 'rgba(187, 154, 247, 0.45)',
      glassBg: 'rgba(26, 27, 38, 0.78)',
      glassBorder: 'rgba(125, 207, 255, 0.12)',
      glassBorderHighlight: 'rgba(187, 154, 247, 0.28)',
      glassSpecular: 'inset 0 1px 0 0 rgba(187, 154, 247, 0.22)',
      glassShadow: '0 16px 40px -8px rgba(10, 10, 20, 0.7)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(187, 154, 247, 0.14) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(125, 207, 255, 0.12) 0px, transparent 45%)',
    },
  },

  // 3. Catppuccin Mocha
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    category: 'dark',
    mode: 'dark',
    description: 'Smooth dark pastel palette with lavender, mauve, and soft mint.',
    preview: {
      bg: '#1e1e2e',
      surface: '#313244',
      primary: '#cba6f7',
      accent: '#89b4fa',
    },
    tokens: {
      background: '240 21% 15%',
      foreground: '226 64% 88%',
      card: '240 21% 19%',
      cardForeground: '226 64% 88%',
      popover: '240 21% 19%',
      popoverForeground: '226 64% 88%',
      primary: '267 84% 81%',
      primaryForeground: '240 21% 15%',
      secondary: '240 14% 29%',
      secondaryForeground: '226 64% 88%',
      muted: '240 14% 25%',
      mutedForeground: '228 24% 65%',
      accent: '240 14% 29%',
      accentForeground: '226 64% 88%',
      destructive: '343 81% 75%',
      destructiveForeground: '240 21% 15%',
      border: '240 14% 29%',
      input: '240 14% 29%',
      ring: '267 84% 81%',
      accentPrimary: '#cba6f7',
      colorBrandAccent: '#cba6f7',
      accentGlow: 'rgba(203, 166, 247, 0.4)',
      glassBg: 'rgba(30, 30, 46, 0.78)',
      glassBorder: 'rgba(203, 166, 247, 0.14)',
      glassBorderHighlight: 'rgba(203, 166, 247, 0.28)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.14)',
      glassShadow: '0 16px 36px -6px rgba(17, 17, 27, 0.75)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(203, 166, 247, 0.12) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(137, 180, 250, 0.12) 0px, transparent 45%)',
    },
  },

  // 4. Catppuccin Latte
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    category: 'light',
    mode: 'light',
    description: 'Crisp warm light theme with royal sapphire blue and soft mauve.',
    preview: {
      bg: '#eff1f5',
      surface: '#e6e9ef',
      primary: '#1e66f5',
      accent: '#8839ef',
    },
    tokens: {
      background: '220 23% 95%',
      foreground: '234 16% 35%',
      card: '220 22% 98%',
      cardForeground: '234 16% 35%',
      popover: '220 22% 98%',
      popoverForeground: '234 16% 35%',
      primary: '217 92% 60%',
      primaryForeground: '0 0% 100%',
      secondary: '223 16% 89%',
      secondaryForeground: '234 16% 35%',
      muted: '223 16% 89%',
      mutedForeground: '233 13% 55%',
      accent: '223 16% 89%',
      accentForeground: '234 16% 35%',
      destructive: '347 77% 50%',
      destructiveForeground: '0 0% 100%',
      border: '223 16% 83%',
      input: '223 16% 83%',
      ring: '217 92% 60%',
      accentPrimary: '#1e66f5',
      colorBrandAccent: '#1e66f5',
      accentGlow: 'rgba(30, 102, 245, 0.35)',
      glassBg: 'rgba(239, 241, 245, 0.82)',
      glassBorder: 'rgba(76, 79, 105, 0.12)',
      glassBorderHighlight: 'rgba(255, 255, 255, 0.95)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.85)',
      glassShadow: '0 8px 30px 0 rgba(108, 111, 133, 0.12)',
      ambientMesh: 'radial-gradient(at 0% 0%, rgba(30, 102, 245, 0.08) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(136, 57, 239, 0.06) 0px, transparent 50%)',
    },
  },

  // 5. Dracula Pro
  {
    id: 'dracula-pro',
    name: 'Dracula Pro',
    category: 'dark',
    mode: 'dark',
    description: 'Iconic gothic dark purple theme with neon magenta and cyan highlights.',
    preview: {
      bg: '#282a36',
      surface: '#343746',
      primary: '#ff79c6',
      accent: '#bd93f9',
    },
    tokens: {
      background: '231 15% 18%',
      foreground: '60 30% 96%',
      card: '232 14% 24%',
      cardForeground: '60 30% 96%',
      popover: '232 14% 24%',
      popoverForeground: '60 30% 96%',
      primary: '326 100% 74%',
      primaryForeground: '231 15% 18%',
      secondary: '232 14% 31%',
      secondaryForeground: '60 30% 96%',
      muted: '232 14% 28%',
      mutedForeground: '228 15% 65%',
      accent: '232 14% 31%',
      accentForeground: '60 30% 96%',
      destructive: '0 100% 67%',
      destructiveForeground: '60 30% 96%',
      border: '232 14% 33%',
      input: '232 14% 33%',
      ring: '326 100% 74%',
      accentPrimary: '#ff79c6',
      colorBrandAccent: '#ff79c6',
      accentGlow: 'rgba(255, 121, 198, 0.45)',
      glassBg: 'rgba(40, 42, 54, 0.82)',
      glassBorder: 'rgba(189, 147, 249, 0.16)',
      glassBorderHighlight: 'rgba(255, 121, 198, 0.3)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
      glassShadow: '0 16px 40px -8px rgba(20, 20, 30, 0.8)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(255, 121, 198, 0.14) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(189, 147, 249, 0.14) 0px, transparent 45%)',
    },
  },

  // 6. Nord Frost
  {
    id: 'nord-frost',
    name: 'Nord Frost',
    category: 'dark',
    mode: 'dark',
    description: 'Arctic Scandinavian slate blue with glacier cyan and frost white.',
    preview: {
      bg: '#2e3440',
      surface: '#3b4252',
      primary: '#88c0d0',
      accent: '#81a1c1',
    },
    tokens: {
      background: '220 16% 22%',
      foreground: '218 27% 92%',
      card: '220 17% 28%',
      cardForeground: '218 27% 92%',
      popover: '220 17% 28%',
      popoverForeground: '218 27% 92%',
      primary: '193 43% 67%',
      primaryForeground: '220 16% 22%',
      secondary: '220 16% 36%',
      secondaryForeground: '218 27% 92%',
      muted: '220 16% 32%',
      mutedForeground: '218 14% 65%',
      accent: '220 16% 36%',
      accentForeground: '218 27% 92%',
      destructive: '354 42% 56%',
      destructiveForeground: '218 27% 92%',
      border: '220 16% 38%',
      input: '220 16% 38%',
      ring: '193 43% 67%',
      accentPrimary: '#88c0d0',
      colorBrandAccent: '#88c0d0',
      accentGlow: 'rgba(136, 192, 208, 0.4)',
      glassBg: 'rgba(46, 52, 64, 0.8)',
      glassBorder: 'rgba(136, 192, 208, 0.14)',
      glassBorderHighlight: 'rgba(236, 239, 244, 0.25)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.16)',
      glassShadow: '0 16px 36px -6px rgba(15, 20, 28, 0.7)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(136, 192, 208, 0.12) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(129, 161, 193, 0.12) 0px, transparent 45%)',
    },
  },

  // 7. One Dark Pro
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    category: 'dark',
    mode: 'dark',
    description: 'Atom and VS Code definitive dark slate with azure blue and purple.',
    preview: {
      bg: '#282c34',
      surface: '#333842',
      primary: '#61afef',
      accent: '#c678dd',
    },
    tokens: {
      background: '220 13% 18%',
      foreground: '219 14% 71%',
      card: '220 12% 23%',
      cardForeground: '219 14% 71%',
      popover: '220 12% 23%',
      popoverForeground: '219 14% 71%',
      primary: '207 82% 66%',
      primaryForeground: '220 13% 18%',
      secondary: '220 11% 29%',
      secondaryForeground: '210 40% 98%',
      muted: '220 11% 27%',
      mutedForeground: '219 14% 55%',
      accent: '220 11% 29%',
      accentForeground: '210 40% 98%',
      destructive: '355 65% 65%',
      destructiveForeground: '210 40% 98%',
      border: '220 11% 32%',
      input: '220 11% 32%',
      ring: '207 82% 66%',
      accentPrimary: '#61afef',
      colorBrandAccent: '#61afef',
      accentGlow: 'rgba(97, 175, 239, 0.4)',
      glassBg: 'rgba(40, 44, 52, 0.8)',
      glassBorder: 'rgba(255, 255, 255, 0.08)',
      glassBorderHighlight: 'rgba(97, 175, 239, 0.25)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.14)',
      glassShadow: '0 16px 36px -6px rgba(18, 20, 24, 0.7)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(97, 175, 239, 0.12) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(198, 120, 221, 0.1) 0px, transparent 45%)',
    },
  },

  // 8. GitHub Dark Dimmed
  {
    id: 'github-dark-dimmed',
    name: 'GitHub Dimmed',
    category: 'dark',
    mode: 'dark',
    description: 'Refined GitHub dim charcoal with vivid royal blue and mint green.',
    preview: {
      bg: '#22272e',
      surface: '#2d333b',
      primary: '#539bf5',
      accent: '#57ab5a',
    },
    tokens: {
      background: '215 21% 15%',
      foreground: '213 25% 75%',
      card: '215 18% 19%',
      cardForeground: '213 25% 75%',
      popover: '215 18% 19%',
      popoverForeground: '213 25% 75%',
      primary: '212 92% 64%',
      primaryForeground: '215 21% 15%',
      secondary: '215 14% 28%',
      secondaryForeground: '210 40% 98%',
      muted: '215 14% 25%',
      mutedForeground: '215 12% 58%',
      accent: '215 14% 28%',
      accentForeground: '210 40% 98%',
      destructive: '356 72% 66%',
      destructiveForeground: '210 40% 98%',
      border: '215 14% 30%',
      input: '215 14% 30%',
      ring: '212 92% 64%',
      accentPrimary: '#539bf5',
      colorBrandAccent: '#539bf5',
      accentGlow: 'rgba(83, 155, 245, 0.4)',
      glassBg: 'rgba(34, 39, 46, 0.82)',
      glassBorder: 'rgba(255, 255, 255, 0.08)',
      glassBorderHighlight: 'rgba(83, 155, 245, 0.25)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
      glassShadow: '0 16px 36px -6px rgba(12, 14, 18, 0.75)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(83, 155, 245, 0.12) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(87, 171, 90, 0.1) 0px, transparent 45%)',
    },
  },

  // 9. GitHub Light Modern
  {
    id: 'github-light-modern',
    name: 'GitHub Light',
    category: 'light',
    mode: 'light',
    description: 'Clean pure white studio canvas with GitHub classic royal blue.',
    preview: {
      bg: '#ffffff',
      surface: '#f6f8fa',
      primary: '#0969da',
      accent: '#1a7f37',
    },
    tokens: {
      background: '0 0% 100%',
      foreground: '212 12% 21%',
      card: '210 29% 97%',
      cardForeground: '212 12% 21%',
      popover: '210 29% 97%',
      popoverForeground: '212 12% 21%',
      primary: '212 92% 45%',
      primaryForeground: '0 0% 100%',
      secondary: '210 20% 92%',
      secondaryForeground: '212 12% 21%',
      muted: '210 20% 92%',
      mutedForeground: '215 14% 45%',
      accent: '210 20% 92%',
      accentForeground: '212 12% 21%',
      destructive: '356 72% 48%',
      destructiveForeground: '0 0% 100%',
      border: '214 20% 88%',
      input: '214 20% 88%',
      ring: '212 92% 45%',
      accentPrimary: '#0969da',
      colorBrandAccent: '#0969da',
      accentGlow: 'rgba(9, 105, 218, 0.3)',
      glassBg: 'rgba(255, 255, 255, 0.85)',
      glassBorder: 'rgba(0, 0, 0, 0.09)',
      glassBorderHighlight: 'rgba(255, 255, 255, 0.98)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
      glassShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.08)',
      ambientMesh: 'radial-gradient(at 0% 0%, rgba(9, 105, 218, 0.06) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(26, 127, 55, 0.05) 0px, transparent 50%)',
    },
  },

  // 10. Monokai Pro
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    category: 'dark',
    mode: 'dark',
    description: 'High-contrast studio charcoal with sunburst yellow, coral, and lime.',
    preview: {
      bg: '#2d2a2e',
      surface: '#3a373b',
      primary: '#ffd866',
      accent: '#ff6188',
    },
    tokens: {
      background: '270 4% 17%',
      foreground: '60 8% 95%',
      card: '270 4% 22%',
      cardForeground: '60 8% 95%',
      popover: '270 4% 22%',
      popoverForeground: '60 8% 95%',
      primary: '45 100% 64%',
      primaryForeground: '270 4% 17%',
      secondary: '270 3% 32%',
      secondaryForeground: '60 8% 95%',
      muted: '270 3% 28%',
      mutedForeground: '270 4% 65%',
      accent: '270 3% 32%',
      accentForeground: '60 8% 95%',
      destructive: '340 82% 66%',
      destructiveForeground: '60 8% 95%',
      border: '270 3% 34%',
      input: '270 3% 34%',
      ring: '45 100% 64%',
      accentPrimary: '#ffd866',
      colorBrandAccent: '#ffd866',
      accentGlow: 'rgba(255, 216, 102, 0.45)',
      glassBg: 'rgba(45, 42, 46, 0.82)',
      glassBorder: 'rgba(255, 255, 255, 0.09)',
      glassBorderHighlight: 'rgba(255, 216, 102, 0.3)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
      glassShadow: '0 16px 40px -8px rgba(20, 18, 22, 0.75)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(255, 216, 102, 0.12) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(255, 97, 136, 0.12) 0px, transparent 45%)',
    },
  },

  // 11. Cyberpunk 2077
  {
    id: 'cyberpunk-2077',
    name: 'Cyberpunk 2077',
    category: 'cyber',
    mode: 'dark',
    description: 'High-voltage electric yellow, hot pink neon, and high-contrast night.',
    preview: {
      bg: '#120e1d',
      surface: '#1b152b',
      primary: '#ffe600',
      accent: '#ff007f',
    },
    tokens: {
      background: '250 20% 8%',
      foreground: '54 100% 90%',
      card: '252 24% 13%',
      cardForeground: '54 100% 90%',
      popover: '252 24% 13%',
      popoverForeground: '54 100% 90%',
      primary: '54 100% 50%',
      primaryForeground: '250 20% 8%',
      secondary: '252 20% 22%',
      secondaryForeground: '54 100% 90%',
      muted: '252 20% 18%',
      mutedForeground: '252 14% 65%',
      accent: '330 100% 55%',
      accentForeground: '0 0% 100%',
      destructive: '348 100% 60%',
      destructiveForeground: '0 0% 100%',
      border: '330 60% 32%',
      input: '330 60% 32%',
      ring: '54 100% 50%',
      accentPrimary: '#ffe600',
      colorBrandAccent: '#ffe600',
      accentGlow: 'rgba(255, 230, 0, 0.5)',
      glassBg: 'rgba(18, 14, 29, 0.85)',
      glassBorder: 'rgba(255, 230, 0, 0.22)',
      glassBorderHighlight: 'rgba(255, 0, 127, 0.45)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 230, 0, 0.3)',
      glassShadow: '0 0 28px -4px rgba(255, 230, 0, 0.3)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(255, 230, 0, 0.16) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(255, 0, 127, 0.16) 0px, transparent 45%)',
    },
  },

  // 12. Synthwave '84
  {
    id: 'synthwave-84',
    name: "Synthwave '84",
    category: 'creative',
    mode: 'dark',
    description: 'Retro 80s outrun laser pink, electric teal grid, and deep dusk.',
    preview: {
      bg: '#261b3b',
      surface: '#34264f',
      primary: '#f92aad',
      accent: '#36f9f6',
    },
    tokens: {
      background: '260 38% 15%',
      foreground: '280 20% 90%',
      card: '260 32% 21%',
      cardForeground: '280 20% 90%',
      popover: '260 32% 21%',
      popoverForeground: '280 20% 90%',
      primary: '320 85% 62%',
      primaryForeground: '260 38% 15%',
      secondary: '260 25% 30%',
      secondaryForeground: '280 20% 90%',
      muted: '260 25% 26%',
      mutedForeground: '270 16% 65%',
      accent: '185 95% 55%',
      accentForeground: '260 38% 15%',
      destructive: '348 100% 60%',
      destructiveForeground: '210 40% 98%',
      border: '280 35% 36%',
      input: '280 35% 36%',
      ring: '320 85% 62%',
      accentPrimary: '#f92aad',
      colorBrandAccent: '#f92aad',
      accentGlow: 'rgba(249, 42, 173, 0.5)',
      glassBg: 'rgba(38, 27, 59, 0.82)',
      glassBorder: 'rgba(249, 42, 173, 0.22)',
      glassBorderHighlight: 'rgba(54, 249, 246, 0.35)',
      glassSpecular: 'inset 0 1px 0 0 rgba(249, 42, 173, 0.25)',
      glassShadow: '0 16px 40px -8px rgba(25, 12, 40, 0.85)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(249, 42, 173, 0.16) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(54, 249, 246, 0.14) 0px, transparent 45%)',
    },
  },

  // 13. Solarized Dark
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    category: 'dark',
    mode: 'dark',
    description: 'Precision optical deep teal base with radiant cyan and amber.',
    preview: {
      bg: '#002b36',
      surface: '#073642',
      primary: '#2aa198',
      accent: '#b58900',
    },
    tokens: {
      background: '192 100% 6%',
      foreground: '186 24% 65%',
      card: '192 81% 9%',
      cardForeground: '186 24% 65%',
      popover: '192 81% 9%',
      popoverForeground: '186 24% 65%',
      primary: '175 60% 45%',
      primaryForeground: '192 100% 6%',
      secondary: '192 40% 16%',
      secondaryForeground: '186 30% 85%',
      muted: '192 40% 14%',
      mutedForeground: '186 20% 50%',
      accent: '192 40% 16%',
      accentForeground: '186 30% 85%',
      destructive: '1 71% 52%',
      destructiveForeground: '210 40% 98%',
      border: '192 35% 20%',
      input: '192 35% 20%',
      ring: '175 60% 45%',
      accentPrimary: '#2aa198',
      colorBrandAccent: '#2aa198',
      accentGlow: 'rgba(42, 161, 152, 0.4)',
      glassBg: 'rgba(0, 43, 54, 0.85)',
      glassBorder: 'rgba(42, 161, 152, 0.15)',
      glassBorderHighlight: 'rgba(42, 161, 152, 0.3)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.12)',
      glassShadow: '0 16px 36px -6px rgba(0, 20, 26, 0.8)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(42, 161, 152, 0.12) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(181, 137, 0, 0.1) 0px, transparent 45%)',
    },
  },

  // 14. Solarized Light
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    category: 'light',
    mode: 'light',
    description: 'Warm parchment cream with precision blue and solarized cyan.',
    preview: {
      bg: '#fdf6e3',
      surface: '#eee8d5',
      primary: '#268bd2',
      accent: '#2aa198',
    },
    tokens: {
      background: '44 87% 94%',
      foreground: '192 27% 35%',
      card: '44 50% 90%',
      cardForeground: '192 27% 35%',
      popover: '44 50% 90%',
      popoverForeground: '192 27% 35%',
      primary: '205 69% 49%',
      primaryForeground: '0 0% 100%',
      secondary: '44 30% 84%',
      secondaryForeground: '192 27% 35%',
      muted: '44 30% 84%',
      mutedForeground: '192 18% 50%',
      accent: '44 30% 84%',
      accentForeground: '192 27% 35%',
      destructive: '1 71% 52%',
      destructiveForeground: '0 0% 100%',
      border: '44 25% 78%',
      input: '44 25% 78%',
      ring: '205 69% 49%',
      accentPrimary: '#268bd2',
      colorBrandAccent: '#268bd2',
      accentGlow: 'rgba(38, 139, 210, 0.35)',
      glassBg: 'rgba(253, 246, 227, 0.88)',
      glassBorder: 'rgba(88, 110, 117, 0.14)',
      glassBorderHighlight: 'rgba(255, 255, 255, 0.95)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.85)',
      glassShadow: '0 8px 30px 0 rgba(147, 161, 161, 0.15)',
      ambientMesh: 'radial-gradient(at 0% 0%, rgba(38, 139, 210, 0.08) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(42, 161, 152, 0.06) 0px, transparent 50%)',
    },
  },

  // 15. Gruvbox Dark
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    category: 'retro',
    mode: 'dark',
    description: 'Retro groove warm earthy slate with goldenrod and terra cotta.',
    preview: {
      bg: '#282828',
      surface: '#3c3836',
      primary: '#fabd2f',
      accent: '#b8bb26',
    },
    tokens: {
      background: '30 7% 15%',
      foreground: '42 40% 85%',
      card: '30 6% 22%',
      cardForeground: '42 40% 85%',
      popover: '30 6% 22%',
      popoverForeground: '42 40% 85%',
      primary: '38 86% 50%',
      primaryForeground: '30 7% 15%',
      secondary: '30 6% 30%',
      secondaryForeground: '42 40% 85%',
      muted: '30 6% 26%',
      mutedForeground: '36 12% 60%',
      accent: '30 6% 30%',
      accentForeground: '42 40% 85%',
      destructive: '5 73% 52%',
      destructiveForeground: '42 40% 85%',
      border: '30 6% 32%',
      input: '30 6% 32%',
      ring: '38 86% 50%',
      accentPrimary: '#fabd2f',
      colorBrandAccent: '#fabd2f',
      accentGlow: 'rgba(250, 189, 47, 0.4)',
      glassBg: 'rgba(40, 40, 40, 0.82)',
      glassBorder: 'rgba(250, 189, 47, 0.15)',
      glassBorderHighlight: 'rgba(250, 189, 47, 0.3)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.12)',
      glassShadow: '0 16px 36px -6px rgba(20, 18, 16, 0.75)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(250, 189, 47, 0.12) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(184, 187, 38, 0.1) 0px, transparent 45%)',
    },
  },

  // 16. Rosé Pine
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    category: 'creative',
    mode: 'dark',
    description: 'Moody dark purple-slate with blush rose, seafoam, and gold.',
    preview: {
      bg: '#191724',
      surface: '#26233a',
      primary: '#eb6f92',
      accent: '#9ccfd8',
    },
    tokens: {
      background: '249 22% 12%',
      foreground: '245 50% 91%',
      card: '247 18% 16%',
      cardForeground: '245 50% 91%',
      popover: '247 18% 16%',
      popoverForeground: '245 50% 91%',
      primary: '343 76% 68%',
      primaryForeground: '249 22% 12%',
      secondary: '247 13% 26%',
      secondaryForeground: '245 50% 91%',
      muted: '247 13% 22%',
      mutedForeground: '248 15% 65%',
      accent: '197 49% 64%',
      accentForeground: '249 22% 12%',
      destructive: '343 76% 68%',
      destructiveForeground: '245 50% 91%',
      border: '247 13% 28%',
      input: '247 13% 28%',
      ring: '343 76% 68%',
      accentPrimary: '#eb6f92',
      colorBrandAccent: '#eb6f92',
      accentGlow: 'rgba(235, 111, 146, 0.45)',
      glassBg: 'rgba(25, 23, 36, 0.82)',
      glassBorder: 'rgba(235, 111, 146, 0.16)',
      glassBorderHighlight: 'rgba(156, 207, 216, 0.3)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.14)',
      glassShadow: '0 16px 40px -8px rgba(12, 10, 20, 0.8)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(235, 111, 146, 0.14) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(156, 207, 216, 0.12) 0px, transparent 45%)',
    },
  },

  // 17. Horizon Dark
  {
    id: 'horizon-dark',
    name: 'Horizon Dark',
    category: 'creative',
    mode: 'dark',
    description: 'Warm sunset neon dusk with apricot orange and magenta tones.',
    preview: {
      bg: '#1c1e26',
      surface: '#232530',
      primary: '#e95678',
      accent: '#fab795',
    },
    tokens: {
      background: '235 24% 13%',
      foreground: '230 18% 85%',
      card: '233 21% 17%',
      cardForeground: '230 18% 85%',
      popover: '233 21% 17%',
      popoverForeground: '230 18% 85%',
      primary: '12 85% 62%',
      primaryForeground: '235 24% 13%',
      secondary: '235 15% 25%',
      secondaryForeground: '230 18% 85%',
      muted: '235 15% 22%',
      mutedForeground: '235 12% 60%',
      accent: '37 90% 60%',
      accentForeground: '235 24% 13%',
      destructive: '12 85% 62%',
      destructiveForeground: '210 40% 98%',
      border: '235 15% 28%',
      input: '235 15% 28%',
      ring: '12 85% 62%',
      accentPrimary: '#e95678',
      colorBrandAccent: '#e95678',
      accentGlow: 'rgba(233, 86, 120, 0.45)',
      glassBg: 'rgba(28, 30, 38, 0.82)',
      glassBorder: 'rgba(233, 86, 120, 0.18)',
      glassBorderHighlight: 'rgba(250, 183, 149, 0.3)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.14)',
      glassShadow: '0 16px 40px -8px rgba(14, 15, 22, 0.8)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(233, 86, 120, 0.14) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(250, 183, 149, 0.12) 0px, transparent 45%)',
    },
  },

  // 18. Ayu Mirage
  {
    id: 'ayu-mirage',
    name: 'Ayu Mirage',
    category: 'dark',
    mode: 'dark',
    description: 'Nautical mid-tone twilight with bright tangerine and radiant gold.',
    preview: {
      bg: '#1f2430',
      surface: '#242936',
      primary: '#ffcc66',
      accent: '#ff8f40',
    },
    tokens: {
      background: '210 24% 16%',
      foreground: '210 25% 82%',
      card: '210 22% 20%',
      cardForeground: '210 25% 82%',
      popover: '210 22% 20%',
      popoverForeground: '210 25% 82%',
      primary: '36 100% 64%',
      primaryForeground: '210 24% 16%',
      secondary: '210 16% 28%',
      secondaryForeground: '210 25% 82%',
      muted: '210 16% 24%',
      mutedForeground: '210 14% 60%',
      accent: '15 100% 67%',
      accentForeground: '210 24% 16%',
      destructive: '350 85% 65%',
      destructiveForeground: '210 24% 16%',
      border: '210 16% 30%',
      input: '210 16% 30%',
      ring: '36 100% 64%',
      accentPrimary: '#ffcc66',
      colorBrandAccent: '#ffcc66',
      accentGlow: 'rgba(255, 204, 102, 0.4)',
      glassBg: 'rgba(31, 36, 48, 0.82)',
      glassBorder: 'rgba(255, 204, 102, 0.15)',
      glassBorderHighlight: 'rgba(255, 143, 64, 0.3)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
      glassShadow: '0 16px 36px -6px rgba(15, 18, 26, 0.75)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(255, 204, 102, 0.12) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(255, 143, 64, 0.12) 0px, transparent 45%)',
    },
  },

  // 19. Midnight OLED
  {
    id: 'midnight-oled',
    name: 'Midnight OLED',
    category: 'minimal',
    mode: 'dark',
    description: 'Pure true black (#000000) for OLED panels with phosphor emerald glow.',
    preview: {
      bg: '#000000',
      surface: '#0a100d',
      primary: '#10b981',
      accent: '#06b6d4',
    },
    tokens: {
      background: '0 0% 0%',
      foreground: '160 80% 95%',
      card: '160 15% 6%',
      cardForeground: '160 80% 95%',
      popover: '160 15% 6%',
      popoverForeground: '160 80% 95%',
      primary: '160 84% 45%',
      primaryForeground: '0 0% 0%',
      secondary: '160 15% 14%',
      secondaryForeground: '160 80% 95%',
      muted: '160 15% 10%',
      mutedForeground: '160 20% 60%',
      accent: '189 94% 48%',
      accentForeground: '0 0% 0%',
      destructive: '0 84% 60%',
      destructiveForeground: '0 0% 0%',
      border: '160 20% 18%',
      input: '160 20% 18%',
      ring: '160 84% 45%',
      accentPrimary: '#10b981',
      colorBrandAccent: '#10b981',
      accentGlow: 'rgba(16, 185, 129, 0.5)',
      glassBg: 'rgba(0, 0, 0, 0.88)',
      glassBorder: 'rgba(16, 185, 129, 0.22)',
      glassBorderHighlight: 'rgba(16, 185, 129, 0.45)',
      glassSpecular: 'inset 0 1px 0 0 rgba(16, 185, 129, 0.3)',
      glassShadow: '0 0 28px -4px rgba(16, 185, 129, 0.25)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(16, 185, 129, 0.16) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(6, 182, 212, 0.12) 0px, transparent 45%)',
    },
  },

  // 20. Vesper Noir
  {
    id: 'vesper-noir',
    name: 'Vesper Noir',
    category: 'minimal',
    mode: 'dark',
    description: 'Minimalist pitch noir with warm ember amber and jade green accents.',
    preview: {
      bg: '#101010',
      surface: '#1c1c1c',
      primary: '#ff8438',
      accent: '#50c878',
    },
    tokens: {
      background: '0 0% 6%',
      foreground: '0 0% 90%',
      card: '0 0% 11%',
      cardForeground: '0 0% 90%',
      popover: '0 0% 11%',
      popoverForeground: '0 0% 90%',
      primary: '28 90% 55%',
      primaryForeground: '0 0% 6%',
      secondary: '0 0% 18%',
      secondaryForeground: '0 0% 90%',
      muted: '0 0% 15%',
      mutedForeground: '0 0% 60%',
      accent: '142 52% 55%',
      accentForeground: '0 0% 6%',
      destructive: '0 75% 55%',
      destructiveForeground: '0 0% 90%',
      border: '0 0% 20%',
      input: '0 0% 20%',
      ring: '28 90% 55%',
      accentPrimary: '#ff8438',
      colorBrandAccent: '#ff8438',
      accentGlow: 'rgba(255, 132, 56, 0.45)',
      glassBg: 'rgba(16, 16, 16, 0.85)',
      glassBorder: 'rgba(255, 255, 255, 0.08)',
      glassBorderHighlight: 'rgba(255, 132, 56, 0.3)',
      glassSpecular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.14)',
      glassShadow: '0 16px 36px -6px rgba(0, 0, 0, 0.85)',
      ambientMesh: 'radial-gradient(at 10% 10%, rgba(255, 132, 56, 0.12) 0px, transparent 45%), radial-gradient(at 90% 90%, rgba(80, 200, 120, 0.1) 0px, transparent 45%)',
    },
  },
];

export function getThemePreset(id: string): StudioThemePreset {
  return STUDIO_THEME_PRESETS.find((p) => p.id === id) || STUDIO_THEME_PRESETS[0];
}

export function getAllThemePresets(): StudioThemePreset[] {
  return STUDIO_THEME_PRESETS;
}

export function getPresetsByCategory(category: ThemePresetCategory | 'all'): StudioThemePreset[] {
  if (category === 'all') return STUDIO_THEME_PRESETS;
  return STUDIO_THEME_PRESETS.filter((p) => p.category === category);
}

export type ThemeMode = 'dark' | 'light';
export type GlassStyle = 'specular' | 'frosted' | 'cyber';
export type BlurIntensity = 'low' | 'medium' | 'high';
/** @deprecated Dynamic accent override removed in favor of pure theme palette control */
export type AccentColor = 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose';

export interface ThemePreferences {
  presetId?: string;
  mode: ThemeMode;
  glassStyle: GlassStyle;
  blurIntensity: BlurIntensity;
  /** @deprecated Dynamic accent override removed in favor of pure theme palette control */
  accentColor?: string;
}

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  mode: 'dark',
  glassStyle: 'specular',
  blurIntensity: 'medium',
};

export const DEFAULT_PREFERENCES = DEFAULT_THEME_PREFERENCES;
export const THEME_STORAGE_KEY = 'acc_studio_theme_prefs';

export function applyThemeToDocument(preferences: ThemePreferences): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const isDark = preferences.mode === 'dark';

  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);
  root.style.colorScheme = preferences.mode;

  const presetId = preferences.presetId || 'obsidian';
  const preset = getThemePreset(presetId);

  root.setAttribute('data-theme-mode', preferences.mode);
  root.setAttribute('data-theme-preset', preset.id);
  root.setAttribute('data-glass-style', preferences.glassStyle);
  root.setAttribute('data-blur-intensity', preferences.blurIntensity);

  // 1. Theme Palette Exclusively Controls Color Theme
  const t = preset.tokens;
  root.style.setProperty('--background', t.background);
  root.style.setProperty('--foreground', t.foreground);
  root.style.setProperty('--card', t.card);
  root.style.setProperty('--card-foreground', t.cardForeground);
  root.style.setProperty('--popover', t.popover);
  root.style.setProperty('--popover-foreground', t.popoverForeground);
  root.style.setProperty('--secondary', t.secondary);
  root.style.setProperty('--secondary-foreground', t.secondaryForeground);
  root.style.setProperty('--muted', t.muted);
  root.style.setProperty('--muted-foreground', t.mutedForeground);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-foreground', t.accentForeground);
  root.style.setProperty('--destructive', t.destructive);
  root.style.setProperty('--destructive-foreground', t.destructiveForeground);
  root.style.setProperty('--border', t.border);
  root.style.setProperty('--input', t.input);
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--ring', t.ring);
  root.style.setProperty('--accent-primary', t.accentPrimary);
  root.style.setProperty('--color-brand-accent', t.colorBrandAccent);
  root.style.setProperty('--accent-glow', t.accentGlow);

  // 2. Glass Refraction Profiles ONLY Dictate Liquid Glass Effect
  root.style.setProperty('--glass-bg', t.glassBg);

  if (preferences.glassStyle === 'frosted') {
    root.style.setProperty('--glass-specular', 'none');
    root.style.setProperty('--glass-border', t.glassBorder);
    root.style.setProperty('--glass-border-highlight', t.glassBorder);
    root.style.setProperty(
      '--glass-shadow',
      isDark ? '0 6px 20px 0 rgba(0, 0, 0, 0.4)' : '0 4px 16px 0 rgba(0, 0, 0, 0.05)'
    );
  } else if (preferences.glassStyle === 'cyber') {
    root.style.setProperty(
      '--glass-specular',
      `inset 0 1px 0 0 color-mix(in srgb, ${t.accentPrimary} 30%, transparent)`
    );
    root.style.setProperty('--glass-border-highlight', t.accentPrimary);
    root.style.setProperty(
      '--glass-border',
      `color-mix(in srgb, ${t.accentPrimary} 45%, transparent)`
    );
    root.style.setProperty(
      '--glass-shadow',
      `0 0 24px -4px color-mix(in srgb, ${t.accentPrimary} 30%, transparent)`
    );
  } else {
    // 'specular' (Default native specular sheen with sharpened rim)
    root.style.setProperty('--glass-specular', t.glassSpecular);
    root.style.setProperty('--glass-border', t.glassBorder);
    root.style.setProperty('--glass-border-highlight', t.glassBorderHighlight);
    root.style.setProperty('--glass-shadow', t.glassShadow);
  }

  // Decoupled Acrylic Blur Intensity
  if (preferences.blurIntensity === 'low') {
    root.style.setProperty('--glass-blur', 'blur(6px)');
  } else if (preferences.blurIntensity === 'high') {
    root.style.setProperty('--glass-blur', 'blur(40px)');
  } else {
    root.style.setProperty('--glass-blur', 'blur(18px)');
  }

  if (t.ambientMesh) {
    root.style.setProperty('--ambient-mesh', t.ambientMesh);
  }

  // 3. Studio Splash Modal System Theme Synchronization
  root.style.setProperty(
    '--splash-backdrop-bg',
    isDark ? '#020617cc' : 'rgba(241, 245, 249, 0.88)'
  );
  root.style.setProperty(
    '--splash-ambient-mesh',
    t.ambientMesh ||
      `radial-gradient(circle at 50% 42%, color-mix(in srgb, ${t.accentPrimary} 14%, transparent) 0%, transparent 60%)`
  );
}
