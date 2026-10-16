import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import path from 'path';
import fs from 'fs';
import { StudioServer } from '../apps/studio/src/server/StudioServer.js';

describe('Studio Timeline JSON-Patch & Scrubbing State Suite', () => {
  let server: StudioServer;
  let serverUrl: string;
  const testDir = path.resolve('./scratch/test_studio_timeline');

  beforeAll(async () => {
    fs.mkdirSync(testDir, { recursive: true });

    const doc: any = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'patch-test-proj',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'track-v1',
          type: 'video',
          sequences: [
            {
              id: 'seq-1',
              trackId: 'track-v1',
              time: { start: 0, duration: 150 },
              assetId: 'sample.mp4',
              modifiers: [],
            },
          ],
        },
      ],
    };

    server = new StudioServer(doc, {
      port: 33453,
      projectDir: testDir,
      isDev: false,
    });
    serverUrl = await server.start();
  });

  afterAll(() => {
    if (server) server.stop();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should return compiled timeline state and playhead via GET /api/timeline', async () => {
    const res = await fetch(`${serverUrl}/api/timeline`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.document.meta.contentId).toBe('patch-test-proj');
    expect(body.playhead.fps).toBe(30);
    expect(body.playhead.currentFrame).toBe(0);
    expect(body.canUndo).toBe(false);
  });

  it('should apply JSON-Patch operation dynamically via POST /api/patch', async () => {
    const patchRes = await fetch(`${serverUrl}/api/patch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ops: [
          {
            op: 'replace',
            path: '/meta/contentId',
            value: 'renamed-studio-proj',
          },
        ],
      }),
    });

    expect(patchRes.status).toBe(200);
    const body = await patchRes.json();
    expect(body.success).toBe(true);
    expect(body.document.meta.contentId).toBe('renamed-studio-proj');
    expect(body.canUndo).toBe(true);

    // Verify GET /api/timeline reflects the patch
    const getRes = await fetch(`${serverUrl}/api/timeline`);
    const getData = await getRes.json();
    expect(getData.document.meta.contentId).toBe('renamed-studio-proj');
  });

  it('should scrub playhead position via POST /api/scrub', async () => {
    const scrubRes = await fetch(`${serverUrl}/api/scrub`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame: 45 }),
    });

    expect(scrubRes.status).toBe(200);
    const body = await scrubRes.json();
    expect(body.playhead.currentFrame).toBe(45);
    expect(body.playhead.currentTime).toBe(1.5);
  });

  it('should undo the JSON-Patch change via POST /api/undo', async () => {
    const undoRes = await fetch(`${serverUrl}/api/undo`, {
      method: 'POST',
    });

    expect(undoRes.status).toBe(200);
    const body = await undoRes.json();
    expect(body.document.meta.contentId).toBe('patch-test-proj');
    expect(body.canRedo).toBe(true);
  });
});
