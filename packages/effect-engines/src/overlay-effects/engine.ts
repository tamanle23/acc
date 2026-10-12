import { RegistryManager, fileExists } from '@acc/core';
import path from 'path';
import { BaseEffectEngine } from '@acc/core';
import { pathToFileURL } from 'url';
import fs from 'fs';

export interface RenderLayerOptions {
  fps?: number;
  width?: number;
  height?: number;
}

export async function renderEffectLayer(
  registry: RegistryManager, 
  effectName: string, 
  variantName: string, 
  duration: number, 
  outDir: string,
  options?: RenderLayerOptions
): Promise<string> {
  registry.validate(effectName, variantName);

  const effectConfig = registry.getEffectConfig(effectName);
  const pipelineConfig = registry.getPipelineConfig(effectConfig.pipeline);
  
  // ⚡ Bolt: Replaced synchronous fs.existsSync and fs.mkdirSync with async fileExists and fs.promises.mkdir
  // Why: Prevents blocking the Node.js event loop during overlay effect generation, increasing overall concurrency and throughput.
  if (!await fileExists(outDir)) {
    await fs.promises.mkdir(outDir, { recursive: true });
  }

  const outputPath = path.join(outDir, `${effectName}_${variantName}_${duration}s.${pipelineConfig.format}`);
  const metadataPath = path.join(outDir, `${effectName}_${variantName}_${duration}s.json`);

  const width = options?.width || 1920;
  const height = options?.height || 1080;
  const fps = options?.fps || 30;

  // Helper to write companion metadata JSON
  const writeMetadataJson = async () => {
    const isWebm = pipelineConfig.format === 'webm';
    const bg = typeof pipelineConfig.background === 'string'
      ? { type: pipelineConfig.background === 'transparent' ? 'transparent' : 'solid', color: pipelineConfig.background === 'transparent' ? 'rgba(0,0,0,0)' : '#000000' }
      : pipelineConfig.background;

    const metadata = {
      effect: effectName,
      variant: variantName,
      pipeline: effectConfig.pipeline,
      overlay_method: pipelineConfig.overlay_method || (isWebm ? 'alpha' : 'screen'),
      background: bg,
      recommended_blend_mode: pipelineConfig.blend_mode_recommended || (isWebm ? 'normal' : 'screen'),
      ffmpeg_input_options: isWebm ? ['-c:v', 'libvpx-vp9'] : [],
      ffmpeg_filter_snippet: pipelineConfig.ffmpeg_filter_snippet || (isWebm ? 'overlay=shortest=1' : 'blend=all_mode=screen:all_opacity=1:shortest=1'),
      resolution: {
        width,
        height
      },
      fps,
      duration,
      format: pipelineConfig.format,
      video_file: path.basename(outputPath)
    };

    // ⚡ Bolt: Replaced synchronous fs.writeFileSync with async fs.promises.writeFile
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  };

  // Skip generation if both video and metadata exist (caching for speed)
  // ⚡ Bolt: Replaced synchronous fs.existsSync with async fileExists
  if (await fileExists(outputPath) && await fileExists(metadataPath)) {
    return outputPath;
  }

  const modulePath = path.resolve(process.cwd(), effectConfig.module_path);
  const url = pathToFileURL(modulePath).href;
  
  let module;
  try {
    module = await import(url);
  } catch (e: any) {
    throw new Error(`Failed to dynamically import module at ${modulePath}. Ensure the file exists. Error: ${e.message}`);
  }
  
  const ExportedClass = Object.values(module).find(
    (val: any) => typeof val === 'function' && val.prototype instanceof BaseEffectEngine
  ) as any;

  if (!ExportedClass) {
    throw new Error(`Module at ${effectConfig.module_path} does not export a class extending BaseEffectEngine.`);
  }

  const engine: BaseEffectEngine = new ExportedClass(variantName, duration, pipelineConfig);
  if (options) {
    if (options.fps) engine.setFps(options.fps);
    if (options.width && options.height) engine.setDimensions(options.width, options.height);
  }

  await engine.renderAndPipe(outputPath);
  await writeMetadataJson();
  
  return outputPath;
}
