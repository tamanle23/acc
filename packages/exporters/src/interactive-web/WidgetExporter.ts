import fs from 'fs';
import path from 'path';
import { fileExists } from '@acc/core';
import type { ExtendedPipelineIR } from '@acc/ir';

export interface WidgetExporterOptions {
  outputDir: string;
  widgetTitle?: string;
  autostart?: boolean;
}

export class WidgetExporter {
  public static async exportInteractiveWidget(ir: ExtendedPipelineIR, options: WidgetExporterOptions): Promise<{ htmlPath: string; jsonPath: string }> {
    if (!(await fileExists(options.outputDir))) {
      await fs.promises.mkdir(options.outputDir, { recursive: true });
    }

    const jsonPath = path.join(options.outputDir, 'interactive-tree.json');
    const htmlPath = path.join(options.outputDir, 'index.html');

    const treeData = {
      title: ir.metadata.title,
      jobId: ir.metadata.jobId,
      resolution: ir.settings.resolution,
      nodes: ir.extendedChunks.map(chunk => ({
        id: chunk.id,
        durationMs: chunk.durationMs,
        text: chunk.text,
        videoUrl: `media/${chunk.id}.mp4`,
        choices: ir.interactiveNodes?.find(n => n.timestampMs === chunk.durationMs)?.options || [],
      })),
    };

    await fs.promises.writeFile(jsonPath, JSON.stringify(treeData, null, 2), 'utf-8');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ir.metadata.title} - Interactive Video</title>
  <style>
    body { margin: 0; background: #0f0f12; color: #fff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .player-card { width: ${ir.settings.resolution.width > ir.settings.resolution.height ? '960px' : '400px'}; height: ${ir.settings.resolution.width > ir.settings.resolution.height ? '540px' : '711px'}; position: relative; background: #000; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
    video { width: 100%; height: 100%; object-fit: cover; }
    .choices-overlay { position: absolute; bottom: 30px; left: 0; right: 0; display: flex; flex-direction: column; gap: 12px; padding: 0 24px; z-index: 10; }
    .choice-btn { background: rgba(0, 255, 255, 0.2); border: 2px solid #00ffff; color: #fff; padding: 14px 20px; min-height: 44px; border-radius: 30px; backdrop-filter: blur(10px); font-weight: bold; cursor: pointer; transition: transform 0.2s, background 0.2s, outline 0.2s; }
    .choice-btn:hover { background: rgba(0, 255, 255, 0.5); transform: scale(1.03); }
    .choice-btn:focus-visible { outline: 3px solid #00ffff; outline-offset: 3px; background: rgba(0, 255, 255, 0.4); }
  </style>
</head>
<body>
  <div class="player-card">
    <video id="activeVideo" playsinline aria-label="${ir.metadata.title || 'Interactive Video'}" ${options.autostart ? 'autoplay' : ''}></video>
    <div id="choicesOverlay" class="choices-overlay" role="region" aria-label="Interactive branching choices" aria-live="polite" style="display:none;"></div>
  </div>
  <script>
    const tree = ${JSON.stringify(treeData)};
    let currentNode = tree.nodes[0];
    const video = document.getElementById('activeVideo');
    const overlay = document.getElementById('choicesOverlay');

    function playNode(node) {
      currentNode = node;
      overlay.style.display = 'none';
      video.src = node.videoUrl;
      video.play().catch(() => {});
    }

    video.addEventListener('ended', () => {
      if (currentNode && currentNode.choices && currentNode.choices.length > 0) {
        overlay.innerHTML = '';
        currentNode.choices.forEach(c => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'choice-btn';
          btn.innerText = c.label;
          btn.setAttribute('aria-label', c.label);
          btn.onclick = () => {
            const nextNode = tree.nodes.find(n => n.id === c.targetChunkId);
            if (nextNode) playNode(nextNode);
          };
          overlay.appendChild(btn);
        });
        overlay.style.display = 'flex';
        const firstBtn = overlay.querySelector('button');
        if (firstBtn) firstBtn.focus();
      }
    });

    if (currentNode) playNode(currentNode);
  </script>
</body>
</html>`;

    await fs.promises.writeFile(htmlPath, htmlContent, 'utf-8');

    return { htmlPath, jsonPath };
  }
}
