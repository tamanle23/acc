// ============================================================================
// KINETIX STUDIO v5.1 - OPEN-SOURCE REAL-WORLD MEDIA ASSET CONTRACTS
// Type definitions for CC0, Public Domain, and permissive media assets:
// Photography, Motion Video Footages & Overlays, and Audio Soundscapes & Stems.
// ============================================================================

export type MediaType = 'image' | 'video' | 'audio';

export type MediaLicense = 'CC0' | 'Public Domain' | 'Open Source' | 'MIT';

export type MediaCategory =
  | 'Archival & Art'
  | 'Editorial & Fashion'
  | 'Urban & Modernism'
  | 'Nature & Texture'
  | 'Festive & Cultural'
  | 'Cinema & Overlays'
  | 'Audio & Beats';

export interface MediaCatalogItem {
  id: string;
  name: string;
  category: MediaCategory;
  mediaType: MediaType;
  url: string;
  thumbUrl?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  license: MediaLicense;
  author: string;
  source: string;
  tags: string[];
  recommendedSpheres?: string[];
  dataUriFallback?: string;
}
