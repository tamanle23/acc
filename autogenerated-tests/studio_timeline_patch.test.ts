import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  StudioTimelineState,
  UIStudioPreviewEngine,
  StudioServer,
  type JsonPatchOperation,
} from '../apps/cli/src/studio';
import {
  FFmpegManager,
  initFFI,
} from '@acc/core';
import type { VideoIRDocument } from '@acc/ir';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Phase 4: Dual-Engine Web/UI Studio Preview & JSON-Patch AST Bridge (Option D)', () => {
  const tmpDir = path.join(os.tmpdir(), `acc_studio_test_${Date.now()}`);

  const mockIrDocument: VideoIRDocument = {
    version: '1.0.0-stable',
    meta: {
      contentId: 'studio_test_project',
      globalFps: 30,
      canvasSize: { w: 640, h: 360 },
    },
    tracks: [
      {
        id: 'track-v1',
        type: 'video',
        name: 'Main Video',
        sequences: [
          {
            id: 'seq-1',
            time: { start: 0, duration: 30 }, // 1.0s
            modifiers: [
              { type: 'canvas_particle_overlay', params: { density: 50 } },
            ],
          },
          {
            id: 'seq-2',
            time: { start: 30, duration: 30 }, // 1.0s
          },
        ],
      },
      {
        id: 'track-text',
        type: 'timed_text',
        name: 'Subtitles & Cues',
        sequences: [
          {
            id: 'seq-text-1',
            time: { start: 0, duration: 60 },
            cues: [
              { startOffsetMs: 0, endOffsetMs: 1000, text: 'Initial Headline' },
              { startOffsetMs: 1000, endOffsetMs: 2000, text: 'Second Beat' },
            ],
          },
        ],
      },
    ],
  };

  beforeAll(async () => {
    await FFmpegManager.prepare();
    initFFI();
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  describe('StudioTimelineState: Immutable State Management & Scrubbing', () => {
    it('should initialize and compile DAG timeline accurately', async () => {
      const state = new StudioTimelineState(mockIrDocument, tmpDir);
      const timeline = await state.compile();

      expect(timeline.totalFrames).toBe(60);
      expect(timeline.durationSeconds).toBe(2);
      expect(timeline.tracks.size).toBe(2);

      const playhead = state.getPlayheadState();
      expect(playhead.currentFrame).toBe(0);
      expect(playhead.currentTime).toBe(0);
      expect(playhead.fps).toBe(30);
      expect(playhead.totalFrames).toBe(60);
      expect(playhead.isPlaying).toBe(false);
    });

    it('should scrub playhead by frame and time string with strict boundary clamping', async () => {
      const state = new StudioTimelineState(mockIrDocument, tmpDir);
      await state.compile();

      state.seek(15);
      expect(state.getPlayheadState().currentFrame).toBe(15);
      expect(state.getPlayheadState().currentTime).toBe(0.5);

      state.seek('1.5s');
      expect(state.getPlayheadState().currentFrame).toBe(45);
      expect(state.getPlayheadState().currentTime).toBe(1.5);

      // Clamp negative frame
      state.seek(-10);
      expect(state.getPlayheadState().currentFrame).toBe(0);

      // Clamp past end
      state.seek(999);
      expect(state.getPlayheadState().currentFrame).toBe(59);

      // Step
      state.seek(20);
      state.step(5);
      expect(state.getPlayheadState().currentFrame).toBe(25);
      state.step(-10);
      expect(state.getPlayheadState().currentFrame).toBe(15);
    });

    it('should resolve active clips, local frames, cues, and modifiers at arbitrary playhead positions', async () => {
      const state = new StudioTimelineState(mockIrDocument, tmpDir);
      await state.compile();

      // At frame 10 (0.33s): seq-1 (video) and seq-text-1 (first cue) should be active
      const activeAt10 = state.getActiveClipsAtFrame(10);
      expect(activeAt10.length).toBe(2);

      const v1Clip = activeAt10.find((c) => c.trackId === 'track-v1');
      expect(v1Clip).toBeDefined();
      expect(v1Clip?.sequenceId).toBe('seq-1');
      expect(v1Clip?.localFrame).toBe(10);
      expect(v1Clip?.modifiers.some((m) => m.type === 'canvas_particle_overlay')).toBe(true);

      const textClip = activeAt10.find((c) => c.trackId === 'track-text');
      expect(textClip).toBeDefined();
      expect(textClip?.activeCues.length).toBe(1);
      expect(textClip?.activeCues[0].text).toBe('Initial Headline');

      // At frame 40 (1.33s): seq-2 (video) and seq-text-1 (second cue) should be active
      const activeAt40 = state.getActiveClipsAtFrame(40);
      const v2Clip = activeAt40.find((c) => c.trackId === 'track-v1');
      expect(v2Clip?.sequenceId).toBe('seq-2');
      expect(v2Clip?.localFrame).toBe(10);

      const textClip40 = activeAt40.find((c) => c.trackId === 'track-text');
      expect(textClip40?.activeCues.length).toBe(1);
      expect(textClip40?.activeCues[0].text).toBe('Second Beat');
    });
  });

  describe('RFC 6902 JSON-Patch Operations & Undo / Redo Stack', () => {
    it('should apply replace patch immutably and generate inverse patch', async () => {
      const state = new StudioTimelineState(mockIrDocument, tmpDir);
      await state.compile();

      const patchOps: JsonPatchOperation[] = [
        {
          op: 'replace',
          path: '/tracks/1/sequences/0/cues/0/text',
          value: 'Patched Headline by Studio Editor',
        },
      ];

      const res = await state.applyPatch(patchOps);
      expect(res.document.tracks[1].sequences[0].cues![0].text).toBe('Patched Headline by Studio Editor');
      expect(res.inverseOps.length).toBe(1);
      expect(res.inverseOps[0].op).toBe('replace');
      expect(res.inverseOps[0].value).toBe('Initial Headline');

      // Verify undo restores original state
      expect(state.canUndo()).toBe(true);
      const undoRes = await state.undo();
      expect(undoRes.success).toBe(true);
      expect(undoRes.document.tracks[1].sequences[0].cues![0].text).toBe('Initial Headline');

      // Verify redo reapplies patch
      expect(state.canRedo()).toBe(true);
      const redoRes = await state.redo();
      expect(redoRes.success).toBe(true);
      expect(redoRes.document.tracks[1].sequences[0].cues![0].text).toBe('Patched Headline by Studio Editor');
    });

    it('should support adding and removing modifiers dynamically', async () => {
      const state = new StudioTimelineState(mockIrDocument, tmpDir);
      await state.compile();

      // Add depth_3d modifier to seq-2
      await state.toggleModifier('track-v1', 'seq-2', 'depth_3d', true, { mode: 'cinema_dolly' });
      const docWithMod = state.getDocument();
      const seq2Mods = docWithMod.tracks[0].sequences[1].modifiers;
      expect(seq2Mods).toBeDefined();
      expect(seq2Mods!.some((m) => m.type === 'depth_3d')).toBe(true);

      // Remove modifier
      await state.toggleModifier('track-v1', 'seq-2', 'depth_3d', false);
      const docWithoutMod = state.getDocument();
      const seq2ModsAfter = docWithoutMod.tracks[0].sequences[1].modifiers || [];
      expect(seq2ModsAfter.some((m) => m.type === 'depth_3d')).toBe(false);
    });

    it('should support semantic helper updateSequenceTime with automatic timeline recompilation', async () => {
      const state = new StudioTimelineState(mockIrDocument, tmpDir);
      await state.compile();

      // Extend duration of seq-1 from 30 to 60 frames
      const res = await state.updateSequenceTime('track-v1', 'seq-1', 0, 60);
      expect(res.timeline.totalFrames).toBeGreaterThanOrEqual(60);
      expect(res.document.tracks[0].sequences[0].time.duration).toBe(60);
    });
  });

  describe('UIStudioPreviewEngine: Real-time Frame Preview & Deterministic Export', () => {
    it('should resolve preview payload with text cues and active modifier badges', async () => {
      const state = new StudioTimelineState(mockIrDocument, tmpDir);
      await state.compile();
      const engine = new UIStudioPreviewEngine(state, tmpDir);

      const preview = engine.resolveFramePreview(5);
      expect(preview.frame).toBe(5);
      expect(preview.totalFrames).toBe(60);
      expect(preview.fps).toBe(30);
      expect(preview.canvasSize.w).toBe(640);
      expect(preview.canvasSize.h).toBe(360);
      expect(preview.activeTextCues.length).toBe(1);
      expect(preview.activeTextCues[0].text).toBe('Initial Headline');
      expect(preview.activeModifiers.some((m) => m.type === 'canvas_particle_overlay')).toBe(true);
    });

    it('should dispatch dryRun backend export and return deterministic metrics', async () => {
      const state = new StudioTimelineState(mockIrDocument, tmpDir);
      await state.compile();
      const engine = new UIStudioPreviewEngine(state, tmpDir);

      const renderResult = await engine.dispatchBackendRender({ dryRun: true });
      expect(renderResult.success).toBe(true);
      expect(renderResult.totalFrames).toBe(60);
      expect(renderResult.fps).toBe(30);
      expect(renderResult.renderTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('StudioServer: REST API Endpoints & Embedded HTML5 Preview UI', () => {
    let server: StudioServer;
    let serverUrl: string;

    beforeAll(async () => {
      server = new StudioServer(mockIrDocument, { port: 3399, baseDir: tmpDir });
      serverUrl = await server.start();
    });

    afterAll(() => {
      if (server) {
        server.stop();
      }
    });

    it('should respond to GET /api/health with status ok', async () => {
      const res = await fetch(`${serverUrl}/api/health`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(json.port).toBe(3399);
    });

    it('should serve HTML5 studio application on GET /', async () => {
      const res = await fetch(`${serverUrl}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).toContain('ACC Studio Preview');
      expect(html).toContain('studioCanvas');
      expect(html).toContain('Deterministic Export');
    });

    it('should return timeline state on GET /api/timeline', async () => {
      const res = await fetch(`${serverUrl}/api/timeline`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.document).toBeDefined();
      expect(json.playhead.totalFrames).toBe(60);
      expect(json.preview).toBeDefined();
    });

    it('should scrub playhead on POST /api/scrub', async () => {
      const res = await fetch(`${serverUrl}/api/scrub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame: 35 }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.playhead.currentFrame).toBe(35);
      expect(json.preview.frame).toBe(35);
    });

    it('should apply JSON-Patch via POST /api/patch and support undo via POST /api/undo', async () => {
      const patchRes = await fetch(`${serverUrl}/api/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ops: [
            {
              op: 'replace',
              path: '/tracks/1/sequences/0/cues/0/text',
              value: 'Patched over HTTP',
            },
          ],
        }),
      });
      expect(patchRes.status).toBe(200);
      const patchJson = await patchRes.json();
      expect(patchJson.success).toBe(true);
      expect(patchJson.document.tracks[1].sequences[0].cues[0].text).toBe('Patched over HTTP');

      // Undo via HTTP
      const undoRes = await fetch(`${serverUrl}/api/undo`, { method: 'POST' });
      expect(undoRes.status).toBe(200);
      const undoJson = await undoRes.json();
      expect(undoJson.success).toBe(true);
      expect(undoJson.document.tracks[1].sequences[0].cues[0].text).toBe('Initial Headline');
    });
  });
});
