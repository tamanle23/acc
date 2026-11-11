// ============================================================================
// KINETIX STUDIO - STUDIO CHROME THEME MANAGER TYPES
// Deep integration with Tailwind CSS & shadcn/ui design tokens
// ============================================================================

export type ThemeMode = 'dark' | 'light' | 'system' | 'auto';

export type ThemeCategory =
  | 'modern'
  | 'minimal'
  | 'tech'
  | 'editorial'
  | 'vibrant'
  | 'custom';

export interface StudioThemeTokens {
  background: string; // Hex e.g. #09090b
  foreground: string; // Hex e.g. #fafafa
  card: string; // Hex e.g. #121216
  cardForeground: string; // Hex e.g. #fafafa
  popover: string; // Hex e.g. #121216
  popoverForeground: string; // Hex e.g. #fafafa
  primary: string; // Hex e.g. #ccff00 (Kinetix Volt)
  primaryForeground: string; // Hex e.g. #09090b
  secondary: string; // Hex e.g. #1b1b22
  secondaryForeground: string; // Hex e.g. #fafafa
  muted: string; // Hex e.g. #1b1b22
  mutedForeground: string; // Hex e.g. #a1a1aa
  accent: string; // Hex e.g. #27272a
  accentForeground: string; // Hex e.g. #fafafa
  destructive: string; // Hex e.g. #f43f5e
  destructiveForeground: string; // Hex e.g. #fafafa
  border: string; // Hex e.g. #27272a
  input: string; // Hex e.g. #27272a
  ring: string; // Hex e.g. #ccff00
}

export interface StudioThemePreset {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  category: ThemeCategory;
  description: string;
  isCustom?: boolean;
  tokens: StudioThemeTokens;
}

export interface ThemeContextValue {
  activeTheme: StudioThemePreset;
  activeThemeId: string;
  mode: ThemeMode;
  resolvedMode: 'dark' | 'light';
  customThemes: StudioThemePreset[];
  allPresets: StudioThemePreset[];
  setThemePreset: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  saveCustomTheme: (name: string, tokens: StudioThemeTokens) => StudioThemePreset;
  deleteCustomTheme: (id: string) => void;
  updateCustomTheme: (id: string, tokens: StudioThemeTokens) => void;
}
