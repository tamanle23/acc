import type { ResolvedTimeline } from '../types/VideoIR';

/**
 * Standard aspect ratios strictly supported across the platform.
 */
export type StandardAspectRatio =
  | '16:9'
  | '9:16'
  | '1:1'
  | '4:5'
  | '21:9'
  | '4:3'
  | '2.39:1';

export type AspectRatioOrientation = 'landscape' | 'portrait' | 'square' | 'cinematic';

export interface AspectRatioPresetDefinition {
  ratio: StandardAspectRatio;
  label: string;
  category: 'social' | 'broadcast' | 'cinema' | 'classic';
  orientation: AspectRatioOrientation;
  canonicalWidth: number;
  canonicalHeight: number;
  numericRatio: number;
  description: string;
}

export interface VideoExportPreset {
  id: string;
  aspectRatio: StandardAspectRatio;
  label: string;
  badge: string;
  width: number;
  height: number;
  recommendedBitrateBps: number;
  description: string;
}

/**
 * Canonical 1080p-class reference dimensions for each aspect ratio.
 */
export const ASPECT_RATIO_PRESETS: readonly AspectRatioPresetDefinition[] = [
  {
    ratio: '16:9',
    label: '16:9 Widescreen',
    category: 'broadcast',
    orientation: 'landscape',
    canonicalWidth: 1920,
    canonicalHeight: 1080,
    numericRatio: 16 / 9,
    description: 'Universal standard for YouTube, Vimeo, standard web, and broadcast TV.',
  },
  {
    ratio: '9:16',
    label: '9:16 Vertical',
    category: 'social',
    orientation: 'portrait',
    canonicalWidth: 1080,
    canonicalHeight: 1920,
    numericRatio: 9 / 16,
    description: 'Full HD vertical standard for TikTok, Instagram Reels, and YouTube Shorts.',
  },
  {
    ratio: '1:1',
    label: '1:1 Square',
    category: 'social',
    orientation: 'square',
    canonicalWidth: 1080,
    canonicalHeight: 1080,
    numericRatio: 1.0,
    description: 'Square aspect ratio for Instagram grid feeds, LinkedIn, and Twitter/X cards.',
  },
  {
    ratio: '4:5',
    label: '4:5 Portrait',
    category: 'social',
    orientation: 'portrait',
    canonicalWidth: 1080,
    canonicalHeight: 1350,
    numericRatio: 4 / 5,
    description: 'Optimal screen coverage for Instagram and Facebook portrait feed posts.',
  },
  {
    ratio: '21:9',
    label: '21:9 UltraWide',
    category: 'cinema',
    orientation: 'cinematic',
    canonicalWidth: 2560,
    canonicalHeight: 1080,
    numericRatio: 64 / 27,
    description: 'UltraWide panoramic cinema format for gaming trailers and ultrawide monitors.',
  },
  {
    ratio: '4:3',
    label: '4:3 Classic',
    category: 'classic',
    orientation: 'landscape',
    canonicalWidth: 1440,
    canonicalHeight: 1080,
    numericRatio: 4 / 3,
    description: 'Classic TV and academy ratio for vintage, CRT simulation, and archival footage.',
  },
  {
    ratio: '2.39:1',
    label: '2.39:1 Scope',
    category: 'cinema',
    orientation: 'cinematic',
    canonicalWidth: 2580,
    canonicalHeight: 1080,
    numericRatio: 2580 / 1080,
    description: 'Theatrical anamorphic scope format for widescreen cinematic master deliveries.',
  },
] as const;

/**
 * Standard delivery resolution presets mapped per aspect ratio.
 */
export const VIDEO_EXPORT_PRESETS: readonly VideoExportPreset[] = [
  // --- 16:9 Widescreen ---
  {
    id: '16_9_4k',
    aspectRatio: '16:9',
    label: 'YouTube / Master 4K UHD',
    badge: '4K UHD',
    width: 3840,
    height: 2160,
    recommendedBitrateBps: 16_000_000,
    description: 'Ultra High Definition broadcast master for 4K displays and client delivery.',
  },
  {
    id: '16_9_2k',
    aspectRatio: '16:9',
    label: 'YouTube / QHD 1440p',
    badge: '2K QHD',
    width: 2560,
    height: 1440,
    recommendedBitrateBps: 10_000_000,
    description: 'Crisp Quad HD resolution optimal for web previews and desktop monitors.',
  },
  {
    id: '16_9_1080p',
    aspectRatio: '16:9',
    label: 'Standard Web 1080p',
    badge: '1080p FHD',
    width: 1920,
    height: 1080,
    recommendedBitrateBps: 6_000_000,
    description: 'Full HD industry standard recommended for general web distribution.',
  },
  {
    id: '16_9_720p',
    aspectRatio: '16:9',
    label: 'Fast Web Draft 720p',
    badge: '720p HD',
    width: 1280,
    height: 720,
    recommendedBitrateBps: 3_000_000,
    description: 'Lightweight draft resolution for fast rendering and bandwidth savings.',
  },

  // --- 9:16 Vertical ---
  {
    id: '9_16_4k',
    aspectRatio: '9:16',
    label: 'TikTok / Reels 4K Master',
    badge: '4K Vertical',
    width: 2160,
    height: 3840,
    recommendedBitrateBps: 14_000_000,
    description: 'Ultra-crisp vertical master for high-end mobile productions.',
  },
  {
    id: '9_16_2k',
    aspectRatio: '9:16',
    label: 'High-Res Vertical 1440p',
    badge: '2K Vertical',
    width: 1440,
    height: 2560,
    recommendedBitrateBps: 9_000_000,
    description: 'Super-sampled vertical format for vibrant social video playback.',
  },
  {
    id: '9_16_1080p',
    aspectRatio: '9:16',
    label: 'TikTok / Reels / Shorts 1080p',
    badge: 'FHD Vertical',
    width: 1080,
    height: 1920,
    recommendedBitrateBps: 6_000_000,
    description: 'The native standard for TikTok, Instagram Reels, and YouTube Shorts.',
  },
  {
    id: '9_16_720p',
    aspectRatio: '9:16',
    label: 'Mobile Fast Draft 720p',
    badge: 'HD Vertical',
    width: 720,
    height: 1280,
    recommendedBitrateBps: 3_000_000,
    description: 'Fast preview vertical export for mobile checks and test streams.',
  },

  // --- 1:1 Square ---
  {
    id: '1_1_4k',
    aspectRatio: '1:1',
    label: 'Square 4K Master',
    badge: '2160p Square',
    width: 2160,
    height: 2160,
    recommendedBitrateBps: 12_000_000,
    description: 'Maximum quality square master for high-DPI displays.',
  },
  {
    id: '1_1_1080p',
    aspectRatio: '1:1',
    label: 'Instagram / LinkedIn Square 1080p',
    badge: '1080p Square',
    width: 1080,
    height: 1080,
    recommendedBitrateBps: 5_000_000,
    description: 'Native square feed format for Instagram, LinkedIn, and X.',
  },
  {
    id: '1_1_720p',
    aspectRatio: '1:1',
    label: 'Square Draft 720p',
    badge: '720p Square',
    width: 720,
    height: 720,
    recommendedBitrateBps: 2_500_000,
    description: 'Lightweight square draft format for quick exports.',
  },

  // --- 4:5 Portrait ---
  {
    id: '4_5_2k',
    aspectRatio: '4:5',
    label: 'High-Res Portrait Feed 1440p',
    badge: '2K Portrait',
    width: 1440,
    height: 1800,
    recommendedBitrateBps: 8_000_000,
    description: 'Super-sampled portrait feed format for Instagram & Facebook.',
  },
  {
    id: '4_5_1080p',
    aspectRatio: '4:5',
    label: 'Instagram / FB Feed Portrait 1080p',
    badge: '1080p Portrait',
    width: 1080,
    height: 1350,
    recommendedBitrateBps: 5_500_000,
    description: 'Maximum vertical feed height for Instagram and Facebook without being a reel.',
  },
  {
    id: '4_5_720p',
    aspectRatio: '4:5',
    label: 'Portrait Feed Draft 720p',
    badge: '720p Portrait',
    width: 720,
    height: 900,
    recommendedBitrateBps: 2_500_000,
    description: 'Compact portrait feed export for test reviews.',
  },

  // --- 21:9 UltraWide ---
  {
    id: '21_9_4k',
    aspectRatio: '21:9',
    label: 'UltraWide 4K Master (UW4K)',
    badge: '4K UltraWide',
    width: 3840,
    height: 1620,
    recommendedBitrateBps: 16_000_000,
    description: 'UltraWide 4K theatrical master for panoramic presentations.',
  },
  {
    id: '21_9_1080p',
    aspectRatio: '21:9',
    label: 'UltraWide 1080p (UW-FHD)',
    badge: '1080p UltraWide',
    width: 2560,
    height: 1080,
    recommendedBitrateBps: 8_000_000,
    description: 'Standard ultrawide format matching 2560x1080 displays.',
  },
  {
    id: '21_9_720p',
    aspectRatio: '21:9',
    label: 'UltraWide Draft 720p',
    badge: '720p UltraWide',
    width: 1720,
    height: 720,
    recommendedBitrateBps: 3_500_000,
    description: 'Draft resolution for ultrawide video sequences.',
  },

  // --- 4:3 Classic ---
  {
    id: '4_3_4k',
    aspectRatio: '4:3',
    label: 'Archival 4K Academy',
    badge: '4K 4:3',
    width: 2880,
    height: 2160,
    recommendedBitrateBps: 14_000_000,
    description: 'High-resolution restoration format for classic and archival footage.',
  },
  {
    id: '4_3_1080p',
    aspectRatio: '4:3',
    label: 'Classic Academy 1080p',
    badge: '1080p 4:3',
    width: 1440,
    height: 1080,
    recommendedBitrateBps: 5_000_000,
    description: 'Standard 4:3 format for retro and classic video styles.',
  },
  {
    id: '4_3_720p',
    aspectRatio: '4:3',
    label: 'Classic TV Draft 720p',
    badge: '720p 4:3',
    width: 960,
    height: 720,
    recommendedBitrateBps: 2_500_000,
    description: 'Fast preview format for 4:3 content.',
  },

  // --- 2.39:1 Cinema Scope ---
  {
    id: '2_39_1_4k',
    aspectRatio: '2.39:1',
    label: 'DCI 4K Cinema Scope',
    badge: 'DCI 4K Scope',
    width: 4096,
    height: 1716,
    recommendedBitrateBps: 20_000_000,
    description: 'Digital Cinema Initiatives (DCI) 4K theatrical anamorphic scope standard.',
  },
  {
    id: '2_39_1_1080p',
    aspectRatio: '2.39:1',
    label: 'Cinema Scope 1080p',
    badge: '1080p Scope',
    width: 2580,
    height: 1080,
    recommendedBitrateBps: 8_000_000,
    description: 'Full HD theatrical anamorphic scope standard.',
  },
];

/**
 * Returns canonical 1080p-class dimensions for a standard aspect ratio.
 */
export function getCanonicalCanvasSize(aspectRatio: StandardAspectRatio): { w: number; h: number } {
  const match = ASPECT_RATIO_PRESETS.find((p) => p.ratio === aspectRatio);
  if (match) {
    return { w: match.canonicalWidth, h: match.canonicalHeight };
  }
  return { w: 1920, h: 1080 };
}

/**
 * Infers closest standard aspect ratio from pixel dimensions within 2% margin.
 * Defaults cleanly to '16:9' if unrecognized.
 */
export function inferAspectRatioFromCanvasSize(w: number, h: number): StandardAspectRatio {
  if (!w || !h || w <= 0 || h <= 0) return '16:9';
  const targetRatio = w / h;

  let closestRatio: StandardAspectRatio = '16:9';
  let minDiff = Infinity;

  for (const preset of ASPECT_RATIO_PRESETS) {
    const diff = Math.abs(preset.numericRatio - targetRatio) / preset.numericRatio;
    if (diff < minDiff) {
      minDiff = diff;
      closestRatio = preset.ratio;
    }
  }

  // Allow up to 3% aspect tolerance for legacy non-standard sizes, otherwise fallback to 16:9
  if (minDiff <= 0.03) {
    return closestRatio;
  }
  return '16:9';
}

/**
 * Returns canonical reference dimensions (refW, refH) for any arbitrary canvas dimensions.
 * Used for render-time proportional scaling of pixel offsets in modifiers.
 */
export function getReferenceDimensionsForCanvas(w: number, h: number): { refW: number; refH: number } {
  const ratio = inferAspectRatioFromCanvasSize(w, h);
  const size = getCanonicalCanvasSize(ratio);
  return { refW: size.w, refH: size.h };
}

/**
 * Returns matching delivery presets for a given aspect ratio.
 */
export function getExportPresetsForAspectRatio(aspectRatio: StandardAspectRatio): VideoExportPreset[] {
  return VIDEO_EXPORT_PRESETS.filter((p) => p.aspectRatio === aspectRatio);
}

/**
 * Returns a lightweight O(1) shallow-cloned ResolvedTimeline configured with target resolution.
 * Zero track, sequence, or modifier mutation or deep cloning.
 */
export function withTargetCanvasSize(
  timeline: ResolvedTimeline,
  targetWidth: number,
  targetHeight: number
): ResolvedTimeline {
  if (
    timeline.meta.canvasSize &&
    timeline.meta.canvasSize.w === targetWidth &&
    timeline.meta.canvasSize.h === targetHeight
  ) {
    return timeline;
  }
  return {
    ...timeline,
    meta: {
      ...timeline.meta,
      canvasSize: {
        w: targetWidth,
        h: targetHeight,
      },
    },
  };
}
