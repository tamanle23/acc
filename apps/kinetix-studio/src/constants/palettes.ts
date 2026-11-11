import type { CuratedPalette } from '@/types/preset';

// Curated Studio Palettes across High-Key Light, Paper/Print & Low-Key Dark Atmospheres
export const CURATED_PALETTES: CuratedPalette[] = [
  // High-Key & Paper / Print Mode Palettes (Subtractive Ink Physics)
  {
    name: 'Swiss Signal Red',
    palette: { bg: '#ffffff', surface: '#f4f4f5', ink: '#09090b', accent: '#dc2626', accent2: '#2563eb' },
  },
  {
    name: 'Editorial Cream',
    palette: { bg: '#fbf8f2', surface: '#f3ece1', ink: '#1c1917', accent: '#b45309', accent2: '#78716c' },
  },
  {
    name: 'Blue Note Duo',
    palette: { bg: '#f5efe6', surface: '#ebe3d5', ink: '#0f172a', accent: '#1d4ed8', accent2: '#ea580c' },
  },
  {
    name: 'Botanical Sage',
    palette: { bg: '#f2f5f3', surface: '#e1e8e3', ink: '#14241a', accent: '#2d6a4f', accent2: '#d4a373' },
  },
  {
    name: 'Risograph Atelier',
    palette: { bg: '#fefce8', surface: '#fef9c3', ink: '#0f172a', accent: '#f43f5e', accent2: '#0284c7' },
  },
  {
    name: 'Raw Concrete',
    palette: { bg: '#e2e4e6', surface: '#cfd3d6', ink: '#0f172a', accent: '#475569', accent2: '#f97316' },
  },

  // Low-Key Dark & Cyber / Club Palettes (Additive Light Physics)
  {
    name: 'Acid Volt',
    palette: { bg: '#08090c', surface: '#12151e', ink: '#f8fafc', accent: '#ccff00', accent2: '#00f0ff' },
  },
  {
    name: 'Velvet Cinematheque',
    palette: { bg: '#1b070f', surface: '#2d0f1b', ink: '#fdf2f8', accent: '#fbbf24', accent2: '#f43f5e' },
  },
  {
    name: 'Cyber Cobalt',
    palette: { bg: '#030812', surface: '#09162e', ink: '#ecfeff', accent: '#00f0ff', accent2: '#6366f1' },
  },
  {
    name: 'Grasse Gold',
    palette: { bg: '#0d0a08', surface: '#1c1512', ink: '#fdf8f5', accent: '#e6b88a', accent2: '#9a6b48' },
  },
  {
    name: 'Infrared Club',
    palette: { bg: '#090608', surface: '#1a1014', ink: '#fff1f2', accent: '#ff2a5f', accent2: '#ffb800' },
  },
  {
    name: 'Ultraviolet Chrome',
    palette: { bg: '#080514', surface: '#170e30', ink: '#f5f3ff', accent: '#c084fc', accent2: '#2dd4bf' },
  },
];
