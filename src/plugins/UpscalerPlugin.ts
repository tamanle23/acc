import fs from 'fs';
import path from 'path';
import { IPlugin, RenderContext } from '../core/IPlugin';
import { Logger } from '../core/logger';
import { checkAndDownloadUpscaler, upscaleImage } from '../upscaler';

function getFileChecksum(filePath: string): string {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const crypto = require('crypto');
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex').substring(0, 8);
  } catch (e) {
    return Date.now().toString();
  }
}

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
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const totalScenes = config.scenes.length;

    // Process scenes sequentially or limit concurrency to avoid overwhelming memory
    for (let i = 0; i < totalScenes; i++) {
      const scene = config.scenes[i];
      // Get the best current image (could be original or already modified by previous plugin)
      const currentImagePath = assets.getPreferred(`scene_${i}`, ['image:original']);
      const sourceImage = currentImagePath || scene.resolvedImage;

      if (sourceImage && fs.existsSync(sourceImage)) {
        const ext = path.extname(sourceImage);
        const baseName = path.basename(sourceImage, ext);
        const checksum = getFileChecksum(sourceImage);
        const upscaledFilename = `upscaled_${baseName}_${checksum}_${modelName}${ext}`;
        const upscaledPath = path.join(cacheDir, upscaledFilename);

        try {
          if (fs.existsSync(upscaledPath)) {
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
