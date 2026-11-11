import type { StudioState, SubsystemId, ConfigDiffEntry, PaletteTokens } from '@/types/studio';
import type { FpsCadence } from '@/types/motion';
import { INITIAL_STUDIO_STATE } from '@/constants/initial-state';
import { BRAND_ARCHETYPES } from '@/constants/archetypes';
import { CURATED_PALETTES } from '@/constants/palettes';
import { LAYOUT_ENGINES, resolveLegacyLayout } from '@/constants/spatial-layouts';
import { BACKGROUND_GRAPHICS_CATALOG } from '@/constants/background-graphics';
import { SHADER_CATALOG } from '@/constants/shaders';
import { HERO_CATALOG } from '@/constants/heroes';
import { EASING_CATALOG } from '@/constants/easings';
import { KINETIC_TYPE_CATALOG } from '@/constants/kinetic-types';
import { SYNTH_PATTERNS } from '@/engine/audio-synth';
import { synthesizePalette } from '@/core/domain/color';

/**
 * Validates and sanitizes a raw configuration object, returning a clean StudioState
 * with safe defaults for any missing or invalid tokens.
 */
export function validateStudioConfig(data: unknown): {
  valid: boolean;
  errors: string[];
  config?: StudioState;
} {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Configuration payload must be an object'] };
  }

  const raw = data as Record<string, unknown>;
  const base = { ...INITIAL_STUDIO_STATE };

  // Validate Palette
  let palette = base.palette;
  if (raw.palette && typeof raw.palette === 'object') {
    const p = raw.palette as Record<string, unknown>;
    palette = {
      bg: typeof p.bg === 'string' ? p.bg : base.palette.bg,
      surface: typeof p.surface === 'string' ? p.surface : base.palette.surface,
      ink: typeof p.ink === 'string' ? p.ink : base.palette.ink,
      accent: typeof p.accent === 'string' ? p.accent : base.palette.accent,
      accent2: typeof p.accent2 === 'string' ? p.accent2 : base.palette.accent2,
    };
  }

  // Validate Content Payload
  let content = base.content;
  if (raw.content && typeof raw.content === 'object') {
    const c = raw.content as Record<string, unknown>;
    const headline = Array.isArray(c.headline) && c.headline.length === 3
      ? [String(c.headline[0]), String(c.headline[1]), String(c.headline[2])] as [string, string, string]
      : base.content.headline;

    content = {
      headline,
      subhead: typeof c.subhead === 'string' ? c.subhead : base.content.subhead,
      date: typeof c.date === 'string' ? c.date : base.content.date,
      location: typeof c.location === 'string' ? c.location : base.content.location,
      tag: typeof c.tag === 'string' ? c.tag : base.content.tag,
      sponsor: typeof c.sponsor === 'string' ? c.sponsor : base.content.sponsor,
    };
  }

  // Merge validated properties with clamping
  const sanitized: StudioState = {
    ...base,
    ...raw,
    palette,
    content,
    // Numerical clamps
    fps: typeof raw.fps === 'number' && (raw.fps === 12 || raw.fps === 24 || raw.fps === 30 || raw.fps === 60) ? (raw.fps as FpsCadence) : base.fps,
    durationSec: typeof raw.durationSec === 'number' ? Math.max(2, Math.min(30, raw.durationSec)) : base.durationSec,
    bpm: typeof raw.bpm === 'number' ? Math.max(60, Math.min(180, raw.bpm)) : base.bpm,
    bgOpacity: typeof raw.bgOpacity === 'number' ? Math.max(0, Math.min(1, raw.bgOpacity)) : base.bgOpacity,
    bgScale: typeof raw.bgScale === 'number' ? Math.max(0.2, Math.min(4, raw.bgScale)) : base.bgScale,
    shaderOpacity: typeof raw.shaderOpacity === 'number' ? Math.max(0, Math.min(1, raw.shaderOpacity)) : base.shaderOpacity,
    shaderTurbulence: typeof raw.shaderTurbulence === 'number' ? Math.max(0, Math.min(2, raw.shaderTurbulence)) : base.shaderTurbulence,
    stageShape: typeof raw.stageShape === 'string' ? (raw.stageShape as StudioState['stageShape']) : base.stageShape,
    stageAspect: typeof raw.stageAspect === 'string' ? (raw.stageAspect as StudioState['stageAspect']) : base.stageAspect,
    stageScale: typeof raw.stageScale === 'number' ? Math.max(0.5, Math.min(1.6, raw.stageScale)) : base.stageScale,
    stageCornerRadius: typeof raw.stageCornerRadius === 'number' ? Math.max(0, Math.min(48, raw.stageCornerRadius)) : base.stageCornerRadius,
    stageOffsetY: typeof raw.stageOffsetY === 'number' ? Math.max(-100, Math.min(100, raw.stageOffsetY)) : base.stageOffsetY,
    stageOpacity: typeof raw.stageOpacity === 'number' ? Math.max(0, Math.min(1, raw.stageOpacity)) : base.stageOpacity,
    stageColor: typeof raw.stageColor === 'string' ? raw.stageColor : base.stageColor,
    stageBorderColor: typeof raw.stageBorderColor === 'string' ? raw.stageBorderColor : base.stageBorderColor,
    stageBlurPx: typeof raw.stageBlurPx === 'number' ? Math.max(0, Math.min(30, raw.stageBlurPx)) : base.stageBlurPx,
    stageBorderOpacity: typeof raw.stageBorderOpacity === 'number' ? Math.max(0, Math.min(1, raw.stageBorderOpacity)) : base.stageBorderOpacity,
    stageBorderWidth: typeof raw.stageBorderWidth === 'number' ? Math.max(0.5, Math.min(10, raw.stageBorderWidth)) : (base.stageBorderWidth ?? 1.5),
    heroScale: typeof raw.heroScale === 'number' ? Math.max(0.4, Math.min(2.5, raw.heroScale)) : base.heroScale,
    gridMarginPx: typeof raw.gridMarginPx === 'number' ? Math.max(8, Math.min(64, raw.gridMarginPx)) : base.gridMarginPx,
    shaderParams: typeof raw.shaderParams === 'object' && raw.shaderParams !== null ? (raw.shaderParams as Record<string, number | boolean | string>) : {},
    heroParams: typeof raw.heroParams === 'object' && raw.heroParams !== null ? (raw.heroParams as Record<string, number | boolean | string>) : {},
    bgParams: typeof raw.bgParams === 'object' && raw.bgParams !== null ? (raw.bgParams as Record<string, number | boolean | string>) : {},
  };

  if (sanitized.layoutId && (!sanitized.layoutEngine || !sanitized.layoutVariant)) {
    const res = resolveLegacyLayout(sanitized.layoutId);
    sanitized.layoutEngine = res.engine;
    sanitized.layoutVariant = res.variant;
  }

  return { valid: errors.length === 0, errors, config: sanitized };
}

/**
 * Computes a list of human-readable diff entries between the current StudioState
 * and the default patch of the active archetype (or canonical initial state).
 */
export function diffAgainstArchetype(current: StudioState, archetypeId: string): ConfigDiffEntry[] {
  const archetype = BRAND_ARCHETYPES.find((a) => a.id === archetypeId);
  const baseline: Partial<StudioState> = archetype ? archetype.patch : {};
  const diffs: ConfigDiffEntry[] = [];

  // Spatial differences
  if (baseline.layoutId && current.layoutId !== baseline.layoutId) {
    diffs.push({
      subsystem: 'spatial',
      field: 'layoutId',
      label: 'Spatial Layout',
      currentValue: current.layoutId,
      referenceValue: baseline.layoutId,
    });
  }
  if (typeof baseline.topHeadlineFlow === 'boolean' && current.topHeadlineFlow !== baseline.topHeadlineFlow) {
    diffs.push({
      subsystem: 'spatial',
      field: 'topHeadlineFlow',
      label: 'Top Headline Z-Flow',
      currentValue: current.topHeadlineFlow,
      referenceValue: baseline.topHeadlineFlow,
    });
  }
  if (typeof baseline.blueprintGrid === 'boolean' && current.blueprintGrid !== baseline.blueprintGrid) {
    diffs.push({
      subsystem: 'spatial',
      field: 'blueprintGrid',
      label: 'Blueprint Grid',
      currentValue: current.blueprintGrid,
      referenceValue: baseline.blueprintGrid,
    });
  }

  // Layer 0 Background differences
  if (current.bgGraphicId !== 'duotone-mesh') {
    diffs.push({
      subsystem: 'background',
      field: 'bgGraphicId',
      label: 'Background Graphic',
      currentValue: current.bgGraphicId,
      referenceValue: 'duotone-mesh',
    });
  }
  if (Math.abs(current.bgScale - 1.0) > 0.05) {
    diffs.push({
      subsystem: 'background',
      field: 'bgScale',
      label: 'Background Scale',
      currentValue: Number(current.bgScale.toFixed(2)),
      referenceValue: 1.0,
    });
  }

  // Layer 1 Ambient Shader differences
  if (baseline.shaderId && current.shaderId !== baseline.shaderId) {
    diffs.push({
      subsystem: 'ambient',
      field: 'shaderId',
      label: 'Ambient Shader',
      currentValue: current.shaderId,
      referenceValue: baseline.shaderId,
    });
  }

  // Layer 2/3 Hero differences
  if (baseline.heroId && current.heroId !== baseline.heroId) {
    diffs.push({
      subsystem: 'hero',
      field: 'heroId',
      label: 'Hero Subject',
      currentValue: current.heroId,
      referenceValue: baseline.heroId,
    });
  }
  if (current.stageShape && current.stageShape !== 'auto') {
    diffs.push({
      subsystem: 'hero',
      field: 'stageShape',
      label: 'Stage Geometry Shape',
      currentValue: current.stageShape,
      referenceValue: 'auto',
    });
  }
  if (current.stageAspect && current.stageAspect !== 'auto') {
    diffs.push({
      subsystem: 'hero',
      field: 'stageAspect',
      label: 'Stage Aspect Shape',
      currentValue: current.stageAspect,
      referenceValue: 'auto',
    });
  }
  if (typeof current.stageScale === 'number' && Math.abs(current.stageScale - 1.0) > 0.05) {
    diffs.push({
      subsystem: 'hero',
      field: 'stageScale',
      label: 'Stage Scale',
      currentValue: Number(current.stageScale.toFixed(2)),
      referenceValue: 1.0,
    });
  }
  if (typeof current.stageOpacity === 'number' && Math.abs(current.stageOpacity - 0.5) > 0.05) {
    diffs.push({
      subsystem: 'hero',
      field: 'stageOpacity',
      label: 'Stage Surface Opacity',
      currentValue: `${Math.round(current.stageOpacity * 100)}%`,
      referenceValue: '50%',
    });
  }
  if (current.stageColor && current.stageColor !== 'auto') {
    diffs.push({
      subsystem: 'hero',
      field: 'stageColor',
      label: 'Stage Fill Color',
      currentValue: current.stageColor,
      referenceValue: 'auto',
    });
  }
  if (current.stageBorderColor && current.stageBorderColor !== 'accent') {
    diffs.push({
      subsystem: 'hero',
      field: 'stageBorderColor',
      label: 'Stage Border Color',
      currentValue: current.stageBorderColor,
      referenceValue: 'accent',
    });
  }
  if (typeof current.stageBorderWidth === 'number' && Math.abs(current.stageBorderWidth - 1.5) > 0.1) {
    diffs.push({
      subsystem: 'hero',
      field: 'stageBorderWidth',
      label: 'Stage Border Width',
      currentValue: `${current.stageBorderWidth}px`,
      referenceValue: '1.5px',
    });
  }

  // Motion differences
  if (baseline.easingId && current.easingId !== baseline.easingId) {
    diffs.push({
      subsystem: 'motion',
      field: 'easingId',
      label: 'Motion Easing',
      currentValue: current.easingId,
      referenceValue: baseline.easingId,
    });
  }
  if (baseline.kineticTypeId && current.kineticTypeId !== baseline.kineticTypeId) {
    diffs.push({
      subsystem: 'motion',
      field: 'kineticTypeId',
      label: 'Kinetic Typography Mode',
      currentValue: current.kineticTypeId,
      referenceValue: baseline.kineticTypeId,
    });
  }

  // Palette differences
  if (baseline.palette) {
    const keys: Array<keyof PaletteTokens> = ['bg', 'surface', 'ink', 'accent', 'accent2'];
    for (const k of keys) {
      if (current.palette[k] !== baseline.palette[k]) {
        diffs.push({
          subsystem: 'palette',
          field: `palette.${k}`,
          label: `Color [${k.toUpperCase()}]`,
          currentValue: current.palette[k],
          referenceValue: baseline.palette[k],
        });
      }
    }
  }

  return diffs;
}

/**
 * Generates a targeted partial state patch that resets only the requested subsystem
 * while strictly preserving other configurations and the user's custom text payload.
 */
export function getSubsystemResetPatch(
  subsystem: SubsystemId,
  current: StudioState,
  archetypeId?: string
): Partial<StudioState> {
  const activeArch = BRAND_ARCHETYPES.find((a) => a.id === (archetypeId ?? current.archetypeId));
  const archPatch = activeArch?.patch ?? {};

  switch (subsystem) {
    case 'palette':
      return {
        palette: archPatch.palette ?? INITIAL_STUDIO_STATE.palette,
      };

    case 'spatial': {
      const legacyId = archPatch.layoutId ?? INITIAL_STUDIO_STATE.layoutId;
      const res = resolveLegacyLayout(legacyId);
      return {
        aspectRatio: '9:16',
        layoutEngine: archPatch.layoutEngine ?? res.engine,
        layoutVariant: archPatch.layoutVariant ?? res.variant,
        layoutId: legacyId,
        topHeadlineFlow: archPatch.topHeadlineFlow ?? INITIAL_STUDIO_STATE.topHeadlineFlow,
        safeZone916: false,
        blueprintGrid: archPatch.blueprintGrid ?? false,
        gridMarginPx: 24,
      };
    }

    case 'background':
      return {
        bgGraphicId: 'duotone-mesh',
        bgOpacity: 0.85,
        bgScale: 1.0,
        bgBlurPx: 0,
        bgBlendMode: 'normal',
        bgDuotone: false,
        bgMotion: true,
        bgCustomImageKey: null,
        bgParams: {},
      };

    case 'ambient':
      return {
        shaderId: archPatch.shaderId ?? INITIAL_STUDIO_STATE.shaderId,
        shaderOpacity: 0.88,
        shaderTurbulence: 1.0,
        shaderParams: {},
      };

    case 'hero':
      return {
        heroId: archPatch.heroId ?? INITIAL_STUDIO_STATE.heroId,
        heroMotion: 'turntable',
        heroScale: 1.12,
        heroMicroKinetics: true,
        stageShape: 'auto',
        stageAspect: 'auto',
        stageScale: 1.0,
        stageCornerRadius: 10,
        stageOffsetY: 0,
        stageOpacity: 0.5,
        stageColor: 'auto',
        stageBorderColor: 'accent',
        stageBlurPx: 8,
        stageBorderOpacity: 0.45,
        stageBorderWidth: 1.5,
        heroBreakout: true,
        doubleExposure: false,
        heroParams: {},
      };

    case 'motion':
      return {
        easingId: archPatch.easingId ?? INITIAL_STUDIO_STATE.easingId,
        kineticTypeId: archPatch.kineticTypeId ?? INITIAL_STUDIO_STATE.kineticTypeId,
        fps: 60,
        durationSec: 8,
        playbackSpeed: 1.0,
        loopRange: [0, 1],
        primaryFocusZone: 'hero',
        heroBudget: 60,
        ambientBudget: 30,
        metaBudget: 10,
        staggerMs: 60,
      };

    case 'audio':
      return {
        audioReactive: false,
        synthAudioSound: false,
        bpm: 128,
        synthPattern: 'techno-4-on-floor',
        synthMasterVolume: 0.7,
        synthFilterCutoff: 4200,
        synthFilterResonance: 3.5,
        synthVoiceMutes: {
          kick: false,
          bass: false,
          hat: false,
          pad: false,
        },
      };

    case 'surface':
      return {
        liquidWarp: false,
        lightLeaks: archPatch.lightLeaks ?? true,
        vhsGrain: true,
        collageEdges: false,
      };

    case 'payload':
      return {
        content: INITIAL_STUDIO_STATE.content,
      };

    default:
      return {};
  }
}

/**
 * Creative Shuffler: Palette
 * Returns a high-contrast palette from either curated sets or harmonic synthesis.
 */
export function shufflePalette(): PaletteTokens {
  const roll = Math.random();
  if (roll < 0.5) {
    const p = CURATED_PALETTES[Math.floor(Math.random() * CURATED_PALETTES.length)];
    return p.palette;
  }
  return synthesizePalette();
}

/**
 * Creative Shuffler: Spatial Layout across 6 Engines & Variants
 */
export function shuffleLayout(): Partial<StudioState> {
  const engines = Object.values(LAYOUT_ENGINES);
  const eng = engines[Math.floor(Math.random() * engines.length)];
  const variant = eng.variants[Math.floor(Math.random() * eng.variants.length)];
  return {
    layoutEngine: eng.type,
    layoutVariant: variant.id,
    layoutId: variant.legacyLayoutId,
    gridMarginPx: 16 + Math.floor(Math.random() * 8) * 4,
  };
}

/**
 * Creative Shuffler: Aesthetic Harmony (Layer 0 Background + Layer 1 Shader + Layer 2/3 Hero)
 */
export function shuffleAesthetics(): Partial<StudioState> {
  const bg = BACKGROUND_GRAPHICS_CATALOG[Math.floor(Math.random() * BACKGROUND_GRAPHICS_CATALOG.length)];
  const shader = SHADER_CATALOG[Math.floor(Math.random() * SHADER_CATALOG.length)];
  const hero = HERO_CATALOG[Math.floor(Math.random() * HERO_CATALOG.length)];

  return {
    bgGraphicId: bg.id === 'custom-image' ? 'duotone-mesh' : bg.id,
    shaderId: shader.id,
    heroId: hero.id,
    heroScale: 0.95 + Math.random() * 0.35,
    shaderTurbulence: 0.6 + Math.random() * 0.8,
    bgScale: 0.9 + Math.random() * 0.3,
  };
}

/**
 * Creative Shuffler: Audio Synthesizer
 */
export function shuffleAudio(): Partial<StudioState> {
  const pattern = SYNTH_PATTERNS[Math.floor(Math.random() * SYNTH_PATTERNS.length)];
  const bpms = [118, 124, 128, 132, 138, 140, 144];
  const bpm = bpms[Math.floor(Math.random() * bpms.length)];

  return {
    synthPattern: pattern.id,
    bpm,
    synthFilterCutoff: 2000 + Math.floor(Math.random() * 4000),
    synthFilterResonance: 2 + Math.floor(Math.random() * 5),
  };
}

/**
 * Full Studio Creative Re-roll (Preserving User Text Payload)
 */
export function shuffleAll(current: StudioState): Partial<StudioState> {
  const aes = shuffleAesthetics();
  const pal = shufflePalette();
  const sp = shuffleLayout();
  const aud = shuffleAudio();

  const easing = EASING_CATALOG[Math.floor(Math.random() * EASING_CATALOG.length)];
  const kinetic = KINETIC_TYPE_CATALOG[Math.floor(Math.random() * KINETIC_TYPE_CATALOG.length)];

  return {
    ...aes,
    ...sp,
    ...aud,
    palette: pal,
    easingId: easing.id,
    kineticTypeId: kinetic.id,
    // Preserve custom text content!
    content: current.content,
  };
}
