import { describe, it, expect } from 'bun:test';
import * as KinetixStudio from '../src/index';

describe('Kinetix Studio Component & Engine Suite', () => {
  it('exports root App component', () => {
    expect(typeof KinetixStudio.App).toBe('function');
  });

  it('exports all 17 primary spatial skeletons and 45 legacy mappings', () => {
    expect(KinetixStudio.SPATIAL_LAYOUTS.length).toBe(17);
    expect(Object.keys(KinetixStudio.LEGACY_LAYOUT_MAP).length).toBe(45);
    // Ensure all 17 skeletons can be resolved into valid layout specs
    KinetixStudio.SPATIAL_LAYOUTS.forEach((item) => {
      const spec = KinetixStudio.getSpatialSkeletonSpec({
        ...KinetixStudio.INITIAL_STUDIO_STATE,
        layoutId: item.id,
      });
      expect(spec).toBeDefined();
      expect(typeof spec.middleClass).toBe('string');
    });
  });

  it('exports all 12 procedural background graphics and OPFS utilities', () => {
    expect(KinetixStudio.BACKGROUND_GRAPHICS_CATALOG.length).toBe(12);
    expect(Object.keys(KinetixStudio.PROCEDURAL_BACKGROUND_STRATEGIES).length).toBe(11);
    expect(typeof KinetixStudio.saveImageToOpfs).toBe('function');
    expect(typeof KinetixStudio.loadImageFromOpfs).toBe('function');
    expect(typeof KinetixStudio.getCachedImage).toBe('function');
    expect(typeof KinetixStudio.applyDuotoneFilter).toBe('function');
  });

  it('exports all 28 shaders and strategies', () => {
    expect(KinetixStudio.SHADER_CATALOG.length).toBe(28);
    expect(Object.keys(KinetixStudio.SHADER_STRATEGIES).length).toBe(28);
    // Check newly introduced shaders
    expect(KinetixStudio.SHADER_STRATEGIES['quantum-wave']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['voronoi-bio']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['chladni-plate']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['hyper-lattice']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['raymarch-sdf']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['crt-phosphor']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['gravitational-lens']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['reaction-diffusion']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['ascii-matrix-terminal']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['quantum-superposition']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['neon-caustics']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['cellular-automata']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['riso-halftone-misreg']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['film-haloid-grain']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['sumi-ink-wash']).toBeDefined();
    expect(KinetixStudio.SHADER_STRATEGIES['cyanotype-exposure']).toBeDefined();
  });

  it('exports all 50 hero subjects and models', () => {
    expect(KinetixStudio.HERO_CATALOG.length).toBe(50);
    // Check newly introduced heroes
    const heroIds = KinetixStudio.HERO_CATALOG.map((h) => h.id);
    expect(heroIds).toContain('cyber-katana');
    expect(heroIds).toContain('exo-hand');
    expect(heroIds).toContain('quantum-core');
    expect(heroIds).toContain('classical-bust');
    expect(heroIds).toContain('architectural-monolith');
    expect(heroIds).toContain('botanical-flora');
    expect(heroIds).toContain('book-folio');
    expect(heroIds).toContain('cinema-slate');
    expect(heroIds).toContain('bauhaus-geometry');
    expect(heroIds).toContain('destijl-grid-plinth');
    expect(heroIds).toContain('secession-crest');
    expect(heroIds).toContain('deco-ziggurat');
    expect(heroIds).toContain('cinema-lens');
    expect(heroIds).toContain('vertigo-spiral');
    expect(heroIds).toContain('factory-hazard-badge');
    expect(heroIds).toContain('molten-mandala');
    expect(heroIds).toContain('ransom-badge');
    expect(heroIds).toContain('wabi-bonsai');
    expect(heroIds).toContain('biophilic-leaf-arch');
    expect(heroIds).toContain('cosmic-astrolabe');
    expect(heroIds).toContain('chrome-torus-pod');
    expect(heroIds).toContain('prism-crystal');
    expect(heroIds).toContain('isometric-plinth');
    expect(heroIds).toContain('bio-heart');
    expect(heroIds).toContain('modular-synth');
    expect(heroIds).toContain('drum-machine');
    expect(heroIds).toContain('cyber-drone');
    expect(heroIds).toContain('mecha-helmet');
    expect(heroIds).toContain('couture-dress');
    expect(heroIds).toContain('anamorphic-lens');
    // Festive & Cultural Holiday Heroes
    expect(heroIds).toContain('holiday-evergreen-star');
    expect(heroIds).toContain('midnight-champagne-crystal');
    expect(heroIds).toContain('tet-blossom-lantern');
    expect(heroIds).toContain('trung-thu-star-lantern');
    expect(heroIds).toContain('mid-autumn-moon-rabbit');
    expect(heroIds).toContain('halloween-gothic-skull');
    expect(heroIds).toContain('diwali-diya-lamp');
    expect(heroIds).toContain('carnival-feather-mask');
  });

  it('exports all 12 easings and descriptions', () => {
    expect(KinetixStudio.EASING_CATALOG.length).toBe(12);
  });

  it('exports all 16 kinetic typography engines', () => {
    expect(KinetixStudio.KINETIC_TYPE_CATALOG.length).toBe(16);
  });

  it('exports all 37 brand archetypes across 11 spheres', () => {
    expect(KinetixStudio.BRAND_ARCHETYPES.length).toBe(37);
    const archIds = KinetixStudio.BRAND_ARCHETYPES.map((a) => a.id);
    expect(archIds).toContain('swiss-international');
    expect(archIds).toContain('editorial-couture');
    expect(archIds).toContain('blue-note-jazz');
    expect(archIds).toContain('a24-cinematheque');
    expect(archIds).toContain('botanical-herbarium');
    expect(archIds).toContain('monograph-press');
    expect(archIds).toContain('brutalist-club');
    expect(archIds).toContain('bauhaus-constructivism');
    expect(archIds).toContain('de-stijl-neoplasticism');
    expect(archIds).toContain('vogue-avant-lookbook');
    expect(archIds).toContain('vienna-secession');
    expect(archIds).toContain('art-deco-metropolis');
    expect(archIds).toContain('hellenistic-antiquity');
    expect(archIds).toContain('french-new-wave');
    expect(archIds).toContain('saul-bass-vertigo');
    expect(archIds).toContain('factory-records');
    expect(archIds).toContain('psychedelic-rock');
    expect(archIds).toContain('activist-risograph');
    expect(archIds).toContain('punk-diy-dada');
    expect(archIds).toContain('wabi-sabi-zen');
    expect(archIds).toContain('scandinavian-biophilic');
    expect(archIds).toContain('architectural-brutalism');
    expect(archIds).toContain('blueprint-cartography');
    expect(archIds).toContain('afrofuturism-cosmic');
    expect(archIds).toContain('y2k-cyber-millennium');
    expect(archIds).toContain('cyber-telemetry');
    expect(archIds).toContain('op-art-moire');
    expect(archIds).toContain('vaporwave-vhs');
    // Festive & Cultural Holiday Spheres
    expect(archIds).toContain('christmas-noel-solstice');
    expect(archIds).toContain('new-year-countdown');
    expect(archIds).toContain('tet-lunar-spring');
    expect(archIds).toContain('tet-trung-thu-star-lantern');
    expect(archIds).toContain('mid-autumn-celestial-moon');
    expect(archIds).toContain('halloween-all-hallows');
    expect(archIds).toContain('diwali-festival-lights');
    expect(archIds).toContain('carnival-rio-masquerade');
    expect(archIds).toContain('summer-solstice-solar');
  });

  it('exports all 36 production presets in the vault', () => {
    expect(KinetixStudio.TEMPLATE_VAULT.length).toBe(36);
  });

  it('computes temporal choreography with high accuracy', () => {
    const choreo = KinetixStudio.computeChoreography(0.5, 'studio3', true);
    expect(choreo.phaseName).toContain('GOLDEN HOLD');
    expect(choreo.headlineReveal).toBe(1);
    expect(choreo.holdCalmness).toBeGreaterThan(0.8);
  });

  it('calculates WCAG contrast according to WCAG 2.2 AA guidelines', () => {
    const contrast = KinetixStudio.calculateWcagContrast('#ffffff', '#000000');
    expect(contrast).toBe(21);
    const lowContrast = KinetixStudio.calculateWcagContrast('#111111', '#121212');
    expect(lowContrast).toBeLessThan(4.5);
  });

  it('initializes SafeCanvas2D defensiveness wrapper correctly', () => {
    class DummyContext {}
    const dummy = new DummyContext() as unknown as CanvasRenderingContext2D;
    const safeCtx = new KinetixStudio.SafeCanvas2D(dummy);
    expect(safeCtx).toBeDefined();
    expect(safeCtx.raw).toBe(dummy);
  });

  it('verifies AnalogAudioSynth 4-voice polyphony and real-time FFT frequency retrieval', () => {
    const synth = new KinetixStudio.AnalogAudioSynth();
    expect(synth).toBeDefined();

    // Verify pattern switching
    synth.setPattern('breakbeat-syncopated');
    expect(synth.getPattern()).toBe('breakbeat-syncopated');

    // Verify voice muting controls
    synth.setVoiceMutes({ kick: true, hat: false });
    const mutes = synth.getVoiceMutes();
    expect(mutes.kick).toBe(true);
    expect(mutes.hat).toBe(false);

    // Verify filter & volume setters
    synth.setMasterVolume(0.85);
    synth.setFilter(3500, 4.2);

    // Verify frequency buffer array handling
    const buffer = new Uint8Array(32);
    synth.getByteFrequencyData(buffer);
    expect(buffer.length).toBe(32);

    const timeBuffer = new Uint8Array(32);
    synth.getByteTimeDomainData(timeBuffer);
    expect(timeBuffer.length).toBe(32);

    expect(typeof synth.getAudioLevel()).toBe('number');
    synth.reset();
    synth.dispose();
  });

  it('verifies multi-track layer visibility and sequencing defaults in INITIAL_STUDIO_STATE', () => {
    const state = KinetixStudio.INITIAL_STUDIO_STATE;
    expect(state.layerVisibility).toBeDefined();
    expect(state.layerVisibility.shader).toBe(true);
    expect(state.layerVisibility.hero).toBe(true);
    expect(state.layerVisibility.typography).toBe(true);
    expect(state.layerVisibility.audio).toBe(true);
    expect(state.playbackSpeed).toBe(1.0);
    expect(state.synthPattern).toBe('techno-4-on-floor');
  });

  it('exports configuration engine utilities, tabs, and registry', () => {
    expect(typeof KinetixStudio.ConfigTab).toBe('function');
    expect(typeof KinetixStudio.BrandAndStylesTab).toBe('function');
    expect(typeof KinetixStudio.validateStudioConfig).toBe('function');
    expect(typeof KinetixStudio.diffAgainstArchetype).toBe('function');
    expect(typeof KinetixStudio.getSubsystemResetPatch).toBe('function');
    expect(typeof KinetixStudio.shufflePalette).toBe('function');
    expect(typeof KinetixStudio.shuffleLayout).toBe('function');
    expect(typeof KinetixStudio.shuffleAesthetics).toBe('function');
    expect(typeof KinetixStudio.shuffleAudio).toBe('function');
    expect(typeof KinetixStudio.shuffleAll).toBe('function');
    expect(typeof KinetixStudio.generateDeclarativeSchema).toBe('function');
    expect(typeof KinetixStudio.importDeclarativeSchema).toBe('function');
    expect(typeof KinetixStudio.encodeStateToUrlHash).toBe('function');
    expect(typeof KinetixStudio.decodeStateFromUrl).toBe('function');
    expect(typeof KinetixStudio.copyShareableLink).toBe('function');
    expect(typeof KinetixStudio.saveUserPreset).toBe('function');
    expect(typeof KinetixStudio.loadUserPresets).toBe('function');
    expect(typeof KinetixStudio.studioRegistry).toBe('object');
    expect(KinetixStudio.studioRegistry.getBackgrounds().length).toBe(12);
    expect(KinetixStudio.studioRegistry.getShaders().length).toBeGreaterThanOrEqual(24);
    expect(KinetixStudio.studioRegistry.getHeroes().length).toBe(50);
    expect(KinetixStudio.studioRegistry.getSynthPatterns().length).toBe(31);
    expect(KinetixStudio.STAGE_SHAPES.length).toBe(9);
    expect(KinetixStudio.STAGE_ASPECTS.length).toBe(7);
    expect(typeof KinetixStudio.drawStagePath).toBe('function');
    expect(typeof KinetixStudio.resolveStageDimensions).toBe('function');
  });

  it('exports complete Studio Theme Manager system with 20 curated presets', () => {
    expect(KinetixStudio.STUDIO_THEME_PRESETS.length).toBe(20);
    expect(KinetixStudio.DEFAULT_THEME_ID).toBe('carbon-noir');
    expect(typeof KinetixStudio.ThemeProvider).toBe('function');
    expect(typeof KinetixStudio.useTheme).toBe('function');
    expect(typeof KinetixStudio.ThemeSelector).toBe('function');
    expect(typeof KinetixStudio.ThemeManagerDeck).toBe('function');
    expect(typeof KinetixStudio.ThemeManagerModal).toBe('function');
    expect(typeof KinetixStudio.applyThemeToDom).toBe('function');
    expect(typeof KinetixStudio.hexToRgbChannels).toBe('function');
    expect(typeof KinetixStudio.rgbChannelsToHex).toBe('function');
    expect(typeof KinetixStudio.findThemePresetById).toBe('function');
    expect(typeof KinetixStudio.loadCustomThemesFromStorage).toBe('function');
    expect(typeof KinetixStudio.saveCustomThemesToStorage).toBe('function');
  });

  it('exports dynamic font lifecycle, darkroom processor, and 300 DPI print deck', () => {
    expect(KinetixStudio.GENRE_FONT_CATALOG.length).toBe(8);
    expect(typeof KinetixStudio.getFontFamilyWithFallback).toBe('function');
    expect(typeof KinetixStudio.ensureGenreFontLoaded).toBe('function');
    expect(typeof KinetixStudio.isGenreFontLoaded).toBe('function');

    expect(typeof KinetixStudio.processDarkroomGrading).toBe('function');
    expect(typeof KinetixStudio.clearDarkroomCache).toBe('function');

    expect(KinetixStudio.PRINT_PRESETS.length).toBe(5);
    expect(typeof KinetixStudio.getSafeExportScale).toBe('function');
    expect(typeof KinetixStudio.exportPrintMasterDeck).toBe('function');
    expect(typeof KinetixStudio.renderPrintMarks).toBe('function');

    expect(typeof KinetixStudio.GalleryPresenterModal).toBe('function');
  });

  it('exports Phase 1 studio-grade modules: Bézier solver, CMYK engine, Web MIDI, and Clock Worklet', () => {
    // Bézier Solver
    expect(typeof KinetixStudio.UnitBezier).toBe('function');
    expect(typeof KinetixStudio.createBezierEasing).toBe('function');
    expect(Object.keys(KinetixStudio.BEZIER_PRESETS).length).toBe(8);

    // CMYK Pre-Press Engine
    expect(typeof KinetixStudio.rgbToCmyk).toBe('function');
    expect(typeof KinetixStudio.hexToCmyk).toBe('function');
    expect(typeof KinetixStudio.cmykToRgb).toBe('function');
    expect(KinetixStudio.DEFAULT_TAC_LIMIT).toBe(3.0);
    expect(KinetixStudio.CMYK_BLACKS.rich.k).toBe(1.0);

    // Web MIDI Controller
    expect(typeof KinetixStudio.WebMidiManager).toBe('function');
    expect(KinetixStudio.MIDI_CC.MOD_WHEEL).toBe(1);
    expect(KinetixStudio.MIDI_CC.CUTOFF).toBe(74);

    // Audio Worklet Clock
    expect(KinetixStudio.CLOCK_WORKLET_NAME).toBe('master-audio-clock');
    expect(typeof KinetixStudio.createClockWorkletNode).toBe('function');
    expect(typeof KinetixStudio.CLOCK_WORKLET_CODE).toBe('string');

    // MP4 Export Pipeline
    expect(typeof KinetixStudio.exportCompositeVideoMp4).toBe('function');
  });

  it('exports Milestones 0 through D studio-grade architecture components', () => {
    // Milestone 0: Hexagonal Container & Ports
    expect(typeof KinetixStudio.getContainer).toBe('function');
    expect(typeof KinetixStudio.createProductionContainer).toBe('function');
    expect(typeof KinetixStudio.Canvas2dRenderTargetAdapter).toBe('function');
    expect(typeof KinetixStudio.BrowserDownloadTransportAdapter).toBe('function');

    // Milestone A: Interactive Keyframe Editor
    expect(typeof KinetixStudio.KeyframeTrackEditor).toBe('function');
    expect(typeof KinetixStudio.computeKnotTangentPoints).toBe('function');
    expect(typeof KinetixStudio.clampKnotTangents).toBe('function');
    expect(typeof KinetixStudio.alignTangents).toBe('function');

    // Milestone B: Worker Video Encoder Adapter
    expect(typeof KinetixStudio.WorkerExportAdapter).toBe('function');

    // Milestone C: Live Stage MIDI Learn & Line-In
    expect(typeof KinetixStudio.MidiLearnModal).toBe('function');
    expect(typeof KinetixStudio.LineInAudioAdapter).toBe('function');

    // Milestone D: Pre-Press Vector PDF Engine
    expect(typeof KinetixStudio.PdfVectorGeneratorAdapter).toBe('function');
    expect(typeof KinetixStudio.exportVectorPdfDeck).toBe('function');
  });

  it('exports Real-World Media Vault catalog (24 CC0 assets) and VideoTextureEngine', () => {
    expect(KinetixStudio.MEDIA_CATALOG.length).toBe(24);
    expect(typeof KinetixStudio.VideoTextureEngine).toBe('function');
    expect(KinetixStudio.videoTextureEngine).toBeDefined();
    expect(typeof KinetixStudio.MediaVaultModal).toBe('function');
    expect(KinetixStudio.userAudioTrack).toBeDefined();
  });

  it('exports Horizon 1 through 4 Strategic Architecture components', () => {
    // Horizon 1: Multi-Scene Storyboard & Timeline Sequencer
    expect(typeof KinetixStudio.StoryboardSequence).toBe('function');
    expect(KinetixStudio.DEFAULT_STORYBOARD_PRESET).toBeDefined();
    expect(KinetixStudio.CINEMATIC_3D_HERO_SHOWCASE_PRESET).toBeDefined();
    expect(typeof KinetixStudio.StoryboardCompositor).toBe('function');
    expect(typeof KinetixStudio.TransitionRegistry).toBe('function');
    expect(typeof KinetixStudio.SpinOrbitDissolveTransition).toBe('function');
    expect(typeof KinetixStudio.DollyPunchThroughTransition).toBe('function');
    expect(typeof KinetixStudio.StoryboardDrawer).toBe('function');
    expect(typeof KinetixStudio.TransitionPickerPopover).toBe('function');
    expect(KinetixStudio.TRANSITION_CATALOG).toBeDefined();
    expect(KinetixStudio.TRANSITION_CATALOG.length).toBe(8);
    expect(typeof KinetixStudio.Popover).toBe('function');
    expect(typeof KinetixStudio.computePopoverPosition).toBe('function');
    expect(typeof KinetixStudio.exportStoryboardBatchAspects).toBe('function');

    // Horizon 2: AI Creative Director & Prompt-to-Poster Co-Pilot
    expect(typeof KinetixStudio.CopilotPipeline).toBe('function');
    expect(typeof KinetixStudio.DeterministicCopilot).toBe('function');
    expect(KinetixStudio.deterministicCopilot).toBeDefined();
    expect(typeof KinetixStudio.WinterTcCopilotAdapter).toBe('function');
    expect(KinetixStudio.winterTcCopilotAdapter).toBeDefined();
    expect(typeof KinetixStudio.CopilotModal).toBe('function');

    // Horizon 4: Live Stage "VJ Performance Rig" & Real-Time Line-In
    expect(typeof KinetixStudio.DeckCrossfadeMediator).toBe('function');
    expect(typeof KinetixStudio.lerpColorHex).toBe('function');
    expect(typeof KinetixStudio.lerpPalette).toBe('function');
    expect(typeof KinetixStudio.BroadcastStreamAdapter).toBe('function');
    expect(KinetixStudio.broadcastStreamAdapter).toBeDefined();
    expect(typeof KinetixStudio.VjPerformanceModal).toBe('function');

    // Horizon 3: WebGPU Compute Pipeline & 3D Mesh Heroes
    expect(typeof KinetixStudio.probeRenderBackendCapabilities).toBe('function');
    expect(typeof KinetixStudio.createIcosahedronMesh).toBe('function');
    expect(typeof KinetixStudio.createTorusKnotMesh).toBe('function');
    expect(typeof KinetixStudio.createMonolith3DMesh).toBe('function');
    expect(typeof KinetixStudio.parseGlbMesh).toBe('function');
    expect(typeof KinetixStudio.GltfMeshEngine).toBe('function');
    expect(KinetixStudio.gltfMeshEngine).toBeDefined();
    expect(typeof KinetixStudio.CameraDirector3D).toBe('function');
    expect(typeof KinetixStudio.resolve3DCameraShot).toBe('function');
  });
});
