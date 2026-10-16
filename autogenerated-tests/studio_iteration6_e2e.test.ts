import { describe, it, expect, beforeEach } from 'bun:test';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { STAGING_PRESETS } from '../apps/studio/src/lib/library/stagingPresets';
import {
  CanvasTransformOverlay,
  MagneticSnapEngine,
  UniversalThreeScene,
  type BoundingBox2D,
} from '@acc/effect-engines/client';
import {
  RelationalDAGCompiler,
  VideoIRSchemaValidator,
} from '@acc/ir/client';

describe('Iteration 6 Master End-to-End QA Suite: Canvas Direct Staging, Inspector, Partial VFX & Export Parity', () => {
  let stateManager: IRStateManager;

  beforeEach(async () => {
    stateManager = IRStateManager.getInstance();
    await stateManager.switchTemplate('scifi');
  });

  // =========================================================================
  // 1. IN-CANVAS 2D VECTOR TRANSFORM & DIRECT STAGING
  // =========================================================================
  describe('In-Canvas 2D Vector Transform & Magnetic Snapping', () => {
    it('should accurately hit-test all 8 handles and the rotation stem on bounding box', () => {
      const overlay = new CanvasTransformOverlay();
      const box: BoundingBox2D = {
        x: 0.5,
        y: 0.5,
        width: 0.4,
        height: 0.3,
        rotation: 0,
      };

      overlay.update(box);

      // Hit-test center body
      expect(overlay.hitTest(0.5, 0.5, box)).toBe('body');

      // Hit-test corners
      expect(overlay.hitTest(0.3, 0.35, box)).toBe('tl');
      expect(overlay.hitTest(0.7, 0.35, box)).toBe('tr');
      expect(overlay.hitTest(0.3, 0.65, box)).toBe('bl');
      expect(overlay.hitTest(0.7, 0.65, box)).toBe('br');

      // Hit-test edges
      expect(overlay.hitTest(0.5, 0.35, box)).toBe('tc');
      expect(overlay.hitTest(0.5, 0.65, box)).toBe('bc');
      expect(overlay.hitTest(0.3, 0.5, box)).toBe('ml');
      expect(overlay.hitTest(0.7, 0.5, box)).toBe('mr');

      // Hit-test rotation stem
      expect(overlay.hitTest(0.5, 0.3, box)).toBe('rotate');

      overlay.dispose();
    });

    it('should compute magnetic snap alignments to center crosshairs and safe zones', () => {
      // Near vertical center (0.508) and horizontal center (0.495)
      const snapped = MagneticSnapEngine.snap(0.508, 0.495, 0.4, 0.3, 0.015);
      expect(snapped.snappedX).toBe(true);
      expect(snapped.x).toBe(0.5);
      expect(snapped.snappedY).toBe(true);
      expect(snapped.y).toBe(0.5);
      expect(snapped.activeGuides.length).toBeGreaterThanOrEqual(2);
      expect(snapped.activeGuides.some((g) => g.label.includes('Center'))).toBe(true);
    });

    it('should completely suppress gizmos and transform handles during headless export', () => {
      const scene = new UniversalThreeScene({ width: 1920, height: 1080 });
      const box: BoundingBox2D = { x: 0.5, y: 0.5, width: 0.5, height: 0.5, rotation: 0 };

      scene.updateOverlay(box);
      expect(scene.overlay.rootGroup.visible).toBe(true);

      // Suppress for headless export
      scene.setOverlayVisible(false);
      expect(scene.overlay.rootGroup.visible).toBe(false);

      scene.dispose();
    });
  });

  // =========================================================================
  // 2. SIDEBAR INSPECTOR 3D NUMERIC CONTROLS
  // =========================================================================
  describe('Sidebar Inspector 3D Controls & Live Modifier Updates', () => {
    it('should update 3D Depth Relighting with Blinn-Phong parameters and preserve schema validity', () => {
      const seqId = 'seq-city-intro';

      stateManager.updateModifier(seqId, 'vfx/depth_relighting', {
        enabled: true,
        lightColor: '#00d4ff',
        lightX: 3.5,
        lightY: -1.2,
        lightZ: 6.0,
        diffuse: 1.4,
        specular: 2.2,
        shininess: 64,
        rimIntensity: 1.0,
      });

      const state = stateManager.getState();
      expect(state.error).toBeNull();

      const validation = VideoIRSchemaValidator.validate(state.doc);
      expect(validation.valid).toBe(true);

      const seq = state.doc.tracks[0].sequences.find((s) => s.id === seqId)!;
      const mod = seq.modifiers?.find((m) => m.type === 'vfx/depth_relighting');
      expect(mod).toBeDefined();
      expect((mod?.params as any).diffuse).toBe(1.4);
      expect((mod?.params as any).shininess).toBe(64);
    });

    it('should update 3D Camera Spline and Bokeh rack focus parameters', () => {
      const seqId = 'seq-city-intro';

      stateManager.updateModifier(seqId, 'camera/3d', {
        enabled: true,
        fov: 35,
        roll: 12,
        focalDistance: 3.2,
        focalRange: 0.8,
        bokehRadius: 14.0,
      });

      const state = stateManager.getState();
      expect(state.error).toBeNull();

      const seq = state.doc.tracks[0].sequences.find((s) => s.id === seqId)!;
      const mod = seq.modifiers?.find((m) => m.type === 'camera/3d');
      expect(mod).toBeDefined();
      expect((mod?.params as any).fov).toBe(35);
      expect((mod?.params as any).bokehRadius).toBe(14.0);
    });

    it('should support modifier removal with 100% clean recovery via undo', () => {
      const seqId = 'seq-city-intro';
      stateManager.removeModifier(seqId, 'vfx/color_grading');

      let state = stateManager.getState();
      let seq = state.doc.tracks[0].sequences.find((s) => s.id === seqId)!;
      expect(seq.modifiers?.some((m) => m.type === 'vfx/color_grading')).toBe(false);

      // Undo removal
      stateManager.undo();
      state = stateManager.getState();
      seq = state.doc.tracks[0].sequences.find((s) => s.id === seqId)!;
      expect(seq.modifiers?.some((m) => m.type === 'vfx/color_grading')).toBe(true);
    });
  });

  // =========================================================================
  // 3. LIBRARY DRAG-AND-DROP STAGING & DIRECT CANVAS INSERT
  // =========================================================================
  describe('Library Drag-and-Drop Staging & Canvas Staging', () => {
    it('should stage a title preset at specific normalized coordinates', () => {
      const titlePreset = STAGING_PRESETS.find((p) => p.id === 'text_title')!;
      const stagedSeq = titlePreset.createSequence({
        startFrame: 45,
        durationFrames: 75,
        normX: 0.65,
        normY: 0.35,
      });

      stateManager.addSequence(titlePreset.targetTrackId, stagedSeq, {
        trackTypeFallback: titlePreset.targetTrackType,
        trackNameFallback: titlePreset.targetTrackName,
      });

      const state = stateManager.getState();
      expect(state.selectedSequenceId).toBe(stagedSeq.id);
      expect(state.doc.tracks.some((t) => t.id === 'track-text-overlay')).toBe(true);

      const textTrack = state.doc.tracks.find((t) => t.id === 'track-text-overlay')!;
      const addedSeq = textTrack.sequences.find((s) => s.id === stagedSeq.id)!;
      expect(addedSeq.time.start).toBe(45);
      expect(addedSeq.time.duration).toBe(75);

      const transMod = addedSeq.modifiers?.find((m) => m.type === 'transform');
      expect((transMod?.params as any).normX).toBe(0.65);
      expect((transMod?.params as any).normY).toBe(0.35);
    });

    it('should support center insert staging for vector shapes and partial VFX', () => {
      const shapePreset = STAGING_PRESETS.find((p) => p.id === 'shape_rounded_box')!;
      const shapeSeq = shapePreset.createSequence({
        startFrame: 0,
        durationFrames: 90,
        normX: 0.5,
        normY: 0.5,
      });

      stateManager.addSequence(shapePreset.targetTrackId, shapeSeq, {
        trackTypeFallback: shapePreset.targetTrackType,
        trackNameFallback: shapePreset.targetTrackName,
      });

      const state = stateManager.getState();
      const shapesTrack = state.doc.tracks.find((t) => t.id === 'track-shapes')!;
      expect(shapesTrack).toBeDefined();
      expect(shapesTrack.sequences.some((s) => s.id === shapeSeq.id)).toBe(true);
    });
  });

  // =========================================================================
  // 4. INLINE CANVAS TEXT EDITING & PARTIAL VFX EXECUTION
  // =========================================================================
  describe('Inline Text Editing & Partial VFX Execution', () => {
    it('should commit edited text cues on canvas and undo back to original text', () => {
      const seqId = 'seq-dialogue-1';
      stateManager.updateTextCue(seqId, 0, 'OVERRIDE: PROTOCOL 2099 RECONFIGURED');

      let state = stateManager.getState();
      let subtitleTrack = state.doc.tracks.find((t) => t.id === 'track-subtitles')!;
      let seq = subtitleTrack.sequences.find((s) => s.id === seqId)!;
      expect(seq.cues?.[0].text).toBe('OVERRIDE: PROTOCOL 2099 RECONFIGURED');

      // Undo edit
      stateManager.undo();
      state = stateManager.getState();
      subtitleTrack = state.doc.tracks.find((t) => t.id === 'track-subtitles')!;
      seq = subtitleTrack.sequences.find((s) => s.id === seqId)!;
      expect(seq.cues?.[0].text).toContain('Protocol 2099 initiated');
    });

    it('should execute Partial VFX (spotlight, blur, glitch, emitter) in UniversalThreeScene without memory leaks', () => {
      const scene = new UniversalThreeScene({ width: 1920, height: 1080 });

      scene.setPartialVFXRegions([
        { id: 'spot-1', type: 'spotlight', x: 0.5, y: 0.5, radius: 200, intensity: 2.0 },
        { id: 'emit-1', type: 'point_emitter', x: 0.3, y: 0.7, color: '#f43f5e' },
        { id: 'glitch-1', type: 'glitch', x: 0.7, y: 0.3, width: 0.4, height: 0.25 },
        { id: 'blur-1', type: 'blur', x: 0.2, y: 0.2, width: 0.3, height: 0.2 },
      ]);

      expect(scene.partialVfxGroup.children.length).toBe(4);

      // Simulation steps
      for (let f = 0; f < 30; f++) {
        scene.update(f / 30, 1.0);
      }

      // Cleanup
      scene.clearPartialVFX();
      expect(scene.partialVfxGroup.children.length).toBe(0);
      scene.dispose();
    });
  });

  // =========================================================================
  // 5. MASTER DAG COMPILATION & SCHEMA ROUNDTRIP FIDELITY
  // =========================================================================
  describe('Master DAG Compilation & Schema Roundtrip Fidelity', () => {
    it('should compile the complete edited multi-track project without DAG errors', async () => {
      const compiler = new RelationalDAGCompiler();
      const compiled = await compiler.compile(stateManager.getState().doc);

      expect(compiled.totalFrames).toBeGreaterThan(0);
      expect(compiled.tracks.size).toBeGreaterThanOrEqual(5);

      const json = stateManager.exportJSON();
      expect(json.length).toBeGreaterThan(100);

      const reloaded = stateManager.loadFromJSON(json);
      expect(reloaded.valid).toBe(true);
    });
  });
});
