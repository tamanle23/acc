// ============================================================================
// KINETIX STUDIO v5.0 - DYNAMIC GENRE FONT CATALOG & W3C FONTLIFECYCLE
// Loads curated Google Fonts on demand and maps authentic system fallback chains
// ============================================================================

export interface GenreFontDef {
  id: string;
  name: string;
  category: 'Serif' | 'Grotesk' | 'Monospace' | 'Display' | 'Woodblock';
  googleFamily: string;
  weights: number[];
  systemFallback: string;
  recommendedSpheres: string[];
}

export const GENRE_FONT_CATALOG: GenreFontDef[] = [
  // 1. Haute Couture Didone Modern Serif
  {
    id: 'bodoni-moda',
    name: 'Bodoni Moda',
    category: 'Serif',
    googleFamily: 'Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900',
    weights: [400, 600, 700, 900],
    systemFallback: '"Didot", "Bodoni MT", "Playfair Display", serif',
    recommendedSpheres: ['editorial', 'classical'],
  },
  // 2. Archival Venetian & Old-Style Serif
  {
    id: 'cormorant-garamond',
    name: 'Cormorant Garamond',
    category: 'Serif',
    googleFamily: 'Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400',
    weights: [400, 600, 700],
    systemFallback: '"Garamond", "Baskerville", "Times New Roman", serif',
    recommendedSpheres: ['editorial', 'nature-zen'],
  },
  // 3. Swiss Neo-Grotesque
  {
    id: 'space-grotesk',
    name: 'Space Grotesk',
    category: 'Grotesk',
    googleFamily: 'Space+Grotesk:wght@400;500;700',
    weights: [400, 500, 700],
    systemFallback: '"Neue Haas Grotesk", "Helvetica Neue", "Arial", sans-serif',
    recommendedSpheres: ['modernism', 'architecture', 'cinema'],
  },
  // 4. Blue Note Condensed Woodblock Gothic
  {
    id: 'bebas-neue',
    name: 'Bebas Neue',
    category: 'Woodblock',
    googleFamily: 'Bebas+Neue',
    weights: [400],
    systemFallback: '"Impact", "Oswald", "Franklin Gothic Heavy", sans-serif',
    recommendedSpheres: ['music', 'activism'],
  },
  // 5. Inscriptional Roman Caps & Noir
  {
    id: 'cinzel',
    name: 'Cinzel',
    category: 'Display',
    googleFamily: 'Cinzel:wght@400;700;900',
    weights: [400, 700, 900],
    systemFallback: '"Trajan Pro", "Copperplate", "Times New Roman", serif',
    recommendedSpheres: ['cinema', 'classical'],
  },
  // 6. Modernist Geometric Art
  {
    id: 'syne',
    name: 'Syne',
    category: 'Display',
    googleFamily: 'Syne:wght@700;800',
    weights: [700, 800],
    systemFallback: '"Century Gothic", "Futura", sans-serif',
    recommendedSpheres: ['club-kinetic', 'music'],
  },
  // 7. Architectural Technical Monospace
  {
    id: 'space-mono',
    name: 'Space Mono',
    category: 'Monospace',
    googleFamily: 'Space+Mono:ital,wght@0,400;0,700;1,400',
    weights: [400, 700],
    systemFallback: '"SF Mono", "Courier New", monospace',
    recommendedSpheres: ['modernism', 'architecture', 'activism'],
  },
  // 8. Cybernetic Code & Telemetry
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    category: 'Monospace',
    googleFamily: 'JetBrains+Mono:wght@400;700;800',
    weights: [400, 700, 800],
    systemFallback: '"Menlo", "Consolas", monospace',
    recommendedSpheres: ['speculative', 'club-kinetic'],
  },
];

const loadedFonts = new Set<string>();
const loadingPromises = new Map<string, Promise<boolean>>();

/**
 * Returns complete CSS font-family string including system fallbacks.
 */
export function getFontFamilyWithFallback(family: string): string {
  const match = GENRE_FONT_CATALOG.find(
    (f) => f.name.toLowerCase() === family.toLowerCase() || f.id === family
  );
  if (match) {
    return `"${match.name}", ${match.systemFallback}`;
  }
  return `"${family}", sans-serif`;
}

/**
 * Checks whether a font family is loaded or registered.
 */
export function isGenreFontLoaded(family: string): boolean {
  return loadedFonts.has(family.toLowerCase());
}

/**
 * Asynchronously loads a Google Font by family name using W3C FontFace API & CSS injection.
 */
export async function ensureGenreFontLoaded(family: string): Promise<boolean> {
  const key = family.toLowerCase();
  if (loadedFonts.has(key)) return true;
  if (loadingPromises.has(key)) return loadingPromises.get(key)!;

  const match = GENRE_FONT_CATALOG.find(
    (f) => f.name.toLowerCase() === key || f.id === key
  );
  if (!match) return false;

  const promise = (async () => {
    if (typeof document === 'undefined') return true;

    // Inject Google Fonts link tag if missing
    const linkId = `kx-font-${match.id}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${match.googleFamily}&display=swap`;
      document.head.appendChild(link);
    }

    // Await W3C FontFace readiness
    if ('fonts' in document) {
      try {
        const weight = match.weights[0] || 400;
        await document.fonts.load(`${weight} 16px "${match.name}"`);
        loadedFonts.add(key);
        return true;
      } catch {
        // Fall back gracefully to system font and clear promise so retry is possible
        loadingPromises.delete(key);
        return false;
      }
    }
    loadedFonts.add(key);
    return true;
  })();

  loadingPromises.set(key, promise);
  return promise;
}
