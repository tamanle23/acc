import { Logger } from "@acc/core";
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import os from 'os';
import extractZip from 'extract-zip';

const UPSCALER_RELEASES = {
  win32: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip',
  linux: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip',
  darwin: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip'
};

export const CUSTOM_MODEL_URLS: Record<string, { param: string, bin: string }> = {
  '4x-UltraSharp': {
    param: 'https://huggingface.co/Kim2091/UltraSharp/resolve/main/NCNN/4x-UltraSharp-fp32.param',
    bin: 'https://huggingface.co/Kim2091/UltraSharp/resolve/main/NCNN/4x-UltraSharp-fp32.bin'
  }
};

// ⚡ Bolt: helper to avoid synchronous fs.existsSync blocking the event loop
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function getUpscalerBinaryPath(): string {
  // Dùng thư mục home của User để an toàn cho cả bản dev và bản compile/distribution
  const appDir = path.join(os.homedir(), '.acc');
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(appDir, 'bin', 'upscaler', `realesrgan-ncnn-vulkan${ext}`);
}

export function getModelsPath(): string {
  const appDir = path.join(os.homedir(), '.acc');
  return path.join(appDir, 'bin', 'upscaler', 'models');
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

  const buffer = await response.arrayBuffer();
  // ⚡ Bolt: Replace fs.writeFileSync with async fs.promises.writeFile
  await fs.promises.writeFile(dest, Buffer.from(buffer));
}

export async function checkAndDownloadUpscaler(requestedModel?: string): Promise<void> {
  const binaryPath = getUpscalerBinaryPath();
  const upscalerDir = path.dirname(binaryPath);
  const modelsPath = getModelsPath();

  // ⚡ Bolt: Replace fs.existsSync and fs.mkdirSync with async versions
  if (!(await fileExists(upscalerDir))) {
    await fs.promises.mkdir(upscalerDir, { recursive: true });
  }

  if (!(await fileExists(modelsPath))) {
    await fs.promises.mkdir(modelsPath, { recursive: true });
  }

  if (!(await fileExists(binaryPath))) {
    Logger.info('Upscaler', `Binary not found. Starting automated download for ${process.platform}...`);
    const zipUrl = (UPSCALER_RELEASES as any)[process.platform] || UPSCALER_RELEASES.linux;
    const tempZipPath = path.join(os.tmpdir(), `realesrgan_${Date.now()}.zip`);

    try {
      Logger.info('Upscaler', 'Downloading Real-ESRGAN engine (~15MB) from GitHub...');
      await downloadFile(zipUrl, tempZipPath);

      Logger.info('Upscaler', 'Extracting engine...');
      await extractZip(tempZipPath, { dir: upscalerDir });
      // ⚡ Bolt: Replace fs.unlinkSync with async fs.promises.unlink
      await fs.promises.unlink(tempZipPath);

      if (process.platform !== 'win32') {
        // ⚡ Bolt: Replace fs.chmodSync with async fs.promises.chmod
        await fs.promises.chmod(binaryPath, '755');
      }
      Logger.info('Upscaler', 'Engine successfully installed!');
    } catch (e: any) {
      Logger.error('Upscaler', `Automated download failed: ${e.message}`);
      throw new Error(`Failed to download Real-ESRGAN automatically. Please download it manually from ${zipUrl}`);
    }
  }

  // Sync custom models packaged with the CLI
  const localModelsDir = path.join(__dirname, '..', 'custom-models');
  if (await fileExists(localModelsDir)) {
    // ⚡ Bolt: Replace fs.readdirSync with async fs.promises.readdir
    const files = await fs.promises.readdir(localModelsDir);
    let copiedAny = false;
    for (const file of files) {
      if (file.endsWith('.param') || file.endsWith('.bin')) {
        const src = path.join(localModelsDir, file);
        const dest = path.join(modelsPath, file);
        if (!(await fileExists(dest))) {
          // ⚡ Bolt: Replace fs.copyFileSync with async fs.promises.copyFile
          await fs.promises.copyFile(src, dest);
          copiedAny = true;
          Logger.info('Upscaler', `Auto-installing custom model from local: ${file}`);
        }
      }
    }
    if (copiedAny) {
      Logger.info('Upscaler', 'CLI custom models installed successfully!');
    }
  }

  // Download custom model from URL if requested and missing
  if (requestedModel && CUSTOM_MODEL_URLS[requestedModel]) {
    const paramDest = path.join(modelsPath, `${requestedModel}.param`);
    const binDest = path.join(modelsPath, `${requestedModel}.bin`);

    if (!(await fileExists(paramDest)) || !(await fileExists(binDest))) {
      Logger.info('Upscaler', `Model ${requestedModel} not available locally. Downloading from Cloud...`);
      const urls = CUSTOM_MODEL_URLS[requestedModel];
      try {
        await downloadFile(urls.param, paramDest);
        Logger.info('Upscaler', 'Downloaded .param file');
        await downloadFile(urls.bin, binDest);
        Logger.info('Upscaler', 'Downloaded .bin file');
        Logger.info('Upscaler', `Model ${requestedModel} installed successfully!`);
      } catch (e: any) {
        Logger.error('Upscaler', `Error downloading model ${requestedModel}: ${e.message}`);
        // Xóa file rác nếu tải lỗi
        // ⚡ Bolt: Replace fs.existsSync and fs.unlinkSync with async versions
        if (await fileExists(paramDest)) await fs.promises.unlink(paramDest);
        if (await fileExists(binDest)) await fs.promises.unlink(binDest);
      }
    }
  }
}

import crypto from 'crypto';

export async function upscaleImage(
  inputPath: string,
  outputPath: string,
  modelName: string = 'realesrgan-x4plus',
  ratio: number = 2
): Promise<void> {
  const binaryPath = getUpscalerBinaryPath();
  const modelsDir = getModelsPath();

  // Sửa lỗi CLI C++ không nhận diện Unicode path trên Windows
  const hasUnicode = /[^\x00-\x7F]/.test(inputPath) || /[^\x00-\x7F]/.test(outputPath) || inputPath.includes(' ') || outputPath.includes(' ');
  let runInput = inputPath;
  let runOutput = outputPath;

  if (hasUnicode) {
    const hash = crypto.randomBytes(8).toString('hex');
    runInput = path.join(os.tmpdir(), `upscaler_in_${hash}${path.extname(inputPath)}`);
    runOutput = path.join(os.tmpdir(), `upscaler_out_${hash}${path.extname(outputPath)}`);
    // ⚡ Bolt: Replace fs.copyFileSync with async fs.promises.copyFile
    await fs.promises.copyFile(inputPath, runInput);
  }

  const args = [
    '-i', runInput,
    '-o', runOutput,
    '-n', modelName,
    '-s', `${ratio}`,
  ];
  const customModelPath = path.join(modelsDir, `${modelName}.param`);
  if (await fileExists(customModelPath)) {
    args.push('-m', modelsDir);
  }

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(binaryPath, args, (error, stdout, stderr) => {
        if (error) {
          Logger.error('Upscaler', `Failed to upscale ${inputPath}`);
          Logger.error('Upscaler', stderr);
          return reject(error);
        }
        resolve();
      });
    });
  } catch (error) {
    if (hasUnicode) {
      // ⚡ Bolt: Replace fs.unlinkSync with async fs.promises.unlink
      try { await fs.promises.unlink(runInput); } catch (e) { }
      try { await fs.promises.unlink(runOutput); } catch (e) { }
    }
    throw error;
  }

  if (hasUnicode) {
    try {
      // ⚡ Bolt: Replace fs.copyFileSync with async fs.promises.copyFile
      await fs.promises.copyFile(runOutput, outputPath);
    } finally {
      // ⚡ Bolt: Replace fs.unlinkSync with async fs.promises.unlink
      try { await fs.promises.unlink(runInput); } catch (e) { }
      try { await fs.promises.unlink(runOutput); } catch (e) { }
    }
  }
}
