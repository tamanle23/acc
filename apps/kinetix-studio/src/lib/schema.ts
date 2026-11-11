import type { StudioState, PaletteTokens, ContentPayload, LayerVisibility } from '@/types/studio';
import type { LayoutEngineType } from '@/types/spatial';
import { validateStudioConfig } from './config-engine';
import { resolveLegacyLayout, getLegacyLayoutId } from '@/constants/spatial-layouts';

/**
 * Generates the full 4-Layer Declarative JSON Contract (v4.1).
 */
export function generateDeclarativeSchema(state: StudioState, wcagContrast: number = 4.5): string {
  const visualStack = {
    backgroundPlate: {
      graphicId: state.bgGraphicId,
      opacity: state.bgOpacity,
      scale: state.bgScale,
      blurPx: state.bgBlurPx,
      blendMode: state.bgBlendMode,
      duotoneRemapping: state.bgDuotone,
      driftMotion: state.bgMotion,
      customImageKey: state.bgCustomImageKey,
      params: state.bgParams,
    },
    ambientPlate: {
      shaderId: state.shaderId,
      opacity: state.shaderOpacity,
      turbulence: state.shaderTurbulence,
      params: state.shaderParams,
    },
    heroStage: {
      component: 'hero-window-frame',
      shape: state.stageShape,
      aspect: state.stageAspect,
      scale: state.stageScale,
      cornerRadiusPx: state.stageCornerRadius,
      offsetY: state.stageOffsetY,
      opacity: state.stageOpacity,
      color: state.stageColor,
      borderColor: state.stageBorderColor,
      backdropBlurPx: state.stageBlurPx,
      borderOpacity: state.stageBorderOpacity,
      borderWidthPx: state.stageBorderWidth ?? 1.5,
      breakout25D: state.heroBreakout,
      doubleExposureMask: state.doubleExposure,
    },
    heroSubject: {
      id: state.heroId,
      motionBehavior: state.heroMotion,
      scale: state.heroScale,
      microKinetics: state.heroMicroKinetics,
      customLottieLoaded: Boolean(state.customLottieJson),
      params: state.heroParams,
    },
    surfaceTreatments: {
      lightLeaks: state.lightLeaks,
      vhsGrain: state.vhsGrain,
      liquidWarp: state.liquidWarp,
      collageEdges: state.collageEdges,
    },
    layerVisibility: state.layerVisibility,
  };

  return JSON.stringify(
    {
      $schema: 'https://kinetix.studio/schemas/v4.1/poster.json',
      posterId: state.posterId,
      archetypeId: state.archetypeId,
      format: {
        aspectRatio: state.aspectRatio,
        fps: state.fps,
        durationSec: state.durationSec,
        timelineMode: state.timelineMode,
        playbackSpeed: state.playbackSpeed,
        loopRange: state.loopRange,
        seamlessPeriodic: '2πk',
      },
      spatialSkeleton: {
        engine: state.layoutEngine,
        variant: state.layoutVariant,
        layoutId: state.layoutId,
        topHeadlineZFlow: state.topHeadlineFlow,
        safeZone916: state.safeZone916,
        blueprintGrid: state.blueprintGrid,
        gridMarginPx: state.gridMarginPx,
      },
      visualStack,
      visualHierarchy: visualStack,
      palette: state.palette,
      motionTokens: {
        easingId: state.easingId,
        kineticTypeId: state.kineticTypeId,
        primaryFocusZone: state.primaryFocusZone,
        budget60_30_10: {
          heroFocalPct: state.heroBudget,
          ambientAndTypePct: state.ambientBudget,
          metadataPct: state.metaBudget,
        },
        bpmSynth: {
          active: state.audioReactive,
          audible: state.synthAudioSound,
          bpm: state.bpm,
          pattern: state.synthPattern,
          masterVolume: state.synthMasterVolume,
          filterCutoff: state.synthFilterCutoff,
          filterResonance: state.synthFilterResonance,
          voiceMutes: state.synthVoiceMutes,
        },
      },
      accessibilityGuardrails: {
        wcagContrast: `${wcagContrast}:1`,
        opticalSafetyMaxHz: '3.0Hz',
        hicksLawDisclosure: state.hicksLawDisclosure,
      },
      payload: state.content,
    },
    null,
    2
  );
}

/**
 * Bidirectional Schema Parser: Parses incoming JSON string (declarative contract or raw state)
 * and returns a sanitized Partial<StudioState> patch.
 */
export function importDeclarativeSchema(jsonString: string): {
  success: boolean;
  state?: Partial<StudioState>;
  error?: string;
} {
  try {
    const raw = JSON.parse(jsonString);
    if (!raw || typeof raw !== 'object') {
      return { success: false, error: 'JSON payload must be a non-null object' };
    }

    const patch: Partial<StudioState> = {};

    // 1. Direct flat state keys if present
    if (raw.aspectRatio) patch.aspectRatio = raw.aspectRatio;
    if (raw.fps) patch.fps = raw.fps;
    if (raw.durationSec) patch.durationSec = raw.durationSec;
    if (raw.timelineMode) patch.timelineMode = raw.timelineMode;
    if (raw.layoutId) patch.layoutId = raw.layoutId;
    if (raw.bgGraphicId) patch.bgGraphicId = raw.bgGraphicId;
    if (raw.shaderId) patch.shaderId = raw.shaderId;
    if (raw.heroId) patch.heroId = raw.heroId;
    if (raw.easingId) patch.easingId = raw.easingId;
    if (raw.kineticTypeId) patch.kineticTypeId = raw.kineticTypeId;
    if (raw.palette) patch.palette = raw.palette as PaletteTokens;
    if (raw.content) patch.content = raw.content as ContentPayload;
    if (raw.bpm) patch.bpm = raw.bpm;

    // 2. Format block
    if (raw.format && typeof raw.format === 'object') {
      const f = raw.format as Record<string, unknown>;
      if (f.aspectRatio) patch.aspectRatio = f.aspectRatio as StudioState['aspectRatio'];
      if (typeof f.fps === 'number') patch.fps = f.fps as StudioState['fps'];
      if (typeof f.durationSec === 'number') patch.durationSec = f.durationSec;
      if (f.timelineMode) patch.timelineMode = f.timelineMode as StudioState['timelineMode'];
      if (typeof f.playbackSpeed === 'number') patch.playbackSpeed = f.playbackSpeed;
      if (Array.isArray(f.loopRange) && f.loopRange.length === 2) {
        patch.loopRange = [Number(f.loopRange[0]), Number(f.loopRange[1])];
      }
    }

    // 3. Spatial skeleton block
    if (raw.spatialSkeleton && typeof raw.spatialSkeleton === 'object') {
      const sp = raw.spatialSkeleton as Record<string, unknown>;
      if (sp.engine) patch.layoutEngine = sp.engine as LayoutEngineType;
      if (sp.variant) patch.layoutVariant = sp.variant as string;
      if (sp.layoutId) patch.layoutId = sp.layoutId as StudioState['layoutId'];

      if (patch.layoutEngine && patch.layoutVariant && !patch.layoutId) {
        patch.layoutId = getLegacyLayoutId(patch.layoutEngine, patch.layoutVariant);
      } else if (patch.layoutId && (!patch.layoutEngine || !patch.layoutVariant)) {
        const resolved = resolveLegacyLayout(patch.layoutId);
        patch.layoutEngine = resolved.engine;
        patch.layoutVariant = resolved.variant;
      }

      if (typeof sp.topHeadlineZFlow === 'boolean') patch.topHeadlineFlow = sp.topHeadlineZFlow;
      if (typeof sp.safeZone916 === 'boolean') patch.safeZone916 = sp.safeZone916;
      if (typeof sp.blueprintGrid === 'boolean') patch.blueprintGrid = sp.blueprintGrid;
      if (typeof sp.gridMarginPx === 'number') patch.gridMarginPx = sp.gridMarginPx;
    }

    // 4. Visual stack block (4 Layers)
    if (raw.visualStack && typeof raw.visualStack === 'object') {
      const vs = raw.visualStack as Record<string, unknown>;

      // Layer 0: Background Plate
      if (vs.backgroundPlate && typeof vs.backgroundPlate === 'object') {
        const bg = vs.backgroundPlate as Record<string, unknown>;
        if (bg.graphicId) patch.bgGraphicId = bg.graphicId as StudioState['bgGraphicId'];
        if (typeof bg.opacity === 'number') patch.bgOpacity = bg.opacity;
        if (typeof bg.scale === 'number') patch.bgScale = bg.scale;
        if (typeof bg.blurPx === 'number') patch.bgBlurPx = bg.blurPx;
        if (bg.blendMode) patch.bgBlendMode = bg.blendMode as StudioState['bgBlendMode'];
        if (typeof bg.duotoneRemapping === 'boolean') patch.bgDuotone = bg.duotoneRemapping;
        if (typeof bg.driftMotion === 'boolean') patch.bgMotion = bg.driftMotion;
        if (typeof bg.customImageKey === 'string' || bg.customImageKey === null) {
          patch.bgCustomImageKey = bg.customImageKey as string | null;
        }
        if (bg.params && typeof bg.params === 'object') {
          patch.bgParams = bg.params as Record<string, number | boolean | string>;
        }
      }

      // Layer 1: Ambient Plate
      if (vs.ambientPlate && typeof vs.ambientPlate === 'object') {
        const amb = vs.ambientPlate as Record<string, unknown>;
        if (amb.shaderId) patch.shaderId = amb.shaderId as StudioState['shaderId'];
        if (typeof amb.opacity === 'number') patch.shaderOpacity = amb.opacity;
        if (typeof amb.turbulence === 'number') patch.shaderTurbulence = amb.turbulence;
        if (amb.params && typeof amb.params === 'object') {
          patch.shaderParams = amb.params as Record<string, number | boolean | string>;
        }
      }

      // Layer 2: Hero Stage
      if (vs.heroStage && typeof vs.heroStage === 'object') {
        const st = vs.heroStage as Record<string, unknown>;
        if (typeof st.shape === 'string') patch.stageShape = st.shape as StudioState['stageShape'];
        if (typeof st.aspect === 'string') patch.stageAspect = st.aspect as StudioState['stageAspect'];
        if (typeof st.scale === 'number') patch.stageScale = st.scale;
        if (typeof st.cornerRadiusPx === 'number') patch.stageCornerRadius = st.cornerRadiusPx;
        if (typeof st.offsetY === 'number') patch.stageOffsetY = st.offsetY;
        if (typeof st.opacity === 'number') patch.stageOpacity = st.opacity;
        if (typeof st.color === 'string') patch.stageColor = st.color as StudioState['stageColor'];
        if (typeof st.borderColor === 'string') patch.stageBorderColor = st.borderColor as StudioState['stageBorderColor'];
        if (typeof st.backdropBlurPx === 'number') patch.stageBlurPx = st.backdropBlurPx;
        if (typeof st.borderOpacity === 'number') patch.stageBorderOpacity = st.borderOpacity;
        if (typeof st.borderWidthPx === 'number') patch.stageBorderWidth = st.borderWidthPx;
        if (typeof st.breakout25D === 'boolean') patch.heroBreakout = st.breakout25D;
        if (typeof st.doubleExposureMask === 'boolean') patch.doubleExposure = st.doubleExposureMask;
      }

      // Layer 3: Hero Subject
      if (vs.heroSubject && typeof vs.heroSubject === 'object') {
        const hs = vs.heroSubject as Record<string, unknown>;
        if (hs.id) patch.heroId = hs.id as StudioState['heroId'];
        if (hs.motionBehavior) patch.heroMotion = hs.motionBehavior as StudioState['heroMotion'];
        if (typeof hs.scale === 'number') patch.heroScale = hs.scale;
        if (typeof hs.microKinetics === 'boolean') patch.heroMicroKinetics = hs.microKinetics;
        if (hs.params && typeof hs.params === 'object') {
          patch.heroParams = hs.params as Record<string, number | boolean | string>;
        }
      }

      // Surface Treatments
      if (vs.surfaceTreatments && typeof vs.surfaceTreatments === 'object') {
        const st = vs.surfaceTreatments as Record<string, unknown>;
        if (typeof st.lightLeaks === 'boolean') patch.lightLeaks = st.lightLeaks;
        if (typeof st.vhsGrain === 'boolean') patch.vhsGrain = st.vhsGrain;
        if (typeof st.liquidWarp === 'boolean') patch.liquidWarp = st.liquidWarp;
        if (typeof st.collageEdges === 'boolean') patch.collageEdges = st.collageEdges;
      }

      // Layer Visibility
      if (vs.layerVisibility && typeof vs.layerVisibility === 'object') {
        patch.layerVisibility = vs.layerVisibility as LayerVisibility;
      }
    }

    // 5. Motion tokens
    if (raw.motionTokens && typeof raw.motionTokens === 'object') {
      const mt = raw.motionTokens as Record<string, unknown>;
      if (mt.easingId) patch.easingId = mt.easingId as StudioState['easingId'];
      if (mt.kineticTypeId) patch.kineticTypeId = mt.kineticTypeId as StudioState['kineticTypeId'];
      if (mt.primaryFocusZone) patch.primaryFocusZone = mt.primaryFocusZone as StudioState['primaryFocusZone'];

      if (mt.budget60_30_10 && typeof mt.budget60_30_10 === 'object') {
        const b = mt.budget60_30_10 as Record<string, unknown>;
        if (typeof b.heroFocalPct === 'number') patch.heroBudget = b.heroFocalPct;
        if (typeof b.ambientAndTypePct === 'number') patch.ambientBudget = b.ambientAndTypePct;
        if (typeof b.metadataPct === 'number') patch.metaBudget = b.metadataPct;
      }

      if (mt.bpmSynth && typeof mt.bpmSynth === 'object') {
        const syn = mt.bpmSynth as Record<string, unknown>;
        if (typeof syn.active === 'boolean') patch.audioReactive = syn.active;
        if (typeof syn.audible === 'boolean') patch.synthAudioSound = syn.audible;
        if (typeof syn.bpm === 'number') patch.bpm = syn.bpm;
        if (syn.pattern) patch.synthPattern = syn.pattern as StudioState['synthPattern'];
        if (typeof syn.masterVolume === 'number') patch.synthMasterVolume = syn.masterVolume;
        if (typeof syn.filterCutoff === 'number') patch.synthFilterCutoff = syn.filterCutoff;
        if (typeof syn.filterResonance === 'number') patch.synthFilterResonance = syn.filterResonance;
        if (syn.voiceMutes && typeof syn.voiceMutes === 'object') {
          patch.synthVoiceMutes = syn.voiceMutes as StudioState['synthVoiceMutes'];
        }
      }
    }

    // 6. Payload block
    if (raw.payload && typeof raw.payload === 'object') {
      patch.content = raw.payload as ContentPayload;
    }

    // 7. Palette
    if (raw.palette && typeof raw.palette === 'object') {
      patch.palette = raw.palette as PaletteTokens;
    }

    // Validate and sanitize the assembled patch
    const validation = validateStudioConfig(patch);
    if (!validation.valid && validation.errors.length > 0) {
      return { success: false, error: validation.errors.join('; ') };
    }

    return { success: true, state: patch };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Invalid JSON format',
    };
  }
}
