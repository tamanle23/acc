import { describe, it, expect } from 'bun:test';
import {
  INITIAL_STUDIO_STATE,
  BRAND_ARCHETYPES,
  validateStudioConfig,
  diffAgainstArchetype,
  getSubsystemResetPatch,
  shufflePalette,
  shuffleLayout,
  shuffleAesthetics,
  shuffleAudio,
  shuffleAll,
  generateDeclarativeSchema,
  importDeclarativeSchema,
  encodeStateToUrlHash,
  decodeStateFromUrl,
  saveUserPreset,
  loadUserPresets,
  deleteUserPreset,
  exportPresetsToJson,
  importPresetsFromJson,
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
  studioRegistry,
} from '../src/index';

describe('Kinetix Studio Flexible Configuration Engine Suite', () => {
  it('validates and sanitizes studio configurations with safe fallbacks and clamps', () => {
    const raw = {
      fps: 999, // invalid fps
      durationSec: 100, // exceeds max 30s
      bpm: 300, // exceeds max 180
      bgOpacity: -0.5, // below 0
      heroScale: 5.0, // exceeds max 2.5
      palette: { bg: '#123456' },
      content: { headline: ['A', 'B', 'C'] },
    };

    const result = validateStudioConfig(raw);
    expect(result.valid).toBe(true);
    expect(result.config).toBeDefined();
    if (result.config) {
      expect(result.config.fps).toBe(60); // fallback to 60
      expect(result.config.durationSec).toBe(30); // clamped to 30
      expect(result.config.bpm).toBe(180); // clamped to 180
      expect(result.config.bgOpacity).toBe(0); // clamped to 0
      expect(result.config.heroScale).toBe(2.5); // clamped to 2.5
      expect(result.config.palette.bg).toBe('#123456');
      expect(result.config.palette.ink).toBe(INITIAL_STUDIO_STATE.palette.ink);
      expect(result.config.content.headline).toEqual(['A', 'B', 'C']);
    }
  });

  it('detects archetype token diffs accurately', () => {
    const brutalist = BRAND_ARCHETYPES.find((a) => a.id === 'brutalist-club')!;
    const pureState = {
      ...INITIAL_STUDIO_STATE,
      archetypeId: brutalist.id,
      ...brutalist.patch,
    };

    // A pure state matching archetype patch should have zero or minimal diffs
    const initialDiffs = diffAgainstArchetype(pureState, brutalist.id);

    // Modify a few tokens
    const modifiedState = {
      ...pureState,
      bgGraphicId: 'caution-stripes' as const,
      bgScale: 1.75,
      shaderId: 'gravitational-lens' as const,
    };

    const diffs = diffAgainstArchetype(modifiedState, brutalist.id);
    expect(diffs.length).toBeGreaterThan(initialDiffs.length);

    const bgDiff = diffs.find((d) => d.field === 'bgGraphicId');
    expect(bgDiff).toBeDefined();
    expect(bgDiff?.currentValue).toBe('caution-stripes');

    const shaderDiff = diffs.find((d) => d.field === 'shaderId');
    expect(shaderDiff).toBeDefined();
    expect(shaderDiff?.currentValue).toBe('gravitational-lens');
  });

  it('generates granular subsystem resets that preserve other subsystems and user text', () => {
    const customUserContent = {
      headline: ['MY', 'CUSTOM', 'CONCERT'] as [string, string, string],
      subhead: 'SPECIAL GUEST APPEARANCE',
      date: 'DEC 31 // 23:59',
      location: 'STADIUM 1',
      tag: 'SOLD OUT',
      sponsor: 'BRAND X',
    };

    const modifiedState = {
      ...INITIAL_STUDIO_STATE,
      palette: {
        bg: '#ff0000',
        surface: '#220000',
        ink: '#ffffff',
        accent: '#00ff00',
        accent2: '#0000ff',
      },
      content: customUserContent,
      bgGraphicId: 'acid-marbling' as const,
      bpm: 150,
    };

    // Reset Palette only
    const palettePatch = getSubsystemResetPatch('palette', modifiedState, 'brutalist-club');
    expect(palettePatch.palette).toBeDefined();
    expect(palettePatch.content).toBeUndefined(); // text is preserved!
    expect(palettePatch.bgGraphicId).toBeUndefined(); // background is preserved!

    // Reset Background only
    const bgPatch = getSubsystemResetPatch('background', modifiedState);
    expect(bgPatch.bgGraphicId).toBe('duotone-mesh');
    expect(bgPatch.palette).toBeUndefined();
    expect(bgPatch.content).toBeUndefined();

    // Reset Audio only
    const audioPatch = getSubsystemResetPatch('audio', modifiedState);
    expect(audioPatch.bpm).toBe(128);
    expect(audioPatch.palette).toBeUndefined();
  });

  it('executes creative shufflers and mutations', () => {
    const palette = shufflePalette();
    expect(typeof palette.bg).toBe('string');
    expect(typeof palette.accent).toBe('string');

    const spatial = shuffleLayout();
    expect(typeof spatial.layoutId).toBe('string');
    expect(typeof spatial.gridMarginPx).toBe('number');

    const aes = shuffleAesthetics();
    expect(typeof aes.bgGraphicId).toBe('string');
    expect(typeof aes.shaderId).toBe('string');
    expect(typeof aes.heroId).toBe('string');

    const audio = shuffleAudio();
    expect(typeof audio.synthPattern).toBe('string');
    expect(typeof audio.bpm).toBe('number');

    const customContent = {
      headline: ['TEST', 'PAYLOAD', 'PRESERVED'] as [string, string, string],
      subhead: 'SUB',
      date: 'DATE',
      location: 'LOC',
      tag: 'TAG',
      sponsor: 'SPON',
    };
    const currentState = { ...INITIAL_STUDIO_STATE, content: customContent };
    const all = shuffleAll(currentState);
    expect(all.content).toEqual(customContent); // Text payload is strictly preserved
    expect(all.bgGraphicId).toBeDefined();
    expect(all.palette).toBeDefined();
  });

  it('performs round-trip bidirectional declarative schema serialization v4.1', () => {
    const testState = {
      ...INITIAL_STUDIO_STATE,
      bgGraphicId: 'hex-mesh' as const,
      bgScale: 1.4,
      bgDuotone: true,
      shaderId: 'reaction-diffusion' as const,
      shaderTurbulence: 1.25,
      heroId: 'cyber-drone' as const,
      heroScale: 1.35,
      bpm: 142,
    };

    const schemaJson = generateDeclarativeSchema(testState, 14.5);
    expect(schemaJson).toContain('https://kinetix.studio/schemas/v4.1/poster.json');
    expect(schemaJson).toContain('backgroundPlate');
    expect(schemaJson).toContain('hex-mesh');
    expect(schemaJson).toContain('reaction-diffusion');
    expect(schemaJson).toContain('cyber-drone');

    // Parse back
    const parseResult = importDeclarativeSchema(schemaJson);
    expect(parseResult.success).toBe(true);
    expect(parseResult.state).toBeDefined();

    const restored = parseResult.state!;
    expect(restored.bgGraphicId).toBe('hex-mesh');
    expect(restored.bgScale).toBe(1.4);
    expect(restored.bgDuotone).toBe(true);
    expect(restored.shaderId).toBe('reaction-diffusion');
    expect(restored.shaderTurbulence).toBe(1.25);
    expect(restored.heroId).toBe('cyber-drone');
    expect(restored.heroScale).toBe(1.35);
    expect(restored.bpm).toBe(142);
  });

  it('serializes and deserializes state into shareable URL deep links', () => {
    const testState = {
      ...INITIAL_STUDIO_STATE,
      posterId: 'deep-link-test',
      bgGraphicId: 'bauhaus-geo' as const,
      shaderId: 'gravitational-lens' as const,
      heroId: 'modular-synth' as const,
      bpm: 133,
    };

    const hash = encodeStateToUrlHash(testState);
    expect(hash.startsWith('#config=')).toBe(true);

    const decoded = decodeStateFromUrl(hash);
    expect(decoded).toBeDefined();
    expect(decoded?.posterId).toBe('deep-link-test');
    expect(decoded?.bgGraphicId).toBe('bauhaus-geo');
    expect(decoded?.shaderId).toBe('gravitational-lens');
    expect(decoded?.heroId).toBe('modular-synth');
    expect(decoded?.bpm).toBe(133);
  });

  it('manages custom user presets and active session in storage', () => {
    // 1. Session persistence
    const sessionState = {
      ...INITIAL_STUDIO_STATE,
      posterId: 'session-persistence-test',
      bpm: 135,
    };
    saveActiveSession(sessionState);
    const loadedSession = loadActiveSession();
    expect(loadedSession?.posterId).toBe('session-persistence-test');
    expect(loadedSession?.bpm).toBe(135);
    clearActiveSession();
    expect(loadActiveSession()).toBeNull();

    // 2. Custom User Presets CRUD
    const presetState = {
      ...INITIAL_STUDIO_STATE,
      posterId: 'user-preset-alpha',
      bgGraphicId: 'acid-marbling' as const,
      heroId: 'drum-machine' as const,
    };
    const created = saveUserPreset('Cyber Beat Studio', 'Music', presetState);
    expect(created.id).toBeDefined();
    expect(created.title).toBe('Cyber Beat Studio');

    const presets = loadUserPresets();
    expect(presets.length).toBeGreaterThan(0);
    expect(presets.find((p) => p.id === created.id)).toBeDefined();

    // JSON export & import
    const exportedJson = exportPresetsToJson();
    expect(exportedJson).toContain('Cyber Beat Studio');

    // Delete preset
    deleteUserPreset(created.id);
    const remaining = loadUserPresets();
    expect(remaining.find((p) => p.id === created.id)).toBeUndefined();
  });

  it('indexes dynamic uniforms and allows catalog extension in StudioCatalogRegistry', () => {
    // Background uniforms
    const halftoneUniforms = studioRegistry.getBackgroundUniforms('halftone-dots');
    expect(halftoneUniforms.length).toBeGreaterThan(0);
    expect(halftoneUniforms.some((u) => u.id === 'dotDensity')).toBe(true);

    // Shader uniforms
    const rdUniforms = studioRegistry.getShaderUniforms('reaction-diffusion');
    expect(rdUniforms.length).toBeGreaterThan(0);
    expect(rdUniforms.some((u) => u.id === 'feedRate')).toBe(true);

    // Hero uniforms
    const synthUniforms = studioRegistry.getHeroUniforms('modular-synth');
    expect(synthUniforms.length).toBeGreaterThan(0);
    expect(synthUniforms.some((u) => u.id === 'cableSag')).toBe(true);

    // Register a dynamic custom shader plugin
    studioRegistry.registerShader(
      {
        id: 'custom-hologram' as any,
        name: 'Custom Hologram',
        role: 'Plugin holographic projection',
      },
      [
        { id: 'flickerHz', name: 'Holo Flicker', type: 'number', default: 3.0, min: 1, max: 10, step: 0.5 },
      ]
    );

    expect(studioRegistry.getShader('custom-hologram')).toBeDefined();
    const holoUniforms = studioRegistry.getShaderUniforms('custom-hologram');
    expect(holoUniforms.length).toBe(1);
    expect(holoUniforms[0].id).toBe('flickerHz');
  });

  it('resolves decoupled stage geometry and aspect ratio overrides accurately', () => {
    // 1. Aspect Ratio resolution: 1:1 Square
    const baseBounds = {
      baseX: 20,
      baseY: 40,
      baseW: 300,
      baseH: 200, // wider than tall
      aspect: '1:1' as const,
      scale: 1.0,
      offsetY: 0,
      scaleFactor: 1.0,
    };
    const squareStage = (studioRegistry as any).getStageAspects ? undefined : undefined;
    const { resolveStageDimensions } = require('../src/index');

    const sq = resolveStageDimensions(baseBounds);
    expect(sq.stageW).toBe(200);
    expect(sq.stageH).toBe(200);
    // Centered horizontally: baseX (20) + (300 - 200) / 2 = 70
    expect(sq.stageX).toBe(70);
    expect(sq.stageY).toBe(40);

    // 2. Aspect Ratio: 16:9 Cinema
    const wideBounds = {
      baseX: 20,
      baseY: 40,
      baseW: 200,
      baseH: 300, // taller than wide
      aspect: '16:9' as const,
      scale: 1.0,
      offsetY: 10,
      scaleFactor: 1.0,
    };
    const wide = resolveStageDimensions(wideBounds);
    expect(wide.stageW).toBe(200);
    expect(wide.stageH).toBeCloseTo(200 / (16 / 9), 1);
    // Vertical offset applied
    expect(wide.stageY).toBeGreaterThan(40);

    // 3. Stage Scale & Clamping
    const scaledBounds = {
      baseX: 0,
      baseY: 0,
      baseW: 100,
      baseH: 100,
      aspect: 'auto' as const,
      scale: 1.25,
      offsetY: 0,
      scaleFactor: 1.0,
    };
    const scaled = resolveStageDimensions(scaledBounds);
    expect(scaled.stageW).toBe(125);
    expect(scaled.stageH).toBe(125);

    // 4. Schema Round-Trip with Stage Shape, Aspect, Color, and Opacity
    const customState = {
      ...INITIAL_STUDIO_STATE,
      stageShape: 'hexagon' as const,
      stageAspect: '1:1' as const,
      stageScale: 1.15,
      stageCornerRadius: 18,
      stageOffsetY: -12,
      stageOpacity: 0.75,
      stageColor: '#ff0055',
      stageBorderColor: '#00ffff',
      stageBorderWidth: 3.5,
    };
    const schemaJson = generateDeclarativeSchema(customState);
    const parsedSchema = JSON.parse(schemaJson);
    expect(parsedSchema.visualHierarchy.heroStage.shape).toBe('hexagon');
    expect(parsedSchema.visualHierarchy.heroStage.aspect).toBe('1:1');
    expect(parsedSchema.visualHierarchy.heroStage.scale).toBe(1.15);
    expect(parsedSchema.visualHierarchy.heroStage.cornerRadiusPx).toBe(18);
    expect(parsedSchema.visualHierarchy.heroStage.offsetY).toBe(-12);
    expect(parsedSchema.visualHierarchy.heroStage.opacity).toBe(0.75);
    expect(parsedSchema.visualHierarchy.heroStage.color).toBe('#ff0055');
    expect(parsedSchema.visualHierarchy.heroStage.borderColor).toBe('#00ffff');
    expect(parsedSchema.visualHierarchy.heroStage.borderWidthPx).toBe(3.5);

    const importResult = importDeclarativeSchema(schemaJson);
    expect(importResult.success).toBe(true);
    const imported = importResult.state!;
    expect(imported.stageShape).toBe('hexagon');
    expect(imported.stageAspect).toBe('1:1');
    expect(imported.stageScale).toBe(1.15);
    expect(imported.stageCornerRadius).toBe(18);
    expect(imported.stageOffsetY).toBe(-12);
    expect(imported.stageOpacity).toBe(0.75);
    expect(imported.stageColor).toBe('#ff0055');
    expect(imported.stageBorderColor).toBe('#00ffff');
    expect(imported.stageBorderWidth).toBe(3.5);

    // 5. Border-Only Mode Verification (stageOpacity: 0, stageBorderOpacity: 0.8)
    const borderOnlyState = {
      ...INITIAL_STUDIO_STATE,
      stageOpacity: 0,
      stageBorderOpacity: 0.8,
      stageBorderWidth: 2.0,
      stageBlurPx: 0,
    };
    const borderOnlyValidation = validateStudioConfig(borderOnlyState);
    expect(borderOnlyValidation.valid).toBe(true);
    expect(borderOnlyValidation.config?.stageOpacity).toBe(0);
    expect(borderOnlyValidation.config?.stageBorderOpacity).toBe(0.8);
    expect(borderOnlyValidation.config?.stageBorderWidth).toBe(2.0);

    // 6. Robust CSS RGBA Color Formatter
    const { toRgbaString } = require('../src/index');
    expect(toRgbaString('#ffffff', 1.0)).toBe('rgba(255, 255, 255, 1)');
    expect(toRgbaString('#08090c', 0.5)).toBe('rgba(8, 9, 12, 0.5)');
    expect(toRgbaString('#fff', 0.8)).toBe('rgba(255, 255, 255, 0.8)');
    expect(toRgbaString('#112233ff', 1.0)).toBe('rgba(17, 34, 51, 1)');
  });
});
