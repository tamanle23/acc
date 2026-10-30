import { ContentCacheRegistry, CacheNamespace } from '@acc/core-isomorphic';
import { LUTPresets, CubeLUTGenerator, type ColorPipeline } from './LutCubeGenerator';
import { CubeLUTParser } from './CubeParser';

/** All supported named preset keys (aliases → canonical pipeline) */
const PRESET_MAP: Record<string, ColorPipeline> = {
  // Canonical preset names
  teal_and_orange: LUTPresets.tealAndOrange,
  kodak_2383: LUTPresets.kodak2383,
  bleach_bypass: LUTPresets.bleachBypass,
  sci_fi_moody: LUTPresets.sciFiMoody,
  light_and_airy: LUTPresets.lightAndAiry,
  cyberpunk: LUTPresets.cyberpunk,
  vintage_faded: LUTPresets.vintageFaded,
  monochrome_noir: LUTPresets.monochromeNoir,
  // Demo alias keys (used in IR demos)
  warm_golden: LUTPresets.tealAndOrange,
  cool_steel: LUTPresets.sciFiMoody,
};

export interface ResolvedLut {
  readonly data: Float32Array;
  readonly size: number;
}

/** All supported preset key names for schema select options */
export const LUT_PRESET_KEYS = Object.keys(PRESET_MAP);

/**
 * Resolves a named LUT preset key to baked Float32Array data.
 * Results are cached in ContentCacheRegistry(VFX namespace) as Blob bytes
 * so the bake (O(size^3) ops) only runs once per process lifetime.
 *
 * @param key  - one of the keys in PRESET_MAP
 * @param size - LUT grid size (9, 17, or 33). Default 17 for canvas preview.
 */
export async function resolveLutPreset(
  key: string,
  size: number = 17
): Promise<ResolvedLut | null> {
  const pipeline = PRESET_MAP[key];
  if (!pipeline) return null;

  const cacheKey = `lut-preset/${key}/${size}`;
  const cache = ContentCacheRegistry.namespace(CacheNamespace.VFX);

  // Cache hit: deserialize from Blob
  const cached = await cache.get(cacheKey);
  if (cached) {
    const buf = await cached.arrayBuffer();
    return { data: new Float32Array(buf), size };
  }

  // Cache miss: bake LUT from pipeline
  const streamResult = CubeLUTGenerator.generateStream(`lut-${key}`, pipeline, size);
  if (!streamResult.ok) return null;

  const parseResult = await CubeLUTParser.parseStream(streamResult.value);
  if (!parseResult.ok) return null;

  const { data } = parseResult.value;

  // Store raw Float32Array bytes as Blob
  await cache.set(cacheKey, new Blob([data.buffer]), {
    mimeType: 'application/octet-stream',
    sizeBytes: data.byteLength,
    checksum: `lut-${key}-${size}`,
  });

  return { data, size };
}
