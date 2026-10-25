import { describe, it, expect } from 'bun:test';
import {
  ScriptingFrameworkRegistry,
  MysteryBoxExplainerStrategy,
  BreadcrumbTrailDigitalStrategy,
  StakesAndEscalationStrategy,
  IntimateConfessionalStrategy,
  HistoricalParallelsStrategy,
  ContrarianThesisStrategy,
  PipelineIRBuilder,
  AutoConfigEngineFacade,
  type ScriptBeat,
} from '@acc/core';
import type { PipelineIR } from '@acc/ir';

describe('Phase 1: Narrative Scripting Frameworks (Option B)', () => {
  describe('ScriptingFrameworkRegistry & Strategy Discovery', () => {
    it('should register and expose all 6 master scripting strategies', () => {
      const all = ScriptingFrameworkRegistry.getAll();
      expect(all.length).toBe(6);

      const ids = all.map((s) => s.id);
      expect(ids).toContain('mystery-box-explainer');
      expect(ids).toContain('breadcrumb-trail-digital');
      expect(ids).toContain('stakes-and-escalation');
      expect(ids).toContain('intimate-confessional');
      expect(ids).toContain('historical-parallels');
      expect(ids).toContain('contrarian-thesis');
    });

    it('should resolve strategies by primary ID and aliases', () => {
      expect(ScriptingFrameworkRegistry.get('mystery-box-explainer')).toBeInstanceOf(
        MysteryBoxExplainerStrategy
      );
      expect(ScriptingFrameworkRegistry.get('mystery_box')).toBeInstanceOf(
        MysteryBoxExplainerStrategy
      );

      expect(ScriptingFrameworkRegistry.get('breadcrumb-trail-digital')).toBeInstanceOf(
        BreadcrumbTrailDigitalStrategy
      );
      expect(ScriptingFrameworkRegistry.get('breadcrumb_trail')).toBeInstanceOf(
        BreadcrumbTrailDigitalStrategy
      );

      expect(ScriptingFrameworkRegistry.get('stakes-and-escalation')).toBeInstanceOf(
        StakesAndEscalationStrategy
      );
      expect(ScriptingFrameworkRegistry.get('stakes_and_escalation')).toBeInstanceOf(
        StakesAndEscalationStrategy
      );

      expect(ScriptingFrameworkRegistry.get('intimate-confessional')).toBeInstanceOf(
        IntimateConfessionalStrategy
      );
      expect(ScriptingFrameworkRegistry.get('intimate_confessional')).toBeInstanceOf(
        IntimateConfessionalStrategy
      );

      expect(ScriptingFrameworkRegistry.get('historical-parallels')).toBeInstanceOf(
        HistoricalParallelsStrategy
      );
      expect(ScriptingFrameworkRegistry.get('rhythm-and-flow')).toBeInstanceOf(
        HistoricalParallelsStrategy
      );

      expect(ScriptingFrameworkRegistry.get('contrarian-thesis')).toBeInstanceOf(
        ContrarianThesisStrategy
      );
      expect(ScriptingFrameworkRegistry.get('thesis-and-proof')).toBeInstanceOf(
        ContrarianThesisStrategy
      );
    });

    it('should resolve the correct strategy by video style ID', () => {
      expect(ScriptingFrameworkRegistry.resolveForStyle('sketchbook').id).toBe(
        'mystery-box-explainer'
      );
      expect(ScriptingFrameworkRegistry.resolveForStyle('isometric-system').id).toBe(
        'mystery-box-explainer'
      );
      expect(ScriptingFrameworkRegistry.resolveForStyle('screenlife-narrative').id).toBe(
        'breadcrumb-trail-digital'
      );
      expect(ScriptingFrameworkRegistry.resolveForStyle('terminal-code-block').id).toBe(
        'breadcrumb-trail-digital'
      );
      expect(ScriptingFrameworkRegistry.resolveForStyle('hyper-retention-challenge').id).toBe(
        'stakes-and-escalation'
      );
      expect(ScriptingFrameworkRegistry.resolveForStyle('parasocial-anchor').id).toBe(
        'intimate-confessional'
      );
      expect(ScriptingFrameworkRegistry.resolveForStyle('archival-collage').id).toBe(
        'historical-parallels'
      );
      expect(ScriptingFrameworkRegistry.resolveForStyle('video-essay').id).toBe(
        'contrarian-thesis'
      );
    });

    it('should classify narrative framework from content keywords and topics', () => {
      expect(
        ScriptingFrameworkRegistry.resolveForContent('Debugging kernel memory leak in terminal').id
      ).toBe('breadcrumb-trail-digital');

      expect(
        ScriptingFrameworkRegistry.resolveForContent('Can I survive 24 hours under strict rules').id
      ).toBe('stakes-and-escalation');

      expect(
        ScriptingFrameworkRegistry.resolveForContent('My honest confession about burnout and failure').id
      ).toBe('intimate-confessional');

      expect(
        ScriptingFrameworkRegistry.resolveForContent('Ancient history parallels in the modern economy').id
      ).toBe('historical-parallels');

      expect(
        ScriptingFrameworkRegistry.resolveForContent('Debunking the myth about tech valuation bubbles').id
      ).toBe('contrarian-thesis');

      expect(
        ScriptingFrameworkRegistry.resolveForContent('General exploration of quantum computing').id
      ).toBe('mystery-box-explainer');
    });
  });

  describe('Concrete Framework Strategies & Beat Generation', () => {
    it('MysteryBoxExplainerStrategy: generates nominal beats and scales duration', async () => {
      const strategy = new MysteryBoxExplainerStrategy();
      const beats = await strategy.generateBeats({
        topic: 'Quantum Cryptography',
      });

      expect(beats.length).toBe(6);
      expect(beats[0].name).toBe('The Cold Hook');
      expect(beats[0].audioRole).toBe('hook');
      expect(beats[0].visualPacing).toBe('rapid_cut');
      expect(beats[0].sfxCue).toBe('sfx_heavy_bass_drop');
      expect(beats[beats.length - 1].timingSec[1]).toBe(150);

      // Verify proportional scaling to 60s
      const scaledBeats = await strategy.generateBeats({
        topic: 'Quantum Cryptography',
        targetDurationSec: 60,
      });
      expect(scaledBeats.length).toBe(6);
      expect(scaledBeats[0].timingSec[0]).toBe(0);
      expect(scaledBeats[scaledBeats.length - 1].timingSec[1]).toBe(60);

      // Verify monotonic continuity
      for (let i = 0; i < scaledBeats.length - 1; i++) {
        expect(scaledBeats[i].timingSec[1]).toBe(scaledBeats[i + 1].timingSec[0]);
      }
    });

    it('BreadcrumbTrailDigitalStrategy: generates forensic digital investigation beats', async () => {
      const strategy = new BreadcrumbTrailDigitalStrategy();
      const beats = await strategy.generateBeats({
        topic: 'Zero-Day Vulnerability',
        targetDurationSec: 90,
      });

      expect(beats.length).toBe(5);
      expect(beats[0].name).toBe('The Discovery');
      expect(beats[0].sfxCue).toBe('sfx_mouse_clicks_typing');
      expect(beats[3].name).toBe('The Dead End');
      expect(beats[3].visualPacing).toBe('intimate_hold');
      expect(beats[4].name).toBe('The Final Decryption');
      expect(beats[4].timingSec[1]).toBe(90);
    });

    it('StakesAndEscalationStrategy: generates high-velocity challenge beats', async () => {
      const strategy = new StakesAndEscalationStrategy();
      const beats = await strategy.generateBeats({
        topic: '100-Hour Speedrun',
        targetDurationSec: 120,
      });

      expect(beats.length).toBe(6);
      expect(beats[0].name).toBe('The Ultimatum Hook');
      expect(beats[0].typographyStyle).toBe('massive_timer_countdown');
      expect(beats[1].name).toBe('The Rule Set');
      expect(beats[5].name).toBe('The Buzzer Beater');
      expect(beats[5].timingSec[1]).toBe(120);
    });

    it('IntimateConfessionalStrategy: generates conversational authentic takes', async () => {
      const strategy = new IntimateConfessionalStrategy();
      const beats = await strategy.generateBeats({
        topic: 'Why I Left Big Tech',
      });

      expect(beats.length).toBe(5);
      expect(beats[0].name).toBe('The Raw Open');
      expect(beats[0].visualPacing).toBe('intimate_hold');
      expect(beats[4].name).toBe('The Grounded Outro');
      expect(beats[4].audioRole).toBe('resolution');
    });

    it('HistoricalParallelsStrategy: generates dual-timeline historical beats', async () => {
      const strategy = new HistoricalParallelsStrategy();
      const beats = await strategy.generateBeats({
        topic: 'The 1929 Crash vs AI Boom',
        targetDurationSec: 75,
      });

      expect(beats.length).toBe(5);
      expect(beats[0].name).toBe('The Echo Hook');
      expect(beats[0].cameraPreset).toBe('dual_timeline_split');
      expect(beats[4].name).toBe('The Historical Verdict');
      expect(beats[4].timingSec[1]).toBe(75);
    });

    it('ContrarianThesisStrategy: generates myth-busting forensic receipts', async () => {
      const strategy = new ContrarianThesisStrategy();
      const beats = await strategy.generateBeats({
        topic: 'The Microservices Myth',
        targetDurationSec: 100,
      });

      expect(beats.length).toBe(5);
      expect(beats[0].name).toBe('The Provocative Thesis');
      expect(beats[0].typographyStyle).toBe('myth_busting_badge');
      expect(beats[2].name).toBe('The Counter-Evidence (Receipts)');
      expect(beats[4].name).toBe('The Paradigm Shift');
      expect(beats[4].timingSec[1]).toBe(100);
    });
  });

  describe('PipelineIR Transformation & Immutability', () => {
    const createMockIR = (): PipelineIR => ({
      schemaVersion: '3.0.0',
      pipelineId: 'generative-storytelling',
      metadata: {
        jobId: 'test-job-123',
        title: 'Neural Networks Decoded',
        createdAt: '2026-10-14T00:00:00.000Z',
        tags: ['tech'],
      },
      chunks: [
        {
          id: 'chunk-1',
          order: 1,
          text: 'Initial concept',
          durationMs: 4000,
        },
      ],
      audioComposition: {
        ducking: {
          enabled: true,
          attenuationDb: -10,
          attackMs: 200,
          releaseMs: 300,
        },
        sfxMarkers: [],
      },
      distributionHints: {
        supportedExporters: ['video'],
        targetAspectRatios: ['9:16'],
      },
    });

    it('should strictly preserve input PipelineIR immutability', async () => {
      const strategy = new MysteryBoxExplainerStrategy();
      const originalIR = createMockIR();
      const originalCopy = JSON.parse(JSON.stringify(originalIR));

      const beats = await strategy.generateBeats({ topic: originalIR.metadata.title });
      const enrichedIR = strategy.applyToPipelineIR(originalIR, beats);

      // Verify original IR was untouched
      expect(originalIR).toEqual(originalCopy);
      // Verify enriched IR is different
      expect(enrichedIR).not.toBe(originalIR);
      expect(enrichedIR.chunks.length).toBe(6);
    });

    it('should expand single chunk into narrative beat chunks and stage SFX markers', async () => {
      const strategy = new BreadcrumbTrailDigitalStrategy();
      const originalIR = createMockIR();
      const beats = await strategy.generateBeats({
        topic: originalIR.metadata.title,
        targetDurationSec: 60,
      });

      const result = strategy.applyToPipelineIR(originalIR, beats);

      expect(result.chunks.length).toBe(5);
      expect(result.chunks[0].id).toBe('chunk-1');
      expect(result.chunks[0].metadata?.beat).toBe('The Discovery');
      expect(result.chunks[0].metadata?.sfxCue).toBe('sfx_mouse_clicks_typing');
      expect(result.chunks[0].metadata?.visualPacing).toBe('kinetic_motion');

      // Verify SFX markers populated in audioComposition
      expect(result.audioComposition.sfxMarkers.length).toBeGreaterThanOrEqual(4);
      expect(result.audioComposition.sfxMarkers[0].sfxId).toBe('sfx_mouse_clicks_typing');
      expect(result.audioComposition.sfxMarkers[0].timeMs).toBe(0);

      // Verify ducking profile updated
      expect(result.audioComposition.ducking.attenuationDb).toBe(-14);
      expect(result.audioComposition.ducking.attackMs).toBe(100);

      // Verify metadata tags
      expect(result.metadata.tags).toContain('framework:breadcrumb-trail-digital');
      expect(result.metadata.framework).toBe('breadcrumb-trail-digital');
    });

    it('should map beat metadata across existing multi-chunk workspace preserving media bindings', async () => {
      const strategy = new StakesAndEscalationStrategy();
      const beats = await strategy.generateBeats({ topic: 'Challenge Project', targetDurationSec: 60 });

      const multiChunkIR: PipelineIR = {
        ...createMockIR(),
        chunks: [
          {
            id: 'c1',
            order: 1,
            text: 'Slide 1',
            durationMs: 10000,
            visualAsset: { type: 'image', sourcePathOrBuffer: 'assets/img1.png' },
          },
          {
            id: 'c2',
            order: 2,
            text: 'Slide 2',
            durationMs: 10000,
            visualAsset: { type: 'image', sourcePathOrBuffer: 'assets/img2.png' },
          },
          {
            id: 'c3',
            order: 3,
            text: 'Slide 3',
            durationMs: 10000,
            visualAsset: { type: 'image', sourcePathOrBuffer: 'assets/img3.png' },
          },
        ],
      };

      const result = strategy.applyToPipelineIR(multiChunkIR, beats);

      expect(result.chunks.length).toBe(3);
      expect(result.chunks[0].visualAsset?.sourcePathOrBuffer).toBe('assets/img1.png');
      expect(result.chunks[1].visualAsset?.sourcePathOrBuffer).toBe('assets/img2.png');
      expect(result.chunks[2].visualAsset?.sourcePathOrBuffer).toBe('assets/img3.png');

      // Each chunk enriched with beat metadata
      expect(result.chunks[0].metadata?.beat).toBeDefined();
      expect(result.chunks[1].metadata?.beat).toBeDefined();
      expect(result.chunks[2].metadata?.beat).toBeDefined();
    });
  });

  describe('PipelineIRBuilder Direct Integration', () => {
    it('should build PipelineIR with scripting framework by string ID', () => {
      const builder = new PipelineIRBuilder('generative-storytelling')
        .setTitle('Isometric World Building')
        .applyScriptingFramework('mystery-box-explainer');

      const ir = builder.build();

      expect(ir.metadata.framework).toBe('mystery-box-explainer');
      expect(ir.metadata.tags).toContain('framework:mystery-box-explainer');
      expect(ir.chunks.length).toBe(6);
      expect(ir.chunks[0].metadata?.beat).toBe('The Cold Hook');
      expect(ir.chunks[0].metadata?.sfxCue).toBe('sfx_heavy_bass_drop');
      expect(ir.audioComposition.sfxMarkers.length).toBeGreaterThanOrEqual(5);
    });

    it('should build PipelineIR with custom beats supplied to builder', () => {
      const customBeats: ScriptBeat[] = [
        {
          name: 'Custom Hook',
          timingSec: [0, 8],
          audioRole: 'hook',
          visualPacing: 'rapid_cut',
          sfxCue: 'sfx_custom_riser',
        },
        {
          name: 'Custom Resolution',
          timingSec: [8, 30],
          audioRole: 'resolution',
          visualPacing: 'slow_burn',
          sfxCue: 'sfx_custom_chime',
        },
      ];

      const builder = new PipelineIRBuilder('scraper-summarizer')
        .setTitle('Custom Beats Project')
        .setScriptBeats(customBeats);

      const ir = builder.build();

      expect(ir.chunks.length).toBe(2);
      expect(ir.chunks[0].metadata?.beat).toBe('Custom Hook');
      expect(ir.chunks[1].metadata?.beat).toBe('Custom Resolution');
      expect(ir.audioComposition.sfxMarkers.some((m) => m.sfxId === 'sfx_custom_riser')).toBe(true);
      expect(ir.audioComposition.sfxMarkers.some((m) => m.sfxId === 'sfx_custom_chime')).toBe(true);
    });
  });

  describe('AutoConfigEngineFacade Integration', () => {
    it('should scaffold directory with explicit scriptingFramework option in dryRun mode', async () => {
      const result = await AutoConfigEngineFacade.scaffoldDirectory('sample-story', {
        scriptingFramework: 'stakes-and-escalation',
        targetDurationSec: 45,
        dryRun: true,
      });

      expect(result.pipelineIR).toBeDefined();
      expect(result.pipelineIR.metadata.framework).toBe('stakes-and-escalation');
      expect(result.pipelineIR.metadata.tags).toContain('framework:stakes-and-escalation');
      expect(result.pipelineIR.audioComposition.ducking.attenuationDb).toBe(-18);
    });
  });
});
