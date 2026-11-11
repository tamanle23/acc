// ============================================================================
// KINETIX STUDIO v5.0 - DYNAMIC BROWSER FONT INGESTION
// Loads user .woff2, .ttf, .otf font files via the W3C FontFace API, registers
// them into document.fonts, and caches them in IndexedDB for session persistence.
// ============================================================================

import { saveAsset, listAssets } from './asset-store';

export interface CustomFontMeta {
  key: string;
  fontFamily: string;
  fileName: string;
  sizeBytes: number;
}

const activeFonts = new Map<string, FontFace>();

export async function loadCustomFontFile(file: File): Promise<CustomFontMeta> {
  const arrayBuffer = await file.arrayBuffer();
  // Sanitize family name from filename
  const cleanName = file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const fontFamily = `KinetixCustom_${cleanName}`;
  const key = `font_${fontFamily}`;

  // Register with browser CSS Font Loading API
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      const fontFace = new FontFace(fontFamily, arrayBuffer);
      await fontFace.load();
      document.fonts.add(fontFace);
      activeFonts.set(fontFamily, fontFace);
    } catch (err) {
      console.warn('FontFace registration warning:', err);
    }
  }

  // Cache in IndexedDB
  await saveAsset(key, arrayBuffer, 'font', file.name, file.type);

  return {
    key,
    fontFamily,
    fileName: file.name,
    sizeBytes: file.size,
  };
}

export async function restoreCachedFonts(): Promise<CustomFontMeta[]> {
  const records = await listAssets('font');
  const restored: CustomFontMeta[] = [];

  for (const record of records) {
    if (record.data instanceof ArrayBuffer) {
      const fontFamily = record.key.replace(/^font_/, '');
      if (typeof document !== 'undefined' && 'fonts' in document) {
        try {
          const fontFace = new FontFace(fontFamily, record.data);
          await fontFace.load();
          document.fonts.add(fontFace);
          activeFonts.set(fontFamily, fontFace);
          restored.push({
            key: record.key,
            fontFamily,
            fileName: record.name,
            sizeBytes: record.sizeBytes,
          });
        } catch {
          // Ignore restore error for corrupted fonts
        }
      }
    }
  }
  return restored;
}
