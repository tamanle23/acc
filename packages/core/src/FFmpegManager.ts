import path from 'path';
import fs from 'fs';
import os from 'os';
import https from 'https';
import { execSync } from 'child_process';
import extractZip from 'extract-zip';
import { UniversalLogger as Logger } from '@acc/core-isomorphic';

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
    if (!this.binDirPath) {
      // Auto-probe local shared build if already present
      const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
      const appDir = path.join(home, '.acc');
      const targetDir = path.join(appDir, 'bin', 'ffmpeg-shared');
      const existing = this.findBinaries(targetDir);
      if (existing.binDir && existing.ffmpeg && existing.ffprobe) {
        this.binDirPath = existing.binDir;
        this.ffmpegPath = existing.ffmpeg;
        this.ffprobePath = existing.ffprobe;
        return this.binDirPath;
      }
      throw new Error('FFmpegManager.prepare() must be called before getBinDir()');
    }
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

    Logger.info('FFmpegManager', 'Checking FFmpeg installation...');
    const platform = process.platform;
    const arch = os.arch();
    const appDir = path.join(os.homedir(), '.acc');
    const targetDir = path.join(appDir, 'bin', 'ffmpeg-shared');

    // 1. Check Local Shared Fallback Installation first (strictly complying with GLOBAL-STORAGE)
    const existingBins = this.findBinaries(targetDir);
    if (existingBins.ffmpeg && existingBins.ffprobe && existingBins.binDir) {
      Logger.info('FFmpegManager', 'Found local shared FFmpeg build.');
      this.ffmpegPath = existingBins.ffmpeg;
      this.ffprobePath = existingBins.ffprobe;
      this.binDirPath = existingBins.binDir;
      return;
    }

    // 2. System-wide FFmpeg check
    try {
      const sysFfmpeg = execSync('which ffmpeg', { encoding: 'utf-8' }).trim();
      const sysFfprobe = execSync('which ffprobe', { encoding: 'utf-8' }).trim();
      if (sysFfmpeg && sysFfprobe && fs.existsSync(sysFfmpeg) && fs.existsSync(sysFfprobe)) {
        Logger.info('FFmpegManager', `Found system FFmpeg installation at ${sysFfmpeg}`);
        this.ffmpegPath = sysFfmpeg;
        this.ffprobePath = sysFfprobe;
        this.binDirPath = path.dirname(sysFfmpeg);
        return;
      }
    } catch {}

    // 3. Universal Precompiled Download into ~/.acc/bin/ffmpeg-shared/
    Logger.info('FFmpegManager', `Auto-downloading precompiled FFmpeg build for ${platform}-${arch} into ${targetDir}...`);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let downloadUrl: string;
    let isZip = true;

    if (platform === 'win32') {
      downloadUrl = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip';
      isZip = true;
    } else if (platform === 'darwin') {
      // Shared build tarball for macOS
      downloadUrl = arch === 'arm64'
        ? 'https://github.com/GyanD/codexff/releases/download/builds/ffmpeg-latest-macos-arm64-shared.zip'
        : 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-macos-x64-gpl.zip';
      isZip = true;
    } else {
      // Linux shared build
      downloadUrl = arch === 'arm64'
        ? 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linuxarm64-gpl-shared.tar.xz'
        : 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl-shared.tar.xz';
      isZip = false;
    }

    const archiveExt = isZip ? 'zip' : 'tar.xz';
    const tempArchivePath = path.join(os.tmpdir(), `ffmpeg_${platform}_${arch}_${Date.now()}.${archiveExt}`);

    try {
      await this.downloadFile(downloadUrl, tempArchivePath);

      Logger.info('FFmpegManager', 'Extracting archive to ~/.acc/bin/ffmpeg-shared/ ...');
      if (isZip) {
        await extractZip(tempArchivePath, { dir: targetDir });
      } else {
        execSync(`tar -xf "${tempArchivePath}" -C "${targetDir}"`);
      }

      if (fs.existsSync(tempArchivePath)) {
        fs.unlinkSync(tempArchivePath);
      }

      // On macOS, clear Gatekeeper quarantine flags from downloaded binaries and dylibs
      if (platform === 'darwin') {
        try {
          execSync(`xattr -dr com.apple.quarantine "${targetDir}" 2>/dev/null || true`);
        } catch {}
      }

      const downloadedBins = this.findBinaries(targetDir);
      if (downloadedBins.ffmpeg && downloadedBins.ffprobe && downloadedBins.binDir) {
        this.ffmpegPath = downloadedBins.ffmpeg;
        this.ffprobePath = downloadedBins.ffprobe;
        this.binDirPath = downloadedBins.binDir;
        Logger.info('FFmpegManager', `Successfully installed local FFmpeg at: ${this.binDirPath}`);
        return;
      }
    } catch (downloadErr: any) {
      Logger.warn('FFmpegManager', `Direct download failed: ${downloadErr.message}`);
    }

    // 5. Final fail-safe diagnostic if all automated paths fail
    Logger.error('FFmpegManager', '❌ [ERROR] Could not automatically acquire FFmpeg shared binaries.');
    if (platform === 'darwin') {
      Logger.info('FFmpegManager', 'Please install FFmpeg manually via: brew install ffmpeg');
    } else if (platform === 'linux') {
      Logger.info('FFmpegManager', 'Please install FFmpeg manually via: sudo apt update && sudo apt install -y libavcodec-dev libavformat-dev libswscale-dev libavfilter-dev ffmpeg');
    }
    throw new Error('Shared FFmpeg libraries missing');
  }

  private static downloadFile(url: string, destination: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let downloadedBytes = 0;
      let totalBytes = 0;

      const handleResponse = (response: any) => {
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            reject(new Error(`Redirect received with no location header from ${url}`));
            return;
          }
          https.get(redirectUrl, handleResponse).on('error', reject);
          return;
        }

        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP error ${response.statusCode} while downloading ${url}`));
          return;
        }

        totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        const fileStream = fs.createWriteStream(destination);
        response.pipe(fileStream);

        response.on('data', (chunk: any) => {
          downloadedBytes += chunk.length;
          const percent = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
          if (percent % 25 === 0) {
            Logger.info('FFmpegManager', `Downloading FFmpeg... ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)}MB)`);
          }
        });

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
      };

      const request = https.get(url, handleResponse);
      request.on('error', reject);
    });
  }
}
