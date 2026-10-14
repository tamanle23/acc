import path from 'path';
import fs from 'fs';
import { Logger } from '@acc/core';
import { StudioTimelineState } from './StudioTimelineState';
import { UIStudioPreviewEngine } from './UIStudioPreviewEngine';
import type { VideoIRDocument } from '@acc/ir';
import type { JsonPatchOperation } from './types';

export interface StudioServerOptions {
  port?: number;
  baseDir?: string;
}

/**
 * StudioServer:
 * Lightweight native Bun HTTP server hosting the Dual-Engine Web/UI Studio (Option D).
 * Serves the interactive browser preview editor and exposes REST endpoints for
 * JSON-Patch synchronization, playhead scrubbing, and deterministic export dispatch.
 */
export class StudioServer {
  private server: any = null;
  private timelineState: StudioTimelineState;
  private previewEngine: UIStudioPreviewEngine;
  private port: number;
  private baseDir: string;

  constructor(document: VideoIRDocument, options: StudioServerOptions = {}) {
    this.port = options.port ?? 3300;
    this.baseDir = options.baseDir ?? process.cwd();
    this.timelineState = new StudioTimelineState(document, this.baseDir);
    this.previewEngine = new UIStudioPreviewEngine(this.timelineState, this.baseDir);
  }

  public getTimelineState(): StudioTimelineState {
    return this.timelineState;
  }

  public getPreviewEngine(): UIStudioPreviewEngine {
    return this.previewEngine;
  }

  public async start(): Promise<string> {
    await this.timelineState.compile();

    const self = this;
    this.server = Bun.serve({
      port: self.port,
      async fetch(req) {
        const url = new URL(req.url);
        const method = req.method.toUpperCase();

        // CORS headers for local studio development
        const headers: Record<string, string> = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (method === 'OPTIONS') {
          return new Response(null, { headers });
        }

        try {
          // --- API Endpoints ---
          if (url.pathname === '/api/health') {
            return Response.json(
              { status: 'ok', uptime: process.uptime(), port: self.port },
              { headers }
            );
          }

          if (url.pathname === '/api/timeline' && method === 'GET') {
            const playhead = self.timelineState.getPlayheadState();
            const preview = self.previewEngine.resolveFramePreview();
            return Response.json(
              {
                document: self.timelineState.getDocument(),
                playhead,
                preview,
                canUndo: self.timelineState.canUndo(),
                canRedo: self.timelineState.canRedo(),
              },
              { headers }
            );
          }

          if (url.pathname === '/api/patch' && method === 'POST') {
            const body = await req.json() as { ops: JsonPatchOperation[] };
            if (!body || !Array.isArray(body.ops)) {
              return Response.json({ error: "Missing or invalid 'ops' array in request body" }, { status: 400, headers });
            }
            const res = await self.timelineState.applyPatch(body.ops);
            const playhead = self.timelineState.getPlayheadState();
            const preview = self.previewEngine.resolveFramePreview();
            return Response.json(
              {
                success: true,
                document: res.document,
                inverseOps: res.inverseOps,
                playhead,
                preview,
                canUndo: self.timelineState.canUndo(),
                canRedo: self.timelineState.canRedo(),
              },
              { headers }
            );
          }

          if (url.pathname === '/api/undo' && method === 'POST') {
            const res = await self.timelineState.undo();
            const playhead = self.timelineState.getPlayheadState();
            const preview = self.previewEngine.resolveFramePreview();
            return Response.json(
              {
                ...res,
                playhead,
                preview,
                canUndo: self.timelineState.canUndo(),
                canRedo: self.timelineState.canRedo(),
              },
              { headers }
            );
          }

          if (url.pathname === '/api/redo' && method === 'POST') {
            const res = await self.timelineState.redo();
            const playhead = self.timelineState.getPlayheadState();
            const preview = self.previewEngine.resolveFramePreview();
            return Response.json(
              {
                ...res,
                playhead,
                preview,
                canUndo: self.timelineState.canUndo(),
                canRedo: self.timelineState.canRedo(),
              },
              { headers }
            );
          }

          if (url.pathname === '/api/scrub' && method === 'POST') {
            const body = await req.json() as { frame?: number; time?: number | string };
            let playhead;
            if (body.frame !== undefined) {
              playhead = self.timelineState.seek(body.frame);
            } else if (body.time !== undefined) {
              playhead = self.timelineState.seek(body.time);
            } else {
              playhead = self.timelineState.getPlayheadState();
            }
            const preview = self.previewEngine.resolveFramePreview();
            return Response.json({ playhead, preview }, { headers });
          }

          if (url.pathname === '/api/render' && method === 'POST') {
            let body: any = {};
            try {
              body = await req.json();
            } catch {
              // default empty options
            }
            const result = await self.previewEngine.dispatchBackendRender(body);
            return Response.json(result, { headers });
          }

          // --- Static UI Editor Frontend ---
          if (url.pathname === '/' || url.pathname === '/index.html') {
            return new Response(self.renderStudioHtml(), {
              headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
            });
          }

          return new Response('Not Found', { status: 404, headers });
        } catch (err: any) {
          Logger.error('StudioServer', `Server error handling ${url.pathname}: ${err.message}`);
          return Response.json({ error: err.message }, { status: 500, headers });
        }
      },
    });

    const serverUrl = `http://localhost:${this.port}`;
    Logger.info('StudioServer', `🚀 UI Studio Preview Engine listening on ${serverUrl}`);
    return serverUrl;
  }

  public getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  public stop() {
    if (this.server) {
      this.server.stop();
      this.server = null;
      Logger.info('StudioServer', 'UI Studio Server stopped.');
    }
  }

  /**
   * Generates the self-contained HTML5 Canvas Studio interface.
   */
  private renderStudioHtml(): string {
    const doc = this.timelineState.getDocument();
    const playhead = this.timelineState.getPlayheadState();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ACC Studio Preview — ${doc.meta.contentId}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg: #0f1117;
      --panel-bg: #181b26;
      --border: #282d3f;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --accent: #10b981;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { background: var(--bg); color: var(--text); display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    header { background: var(--panel-bg); border-bottom: 1px solid var(--border); padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
    .header-title { display: flex; align-items: center; gap: 12px; font-weight: 600; font-size: 1.1rem; }
    .badge { background: #312e81; color: #a5b4fc; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; }
    .header-actions { display: flex; gap: 10px; }
    button { background: var(--panel-bg); color: var(--text); border: 1px solid var(--border); padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: all 0.15s; }
    button:hover { background: #232738; }
    button.primary { background: var(--primary); border-color: var(--primary); color: white; }
    button.primary:hover { background: var(--primary-hover); }
    .main-view { display: flex; flex: 1; overflow: hidden; }
    .viewport { flex: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; background: #090a0f; position: relative; }
    canvas { background: #000; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 100%; max-height: 80%; border: 1px solid var(--border); }
    .sidebar { flex: 1; min-width: 320px; max-width: 440px; background: var(--panel-bg); border-left: 1px solid var(--border); display: flex; flex-direction: column; }
    .tabs { display: flex; border-bottom: 1px solid var(--border); }
    .tab { flex: 1; text-align: center; padding: 10px; cursor: pointer; color: var(--text-muted); font-size: 0.85rem; border-bottom: 2px solid transparent; }
    .tab.active { color: var(--text); border-bottom-color: var(--primary); font-weight: 600; }
    .panel { flex: 1; padding: 16px; overflow-y: auto; display: none; }
    .panel.active { display: block; }
    .timeline-footer { background: var(--panel-bg); border-top: 1px solid var(--border); padding: 16px 24px; display: flex; flex-direction: column; gap: 12px; }
    .timeline-controls { display: flex; align-items: center; justify-content: space-between; }
    .controls-left { display: flex; gap: 8px; align-items: center; }
    .timecode { font-family: monospace; font-size: 1rem; color: #a5b4fc; }
    .scrubber-slider { width: 100%; -webkit-appearance: none; height: 6px; border-radius: 3px; background: var(--border); outline: none; cursor: pointer; }
    .scrubber-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 5px; background: var(--primary); cursor: pointer; }
    .item-card { background: #212536; border: 1px solid var(--border); border-radius: 6px; padding: 12px; margin-bottom: 10px; }
    .item-card h4 { font-size: 0.9rem; margin-bottom: 6px; }
    .field-row { display: flex; gap: 8px; margin-top: 6px; align-items: center; }
    .field-row label { font-size: 0.75rem; color: var(--text-muted); width: 70px; }
    .field-row input { flex: 1; background: #13151f; border: 1px solid var(--border); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
    .toggle-row { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); font-size: 0.85rem; }
  </style>
</head>
<body>
  <header>
    <div class="header-title">
      <span>ACC Studio Preview</span>
      <span class="badge" id="badgePipeline">${doc.meta.contentId}</span>
      <span class="badge" style="background:#064e3b;color:#6ee7b7;">${doc.meta.canvasSize.w}x${doc.meta.canvasSize.h} @ ${doc.meta.globalFps}fps</span>
    </div>
    <div class="header-actions">
      <button id="btnUndo" onclick="undoPatch()">Undo</button>
      <button id="btnRedo" onclick="redoPatch()">Redo</button>
      <button class="primary" id="btnExport" onclick="dispatchExport()">Deterministic Export</button>
    </div>
  </header>

  <div class="main-view">
    <div class="viewport">
      <canvas id="studioCanvas" width="${doc.meta.canvasSize.w}" height="${doc.meta.canvasSize.h}"></canvas>
    </div>
    <div class="sidebar">
      <div class="tabs">
        <div class="tab active" onclick="switchTab('clips')">Clips & Text</div>
        <div class="tab" onclick="switchTab('modifiers')">VFX Modifiers</div>
        <div class="tab" onclick="switchTab('patch')">JSON Patch</div>
      </div>
      <div class="panel active" id="panelClips">
        <div id="clipsContainer"></div>
      </div>
      <div class="panel" id="panelModifiers">
        <div id="modifiersContainer"></div>
      </div>
      <div class="panel" id="panelPatch">
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">Live RFC 6902 Patch Log:</div>
        <pre id="patchAuditLog" style="background:#13151f; padding:10px; border-radius:6px; font-size:0.75rem; color:#86efac; overflow:auto; max-height:400px;"></pre>
      </div>
    </div>
  </div>

  <div class="timeline-footer">
    <input type="range" class="scrubber-slider" id="scrubber" min="0" max="${playhead.totalFrames - 1}" value="${playhead.currentFrame}" oninput="onScrub(this.value)">
    <div class="timeline-controls">
      <div class="controls-left">
        <button onclick="step(-1)">❮ Step</button>
        <button id="btnPlay" onclick="togglePlay()">▶ Play</button>
        <button onclick="step(1)">Step ❯</button>
      </div>
      <div class="timecode" id="timecodeDisplay">Frame: ${playhead.currentFrame} / ${playhead.totalFrames} (${playhead.currentTime.toFixed(2)}s)</div>
    </div>
  </div>

  <script>
    let state = {
      currentFrame: ${playhead.currentFrame},
      totalFrames: ${playhead.totalFrames},
      fps: ${playhead.fps},
      isPlaying: false,
      canvasSize: { w: ${doc.meta.canvasSize.w}, h: ${doc.meta.canvasSize.h} },
      activeClips: [],
      activeTextCues: [],
      activeModifiers: [],
      document: ${JSON.stringify(doc)}
    };

    const canvas = document.getElementById('studioCanvas');
    const ctx = canvas.getContext('2d');

    function switchTab(tabId) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      if (tabId === 'clips') {
        document.querySelector('.tabs .tab:nth-child(1)').classList.add('active');
        document.getElementById('panelClips').classList.add('active');
      } else if (tabId === 'modifiers') {
        document.querySelector('.tabs .tab:nth-child(2)').classList.add('active');
        document.getElementById('panelModifiers').classList.add('active');
      } else {
        document.querySelector('.tabs .tab:nth-child(3)').classList.add('active');
        document.getElementById('panelPatch').classList.add('active');
      }
    }

    async function fetchTimeline() {
      const res = await fetch('/api/timeline');
      const data = await res.json();
      state.document = data.document;
      state.totalFrames = data.playhead.totalFrames;
      state.fps = data.playhead.fps;
      document.getElementById('scrubber').max = state.totalFrames - 1;
      updateUI(data.preview);
    }

    async function onScrub(frame) {
      state.currentFrame = parseInt(frame, 10);
      const res = await fetch('/api/scrub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame: state.currentFrame })
      });
      const data = await res.json();
      updateUI(data.preview);
    }

    function step(delta) {
      const nextFrame = Math.max(0, Math.min(state.totalFrames - 1, state.currentFrame + delta));
      document.getElementById('scrubber').value = nextFrame;
      onScrub(nextFrame);
    }

    let playInterval = null;
    function togglePlay() {
      state.isPlaying = !state.isPlaying;
      document.getElementById('btnPlay').innerText = state.isPlaying ? '❚❚ Pause' : '▶ Play';
      if (state.isPlaying) {
        playInterval = setInterval(() => {
          let next = state.currentFrame + 1;
          if (next >= state.totalFrames) next = 0;
          document.getElementById('scrubber').value = next;
          onScrub(next);
        }, 1000 / state.fps);
      } else {
        clearInterval(playInterval);
      }
    }

    function updateUI(preview) {
      if (!preview) return;
      state.activeClips = preview.activeClips;
      state.activeTextCues = preview.activeTextCues;
      state.activeModifiers = preview.activeModifiers;

      document.getElementById('timecodeDisplay').innerText = 
        'Frame: ' + preview.frame + ' / ' + preview.totalFrames + ' (' + preview.timeSeconds.toFixed(2) + 's)';

      renderCanvas(preview);
      renderSidebar();
    }

    function renderCanvas(preview) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Draw subtle background grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Draw active modifier badges / VFX simulation
      if (preview.activeModifiers.length > 0) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
        ctx.fillRect(20, 20, w - 40, h - 40);
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, w - 40, h - 40);

        ctx.fillStyle = '#818cf8';
        ctx.font = 'bold 16px sans-serif';
        const modNames = preview.activeModifiers.map(m => m.type).join(', ');
        ctx.fillText('Active VFX: ' + modNames, 35, 50);
      }

      // Draw Active Text Cues
      if (preview.activeTextCues.length > 0) {
        for (let i = 0; i < preview.activeTextCues.length; i++) {
          const cue = preview.activeTextCues[i];
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 36px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(cue.text, w / 2, h / 2 + (i * 45));
        }
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = 'italic 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('[No active text cues at frame ' + preview.frame + ']', w / 2, h / 2);
      }
    }

    function renderSidebar() {
      // Clips panel
      const clipsContainer = document.getElementById('clipsContainer');
      clipsContainer.innerHTML = '';
      state.activeClips.forEach(clip => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = '<h4>Clip: ' + clip.sequenceId + ' (' + clip.trackType + ')</h4>' +
          '<div class="field-row"><label>Frames:</label><span style="font-size:0.8rem; color:#93c5fd">' + clip.startFrame + ' -> ' + clip.endFrame + ' (' + clip.durationFrames + 'f)</span></div>';
        
        clip.activeCues.forEach((cue, cIdx) => {
          card.innerHTML += '<div class="field-row"><label>Text:</label><input value="' + cue.text + '" onchange="updateCueText(\x27' + clip.trackId + '\x27, \x27' + clip.sequenceId + '\x27, ' + cIdx + ', this.value)"></div>';
        });
        clipsContainer.appendChild(card);
      });

      // Modifiers panel
      const modContainer = document.getElementById('modifiersContainer');
      modContainer.innerHTML = '';
      ['depth_3d', 'canvas_particle_overlay', 'lut_filter'].forEach(modType => {
        const isActive = state.activeModifiers.some(m => m.type === modType);
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = '<div class="toggle-row"><span>' + modType + '</span><input type="checkbox" ' + (isActive ? 'checked' : '') + ' onchange="toggleModifier(\x27' + modType + '\x27, this.checked)"></div>';
        modContainer.appendChild(card);
      });
    }

    async function updateCueText(trackId, seqId, cueIdx, newText) {
      const trackIndex = state.document.tracks.findIndex(t => t.id === trackId);
      const seqIndex = state.document.tracks[trackIndex].sequences.findIndex(s => s.id === seqId);
      const patch = [{
        op: 'replace',
        path: '/tracks/' + trackIndex + '/sequences/' + seqIndex + '/cues/' + cueIdx + '/text',
        value: newText
      }];
      applyPatchOps(patch);
    }

    async function toggleModifier(modType, enable) {
      if (state.activeClips.length === 0) return;
      const clip = state.activeClips[0];
      const trackIndex = state.document.tracks.findIndex(t => t.id === clip.trackId);
      const seqIndex = state.document.tracks[trackIndex].sequences.findIndex(s => s.id === clip.sequenceId);
      const patch = enable
        ? [{ op: 'add', path: '/tracks/' + trackIndex + '/sequences/' + seqIndex + '/modifiers', value: [{ type: modType, params: {} }] }]
        : [{ op: 'remove', path: '/tracks/' + trackIndex + '/sequences/' + seqIndex + '/modifiers/0' }];
      applyPatchOps(patch);
    }

    async function applyPatchOps(ops) {
      const res = await fetch('/api/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ops })
      });
      const data = await res.json();
      state.document = data.document;
      document.getElementById('patchAuditLog').innerText = JSON.stringify(ops, null, 2);
      updateUI(data.preview);
    }

    async function undoPatch() {
      const res = await fetch('/api/undo', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        state.document = data.document;
        updateUI(data.preview);
      }
    }

    async function redoPatch() {
      const res = await fetch('/api/redo', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        state.document = data.document;
        updateUI(data.preview);
      }
    }

    async function dispatchExport() {
      const btn = document.getElementById('btnExport');
      btn.innerText = 'Rendering...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun: false })
        });
        const data = await res.json();
        if (data.success) {
          alert('✓ Render exported successfully! Path: ' + data.outputPath);
        } else {
          alert('❌ Render failed: ' + (data.error || 'Unknown error'));
        }
      } finally {
        btn.innerText = 'Deterministic Export';
        btn.disabled = false;
      }
    }

    // Init on load
    fetchTimeline();
  </script>
</body>
</html>`;
  }
}
