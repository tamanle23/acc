import type { StudioState, PaletteTokens } from './studio';

export interface TemplatePreset {
  id: string;
  title: string;
  category: 'Music' | 'Fashion' | 'Tech' | 'Cinema';
  badge: string;
  statePatch: Partial<StudioState>;
}

export interface BrandArchetype {
  id: string;
  name: string;
  accent: string;
  patch: Partial<StudioState>;
}

export interface CuratedPalette {
  name: string;
  palette: PaletteTokens;
}

