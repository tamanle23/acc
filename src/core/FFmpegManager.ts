import path from 'path';
import fs from 'fs';
import os from 'os';
import https from 'https';
import { execSync } from 'child_process';
import extractZip from 'extract-zip';

export class FFmpegManager {
  private static ffmpegPath: string | null = null;
  private static ffprobePath: string | null = null;

  public static getFFmpegPath(): string {
    if (!this.ffmpegPath) throw new Error('FFmpegManager.prepare() must be called before getFFmpegPath()');
    return this.ffmpegPath;
  }

  public static getFFprobePath(): string {
    if (!this.ffprobePath) throw new Error('FFmpegManager.prepare() must be called before getFFprobePath()');
    return this.ffprobePath;
  }

  private static isSystemFFmpegAvailable(): boolean {
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      execSync('ffprobe -version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private static findBinaries(dir: string): { ffmpeg: string | null, ffprobe: string | null } {
    let ffmpeg = null;
    let ffprobe = null;
    
    if (!fs.existsSync(dir)) return { ffmpeg, ffprobe };

    const search = (currentDir: string) => {
      const files = fs.readdirSync(currentDir);
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          search(fullPath);
        } else {
          const name = file.toLowerCase();
          if (name === 'ffmpeg.exe' || name === 'ffmpeg') ffmpeg = fullPath;
          if (name === 'ffprobe.exe' || name === 'ffprobe') ffprobe = fullPath;
        }
      }
    };
    
    search(dir);
    return { ffmpeg, ffprobe };
  }

  public static async prepare(): Promise<void> {
    if (this.ffmpegPath) return; // Already prepared

    console.log('[FFmpegManager] Checking FFmpeg installation...');

    // 1. Check Global System PATH
    if (this.isSystemFFmpegAvailable()) {
      console.log('[FFmpegManager] Found global system FFmpeg. Using system binaries.');
      this.ffmpegPath = 'ffmpeg';
      this.ffprobePath = 'ffprobe';
      return;
    }

    const platform = process.platform;
    const targetDir = path.join(process.cwd(), 'bin', 'ffmpeg');

    // 2. Check Local Fallback Installation
    const existingBins = this.findBinaries(targetDir);
    if (existingBins.ffmpeg && existingBins.ffprobe) {
      console.log('[FFmpegManager] Found local FFmpeg build.');
      this.ffmpegPath = existingBins.ffmpeg;
      this.ffprobePath = existingBins.ffprobe;
      return;
    }

    // 3. MacOS / Linux Error Handling
    if (platform !== 'win32') {
      console.error('\n❌ [ERROR] FFmpeg is missing!');
      console.error('Because you are on macOS or Linux, automatic downloading is disabled for security and architecture compatibility reasons.');
      console.error('\nPlease install FFmpeg manually using your package manager:');
      if (platform === 'darwin') {
        console.error('   👉 brew install ffmpeg');
      } else {
        console.error('   👉 sudo apt update && sudo apt install ffmpeg');
      }
      console.error('\nAfter installing, restart this CLI.\n');
      process.exit(1);
    }

    // 4. Windows Auto-Download (GPL NVENC Build from BtbN)
    console.log('\n[FFmpegManager] FFmpeg not found. Automatically downloading full GPU-enabled Windows build...');
    const url = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const tempZipPath = path.join(os.tmpdir(), `ffmpeg_${Date.now()}.zip`);

    await new Promise<void>((resolve, reject) => {
      let downloadedBytes = 0;
      let totalBytes = 0;

      const request = https.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirect
          https.get(response.headers.location!, (redirectResponse) => {
             totalBytes = parseInt(redirectResponse.headers['content-length'] || '0', 10);
             const file = fs.createWriteStream(tempZipPath);
             redirectResponse.pipe(file);
             
             redirectResponse.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                const percent = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
                process.stdout.write(`\rDownloading FFmpeg... ${percent}% (${(downloadedBytes/1024/1024).toFixed(1)}MB)`);
             });

             file.on('finish', () => {
               console.log('\nDownload complete.');
               file.close();
               resolve();
             });
          }).on('error', reject);
        } else {
          totalBytes = parseInt(response.headers['content-length'] || '0', 10);
          const file = fs.createWriteStream(tempZipPath);
          response.pipe(file);
          
          response.on('data', (chunk) => {
             downloadedBytes += chunk.length;
             const percent = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
             process.stdout.write(`\rDownloading FFmpeg... ${percent}% (${(downloadedBytes/1024/1024).toFixed(1)}MB)`);
          });

          file.on('finish', () => {
            console.log('\nDownload complete.');
            file.close();
            resolve();
          });
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
      process.exit(1);
    }

    const downloadedBins = this.findBinaries(targetDir);
    if (!downloadedBins.ffmpeg || !downloadedBins.ffprobe) {
      console.error('\n❌ [ERROR] Extraction succeeded but ffmpeg.exe was not found inside the zip structure.');
      process.exit(1);
    }

    this.ffmpegPath = downloadedBins.ffmpeg;
    this.ffprobePath = downloadedBins.ffprobe;
    
    console.log(`[FFmpegManager] Successfully installed local FFmpeg at: ${this.ffmpegPath}`);
  }
}
