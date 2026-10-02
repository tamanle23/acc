import path from 'path';
import fs from 'fs';
import os from 'os';
import https from 'https';
import { execSync } from 'child_process';
import extractZip from 'extract-zip';

export class FFmpegManager {
  private static ffmpegPath: string | null = null;
  private static ffprobePath: string | null = null;
  private static binDirPath: string | null = null;

  public static getFFmpegPath(): string {
    if (!this.ffmpegPath) throw new Error('FFmpegManager.prepare() must be called before getFFmpegPath()');
    return this.ffmpegPath;
  }

  public static getFFprobePath(): string {
    if (!this.ffprobePath) throw new Error('FFmpegManager.prepare() must be called before getFFprobePath()');
    return this.ffprobePath;
  }

  public static getBinDir(): string {
    if (!this.binDirPath) throw new Error('FFmpegManager.prepare() must be called before getBinDir()');
    return this.binDirPath;
  }

  public static setBinDir(binDir: string): void {
    this.binDirPath = binDir;
    this.ffmpegPath = path.join(binDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    this.ffprobePath = path.join(binDir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
  }

  private static findBinaries(dir: string): { ffmpeg: string | null, ffprobe: string | null, binDir: string | null } {
    let ffmpeg = null;
    let ffprobe = null;
    let binDir = null;

    if (!fs.existsSync(dir)) return { ffmpeg, ffprobe, binDir };

    const search = (currentDir: string) => {
      const files = fs.readdirSync(currentDir);
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          search(fullPath);
        } else {
          const name = file.toLowerCase();
          if (name === 'ffmpeg.exe' || name === 'ffmpeg') {
            ffmpeg = fullPath;
            binDir = currentDir;
          }
          if (name === 'ffprobe.exe' || name === 'ffprobe') ffprobe = fullPath;
        }
      }
    };

    search(dir);
    return { ffmpeg, ffprobe, binDir };
  }

  public static async prepare(): Promise<void> {
    if (this.ffmpegPath) return; // Already prepared

    console.log('[FFmpegManager] Checking FFmpeg installation...');
    const platform = process.platform;
    const appDir = path.join(os.homedir(), '.acc');
    const targetDir = path.join(appDir, 'bin', 'ffmpeg-shared');

    // 1. Check Local Shared Fallback Installation first (since we now REQUIRE shared libs for FFI)
    const existingBins = this.findBinaries(targetDir);
    if (existingBins.ffmpeg && existingBins.ffprobe && existingBins.binDir) {
      console.log('[FFmpegManager] Found local shared FFmpeg build.');
      this.ffmpegPath = existingBins.ffmpeg;
      this.ffprobePath = existingBins.ffprobe;
      this.binDirPath = existingBins.binDir;
      return;
    }

    // 2. MacOS / Linux system-wide FFmpeg check
    if (platform !== 'win32') {
      try {
        const sysFfmpeg = execSync('which ffmpeg', { encoding: 'utf-8' }).trim();
        const sysFfprobe = execSync('which ffprobe', { encoding: 'utf-8' }).trim();
        if (sysFfmpeg && sysFfprobe && fs.existsSync(sysFfmpeg)) {
          console.log('[FFmpegManager] Found system FFmpeg installation.');
          this.ffmpegPath = sysFfmpeg;
          this.ffprobePath = sysFfprobe;
          this.binDirPath = path.dirname(sysFfmpeg);
          return;
        }
      } catch {}

      console.warn('\n⚠️ [WARN] Shared FFmpeg libraries missing or not found in system PATH.');
      throw new Error('Shared FFmpeg libraries missing');
    }

    // 3. Windows Auto-Download (GPL NVENC SHARED Build from BtbN)
    console.log('\n[FFmpegManager] Shared FFmpeg not found. Automatically downloading full GPU-enabled Shared Windows build...');
    const url = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip';

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const tempZipPath = path.join(os.tmpdir(), `ffmpeg_shared_${Date.now()}.zip`);

    await new Promise<void>((resolve, reject) => {
      let downloadedBytes = 0;
      let totalBytes = 0;

      const request = https.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          https.get(response.headers.location!, (redirectResponse) => {
            totalBytes = parseInt(redirectResponse.headers['content-length'] || '0', 10);
            const file = fs.createWriteStream(tempZipPath);
            redirectResponse.pipe(file);

            redirectResponse.on('data', (chunk) => {
              downloadedBytes += chunk.length;
              const percent = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
              process.stdout.write(`\rDownloading FFmpeg Shared... ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)}MB)`);
            });

            file.on('finish', () => {
              console.log('\nDownload complete.');
              file.close();
              resolve();
            });
          }).on('error', reject);
        }
      });
      request.on('error', reject);
    });

    console.log('[FFmpegManager] Extracting zip archive... (This may take a minute)');
    try {
      await extractZip(tempZipPath, { dir: targetDir });
      fs.unlinkSync(tempZipPath);
    } catch (e: any) {
      console.error(`\n❌ [ERROR] Failed to extract FFmpeg zip: ${e.message}`);
      throw e;
    }

    const downloadedBins = this.findBinaries(targetDir);
    if (!downloadedBins.ffmpeg || !downloadedBins.ffprobe || !downloadedBins.binDir) {
      throw new Error('Extraction succeeded but ffmpeg.exe or bin folder was not found inside the zip structure.');
    }

    this.ffmpegPath = downloadedBins.ffmpeg;
    this.ffprobePath = downloadedBins.ffprobe;
    this.binDirPath = downloadedBins.binDir;

    console.log(`[FFmpegManager] Successfully installed local Shared FFmpeg at: ${this.binDirPath}`);
  }
}
