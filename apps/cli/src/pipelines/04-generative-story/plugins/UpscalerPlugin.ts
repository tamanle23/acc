import fs from 'fs';
import path from 'path';
import { IPlugin, RenderContext, Logger, Utils, fileExists } from '@acc/core';
import { checkAndDownloadUpscaler, upscaleImage } from '../upscaler';


export class UpscalerPlugin implements IPlugin {
  name = 'AI-Upscaler';

  async execute(context: RenderContext): Promise<RenderContext> {
    const { config, assets, baseDir } = context;
    const upscale = config.settings.upscale;

    if (!upscale?.enabled) {
      return context;
    }

    const modelName = upscale.model || 'realesrgan-x4plus';
    Logger.info(this.name, `AI Auto-Upscale is enabled. Checking dependencies for ${modelName}...`);
    
    try {
      await checkAndDownloadUpscaler(modelName);
    } catch (err: any) {
      Logger.warn(this.name, `Failed to initialize upscaler dependencies: ${err.message}. Skipping upscaling.`);
      return context;
    }

    const cacheDir = path.join(baseDir, '.cache');
    if (!(await fileExists(cacheDir))) {
      await fs.promises.mkdir(cacheDir, { recursive: true });
    }

    const totalScenes = config.scenes.length;

    // Process scenes sequentially or limit concurrency to avoid overwhelming memory
    for (let i = 0; i < totalScenes; i++) {
      const scene = config.scenes[i];
      // Get the best current image (could be original or already modified by previous plugin)
      const currentImagePath = assets.getPreferred(`scene_${i}`, ['image:original']);
      const sourceImage = currentImagePath || scene.resolvedImage;

      if (sourceImage && (await fileExists(sourceImage))) {
        const ext = path.extname(sourceImage);
        const baseName = path.basename(sourceImage, ext);
        const checksum = await Utils.getFileChecksum(sourceImage);
        const upscaledFilename = `upscaled_${baseName}_${checksum}_${modelName}${ext}`;
        const upscaledPath = path.join(cacheDir, upscaledFilename);

        try {
          if (await fileExists(upscaledPath)) {
            Logger.info(this.name, `[Scene ${i + 1}/${totalScenes}] Using cached upscaled image: ${upscaledFilename}`);
            assets.register(`scene_${i}`, 'image:upscaled', upscaledPath);
          } else {
            Logger.info(this.name, `[Scene ${i + 1}/${totalScenes}] Upscaling using ${modelName}...`);
            await upscaleImage(sourceImage, upscaledPath, modelName);
            Logger.info(this.name, `[Scene ${i + 1}/${totalScenes}] Upscaling complete.`);
            assets.register(`scene_${i}`, 'image:upscaled', upscaledPath);
          }
        } catch (err: any) {
          Logger.warn(this.name, `[Scene ${i + 1}/${totalScenes}] Upscaling failed: ${err.message}. Falling back to original image.`);
          // Do not register the upscaled asset, pipeline will naturally fallback to original.
        }
      }
    }

    return context;
  }
}
