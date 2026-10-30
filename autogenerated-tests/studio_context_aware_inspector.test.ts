import { describe, it, expect, beforeEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import {
  ALL_AVAILABLE_MODIFIERS,
  formatTimecode,
  type AvailableModifierDef,
} from '../apps/studio/src/components/RightSidebar';
import { STAGING_PRESETS } from '../apps/studio/src/lib/library/stagingPresets';
import type { SequenceTime, IRSequence } from '@acc/ir';

describe('Studio Context-Aware Inspector & Overlay VFX Architecture', () => {
  beforeEach(async () => {
    // Reset to pristine scifi demo state
    await IRStateManager.getInstance().switchTemplate('scifi');
  });

  describe('1. Interactive SequenceTime Configuration & DAG Resolution', () => {
    it('should immutably update absolute start and duration with DAG recompilation', async () => {
      const stateManager = IRStateManager.getInstance();
      const seqId = 'seq-city-intro';

      const newTime: SequenceTime = {
        start: 45,
        duration: 120,
      };

      stateManager.updateSequenceTime(seqId, newTime);
      await stateManager.recompile();

      const state = stateManager.getState();
      const updatedSeq = state.doc.tracks[0]?.sequences.find((s) => s.id === seqId);
      expect(updatedSeq).toBeDefined();
      expect(updatedSeq?.time.start).toBe(45);
      expect(updatedSeq?.time.duration).toBe(120);

      const resolved = state.timeline?.sequences?.get(seqId);
      expect(resolved).toBeDefined();
      expect(resolved?.startFrame).toBe(45);
      expect(resolved?.endFrame).toBe(165);
    });

    it('should support relational start (after & syncWith) with topological ordering', async () => {
      const stateManager = IRStateManager.getInstance();
      const state = stateManager.getState();
      const firstSeqId = state.doc.tracks[0]?.sequences[0]?.id;
      const secondSeqId = state.doc.tracks[0]?.sequences[1]?.id;

      if (!firstSeqId || !secondSeqId) return;

      // Make second sequence start after first sequence with 15 frames offset
      const relationalTime: SequenceTime = {
        start: { after: firstSeqId, offsetFrames: 15 },
        duration: 60,
      };

      stateManager.updateSequenceTime(secondSeqId, relationalTime);
      await stateManager.recompile();

      const updatedState = stateManager.getState();
      const resolvedFirst = updatedState.timeline?.sequences?.get(firstSeqId);
      const resolvedSecond = updatedState.timeline?.sequences?.get(secondSeqId);

      expect(resolvedFirst).toBeDefined();
      expect(resolvedSecond).toBeDefined();
      if (resolvedFirst && resolvedSecond) {
        expect(resolvedSecond.startFrame).toBe(resolvedFirst.endFrame + 15);
      }
    });

    it('should support relational duration (matchLengthOf) with dynamic padding', async () => {
      const stateManager = IRStateManager.getInstance();
      const state = stateManager.getState();
      const targetSeqId = state.doc.tracks[0]?.sequences[0]?.id;
      const testSeqId = state.doc.tracks[0]?.sequences[1]?.id;

      if (!targetSeqId || !testSeqId) return;

      const relationalDurationTime: SequenceTime = {
        start: 0,
        duration: { matchLengthOf: targetSeqId, paddingFrames: 20 },
      };

      stateManager.updateSequenceTime(testSeqId, relationalDurationTime);
      await stateManager.recompile();

      const updatedState = stateManager.getState();
      const resolvedTarget = updatedState.timeline?.sequences?.get(targetSeqId);
      const resolvedTest = updatedState.timeline?.sequences?.get(testSeqId);

      expect(resolvedTarget).toBeDefined();
      expect(resolvedTest).toBeDefined();
      if (resolvedTarget && resolvedTest) {
        const targetDuration = resolvedTarget.endFrame - resolvedTarget.startFrame;
        const testDuration = resolvedTest.endFrame - resolvedTest.startFrame;
        expect(testDuration).toBe(targetDuration + 20);
      }
    });

    it('should format frame counts to standard SMPTE timecode (HH:MM:SS:FF)', () => {
      expect(formatTimecode(0, 30)).toBe('00:00:00:00');
      expect(formatTimecode(15, 30)).toBe('00:00:00:15');
      expect(formatTimecode(30, 30)).toBe('00:00:01:00');
      expect(formatTimecode(75, 30)).toBe('00:00:02:15');
      expect(formatTimecode(1800, 30)).toBe('00:01:00:00');
      expect(formatTimecode(3600, 30)).toBe('00:02:00:00');
    });
  });

  describe('2. Domain-Filtered ALL_AVAILABLE_MODIFIERS Taxonomy', () => {
    it('should export all 9 canonical modifiers with strict track type constraints', () => {
      expect(ALL_AVAILABLE_MODIFIERS).toBeDefined();
      expect(ALL_AVAILABLE_MODIFIERS.length).toBeGreaterThanOrEqual(9);

      const modTypes = ALL_AVAILABLE_MODIFIERS.map((m) => m.type);
      expect(modTypes).toContain('transform');
      expect(modTypes).toContain('overlay/canvas_particles');
      expect(modTypes).toContain('overlay/hologram_hud');
      expect(modTypes).toContain('vfx/depth_relighting');
      expect(modTypes).toContain('camera/3d');
      expect(modTypes).toContain('vfx/color_grading');
      expect(modTypes).toContain('timed_text/style');
      expect(modTypes).toContain('sfx/dynamic_ducking');
      expect(modTypes).toContain('sfx/procedural');
    });

    it('should filter modifiers strictly for audio tracks', () => {
      const audioMods = ALL_AVAILABLE_MODIFIERS.filter((mod) =>
        mod.supportedTrackTypes.includes('audio')
      );
      const audioTypes = audioMods.map((m) => m.type);

      expect(audioTypes).toContain('sfx/dynamic_ducking');
      expect(audioTypes).toContain('sfx/procedural');

      // Visual and spatial modifiers MUST NOT appear for audio tracks
      expect(audioTypes).not.toContain('transform');
      expect(audioTypes).not.toContain('overlay/canvas_particles');
      expect(audioTypes).not.toContain('overlay/hologram_hud');
      expect(audioTypes).not.toContain('camera/3d');
      expect(audioTypes).not.toContain('vfx/depth_relighting');
      expect(audioTypes).not.toContain('timed_text/style');
    });

    it('should filter modifiers strictly for timed_text tracks', () => {
      const textMods = ALL_AVAILABLE_MODIFIERS.filter((mod) =>
        mod.supportedTrackTypes.includes('timed_text')
      );
      const textTypes = textMods.map((m) => m.type);

      expect(textTypes).toContain('timed_text/style');
      expect(textTypes).toContain('transform');

      // Audio and 3D camera modifiers MUST NOT appear for text tracks
      expect(textTypes).not.toContain('sfx/dynamic_ducking');
      expect(textTypes).not.toContain('sfx/procedural');
      expect(textTypes).not.toContain('camera/3d');
      expect(textTypes).not.toContain('overlay/canvas_particles');
    });

    it('should filter modifiers strictly for video tracks', () => {
      const videoMods = ALL_AVAILABLE_MODIFIERS.filter((mod) =>
        mod.supportedTrackTypes.includes('video')
      );
      const videoTypes = videoMods.map((m) => m.type);

      expect(videoTypes).toContain('transform');
      expect(videoTypes).toContain('overlay/canvas_particles');
      expect(videoTypes).toContain('overlay/hologram_hud');
      expect(videoTypes).toContain('vfx/depth_relighting');
      expect(videoTypes).toContain('camera/3d');
      expect(videoTypes).toContain('vfx/color_grading');

      // Audio-only and subtitle-only modifiers MUST NOT appear for video tracks
      expect(videoTypes).not.toContain('sfx/dynamic_ducking');
      expect(videoTypes).not.toContain('sfx/procedural');
      expect(videoTypes).not.toContain('timed_text/style');
    });
  });

  describe('3. Pure Attached-Only Modifier Architecture & Dynamic Mounting', () => {
    it('should unmount modifier accordion panels immediately when removed via IRStateManager', async () => {
      const stateManager = IRStateManager.getInstance();
      const seqId = 'seq-city-intro';

      // 1. Attach particle modifier
      stateManager.updateModifier(seqId, 'overlay/canvas_particles', {
        enabled: true,
        type: 'cyber_sparks',
        particleCount: 1500,
      });

      let seq = stateManager.getState().doc.tracks[0]?.sequences.find((s) => s.id === seqId);
      expect(seq?.modifiers?.some((m) => m.type === 'overlay/canvas_particles')).toBe(true);

      // 2. Remove particle modifier
      stateManager.removeModifier(seqId, 'overlay/canvas_particles');

      seq = stateManager.getState().doc.tracks[0]?.sequences.find((s) => s.id === seqId);
      expect(seq?.modifiers?.some((m) => m.type === 'overlay/canvas_particles')).toBe(false);
    });

    it('should handle pure empty modifier array without throwing or breaking state', () => {
      const stateManager = IRStateManager.getInstance();
      const emptySeq: IRSequence = {
        id: `seq-empty-${Date.now()}`,
        time: { start: 0, duration: 60 },
        modifiers: [],
      };

      stateManager.addSequence('track-v1', emptySeq, {
        trackTypeFallback: 'video',
        trackNameFallback: 'Video Main',
      });

      const state = stateManager.getState();
      const found = state.doc.tracks
        .flatMap((t) => t.sequences)
        .find((s) => s.id === emptySeq.id);

      expect(found).toBeDefined();
      expect(found?.modifiers).toEqual([]);
      expect(found?.assetId).toBeUndefined();
    });
  });

  describe('4. Standalone Overlay VFX Staging Presets on Dedicated Video Track', () => {
    it('should include canonical Overlay VFX presets targeting track-overlay-vfx without assetId', () => {
      const overlaySparks = STAGING_PRESETS.find((p) => p.id === 'overlay_particles_sparks');
      expect(overlaySparks).toBeDefined();
      expect(overlaySparks?.targetTrackId).toBe('track-overlay-vfx');
      expect(overlaySparks?.targetTrackType).toBe('video');
      expect(overlaySparks?.targetTrackName).toBe('VFX Overlays');

      const seqSparks = overlaySparks!.createSequence({ startFrame: 30, durationFrames: 120 });
      expect(seqSparks.id).toContain('seq-overlay-sparks');
      expect(seqSparks.assetId).toBeUndefined(); // Pure asset-less overlay sequence
      expect(seqSparks.time.start).toBe(30);
      expect(seqSparks.time.duration).toBe(120);

      const pMod = seqSparks.modifiers?.find((m) => m.type === 'overlay/canvas_particles');
      expect(pMod).toBeDefined();
      expect(pMod?.params?.type).toBe('cyber_sparks');

      const overlayHud = STAGING_PRESETS.find((p) => p.id === 'overlay_hologram_hud');
      expect(overlayHud).toBeDefined();
      expect(overlayHud?.targetTrackId).toBe('track-overlay-vfx');
      expect(overlayHud?.targetTrackType).toBe('video');

      const seqHud = overlayHud!.createSequence({ startFrame: 0, durationFrames: 90 });
      expect(seqHud.assetId).toBeUndefined();
      const hudMod = seqHud.modifiers?.find((m) => m.type === 'overlay/hologram_hud');
      expect(hudMod).toBeDefined();
      expect(hudMod?.params?.color).toBe('#00ffff');
    });

    it('should cleanly insert overlay VFX sequences into IRStateManager on track-overlay-vfx', async () => {
      const stateManager = IRStateManager.getInstance();
      const overlayPreset = STAGING_PRESETS.find((p) => p.id === 'overlay_particles_snow')!;
      expect(overlayPreset).toBeDefined();

      const newSeq = overlayPreset.createSequence({ startFrame: 60, durationFrames: 180 });
      stateManager.addSequence(overlayPreset.targetTrackId, newSeq, {
        trackTypeFallback: overlayPreset.targetTrackType,
        trackNameFallback: overlayPreset.targetTrackName,
      });

      await stateManager.recompile();

      const state = stateManager.getState();
      const overlayTrack = state.doc.tracks.find((t) => t.id === 'track-overlay-vfx');
      expect(overlayTrack).toBeDefined();
      expect(overlayTrack?.type).toBe('video');

      const registeredSeq = overlayTrack?.sequences.find((s) => s.id === newSeq.id);
      expect(registeredSeq).toBeDefined();
      expect(registeredSeq?.assetId).toBeUndefined();
      expect(registeredSeq?.modifiers?.length).toBeGreaterThanOrEqual(1);

      // Verify DAG compiler resolved its absolute frames
      const resolved = state.timeline?.sequences?.get(newSeq.id);
      expect(resolved).toBeDefined();
      expect(resolved?.startFrame).toBe(60);
      expect(resolved?.endFrame).toBe(240);
    });
  });

  describe('5. Dual-State timed_text/style Active-Word Karaoke Configuration', () => {
    it('should preserve both base typography and active-word karaoke parameters', () => {
      const stateManager = IRStateManager.getInstance();
      const trackId = 'track-subtitles';

      // Attach dual-state timed_text/style modifier on track
      stateManager.updateModifier(trackId, 'timed_text/style', {
        fontFamily: 'Montserrat',
        fontSize: 36,
        fontWeight: 800,
        fillColor: '#ffffff',
        activeWordHighlight: {
          enabled: true,
          fillColor: '#facc15',
          scale: 1.25,
          glowColor: '#00d4ff',
          animationPreset: 'glow_pulse',
        },
      });

      const track = stateManager.getState().doc.tracks.find((t) => t.id === trackId);
      const styleMod = track?.modifiers?.find((m) => m.type === 'timed_text/style');
      expect(styleMod).toBeDefined();
      expect(styleMod?.params?.fontFamily).toBe('Montserrat');
      expect(styleMod?.params?.fontSize).toBe(36);
      expect(styleMod?.params?.fontWeight).toBe(800);

      const activeWord = (styleMod?.params?.activeWordHighlight as any);
      expect(activeWord).toBeDefined();
      expect(activeWord.enabled).toBe(true);
      expect(activeWord.fillColor).toBe('#facc15');
      expect(activeWord.scale).toBe(1.25);
      expect(activeWord.animationPreset).toBe('glow_pulse');
    });
  });

  describe('6. Rule 229 Guardrail & DOM Accordion Trigger Integrity', () => {
    it('should verify that all AccordionTrigger components in SequenceInspector use the actions prop for interactive controls', () => {
      const inspectorPath = resolve(__dirname, '../apps/studio/src/components/inspector/SequenceInspector.tsx');
      const content = readFileSync(inspectorPath, 'utf-8');

      const regex = /<AccordionTrigger\b/g;
      let match: RegExpExecArray | null;
      let count = 0;

      while ((match = regex.exec(content)) !== null) {
        count++;
        const startIdx = match.index;
        // Parse balanced braces to find the true closing '>' of <AccordionTrigger ...>
        let depth = 0;
        let closeTagIdx = -1;
        for (let i = startIdx + '<AccordionTrigger'.length; i < content.length; i++) {
          if (content[i] === '{') depth++;
          else if (content[i] === '}') depth--;
          else if (content[i] === '>' && depth === 0) {
            closeTagIdx = i;
            break;
          }
        }

        expect(closeTagIdx).toBeGreaterThan(startIdx);
        const endTriggerIdx = content.indexOf('</AccordionTrigger>', closeTagIdx);
        expect(endTriggerIdx).toBeGreaterThan(closeTagIdx);

        const triggerProps = content.slice(startIdx, closeTagIdx + 1);
        const triggerChildren = content.slice(closeTagIdx + 1, endTriggerIdx);

        // Children of AccordionTrigger MUST NOT contain interactive buttons, switches, or inputs (Rule 229)
        const hasButtonInChild = /<Button|<button/i.test(triggerChildren);
        const hasSwitchInChild = /<Switch/i.test(triggerChildren);
        const hasInputInChild = /<Input|<input/i.test(triggerChildren);

        expect(hasButtonInChild).toBe(false);
        expect(hasSwitchInChild).toBe(false);
        expect(hasInputInChild).toBe(false);

        // If interactive elements exist on the trigger, they must be passed via actions prop
        if (/<Button|<button|<Switch|<input/i.test(triggerProps)) {
          expect(triggerProps).toContain('actions=');
        }
      }

      // Assert that we inspected all dynamic accordion triggers
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
