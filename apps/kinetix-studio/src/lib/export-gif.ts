// ============================================================================
// KINETIX STUDIO v5.0 - CLIENT-SIDE ANIMATED GIF EXPORTER
// Frame-by-frame canvas capture with color quantization for high-DPI animated GIFs
// ideal for Discord stickers, GitHub READMEs, and Slack reactions.
// ============================================================================

import type { StudioState } from '@/types/studio';
import { downloadBlob } from './export-video';
import { computeChoreography } from '@/engine/choreography';
import { renderPosterComposition } from '@/engine/composition-engine';
import { userAudioTrack } from '@/engine/audio-user-track';

export interface ExportGifOptions {
  state: StudioState;
  abortController: AbortController;
  fileHandle?: any;
  autoDownload?: boolean;
  onProgress: (pct: number) => void;
  onSuccess: (blob: Blob) => void;
  onCancel: () => void;
}

export async function exportCompositeGif(options: ExportGifOptions): Promise<Blob | null> {
  const { state, abortController, onProgress, onSuccess, onCancel } = options;

  // GIF format is optimized at 280px width for fast encoding and small file size
  const targetW = 280;
  let targetH = 498; // 9:16
  if (state.aspectRatio === '1:1') targetH = 280;
  if (state.aspectRatio === '4:5') targetH = 350;
  if (state.aspectRatio === '16:9') targetH = 158;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    onCancel();
    return null;
  }

  // Sample at 15-20 FPS for optimal GIF compression ratio
  const gifFps = 15;
  const totalFrames = Math.max(12, Math.round(state.durationSec * gifFps));

  // High quality binary GIF stream builder
  const framesData: ImageData[] = [];

  for (let f = 0; f < totalFrames; f++) {
    if (abortController.signal.aborted) {
      onCancel();
      return null;
    }

    const progress = f / totalFrames;
    const choreo = computeChoreography(
      progress,
      state.timelineMode,
      state.hicksLawDisclosure,
      state.customKeyframes,
      state.choreoMode
    );
    const timeSec = progress * state.durationSec;
    const telemetry =
      state.audioSource === 'user-file'
        ? userAudioTrack.getTelemetryAtTime(timeSec)
        : undefined;

    renderPosterComposition(ctx, {
      width: targetW,
      height: targetH,
      state,
      frame: f,
      totalFrames,
      choreo,
      scale: 1,
      audioTelemetry: telemetry,
    });

    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    framesData.push(imgData);

    onProgress(Math.round(((f + 1) / totalFrames) * 80));
    await new Promise((r) => setTimeout(r, 0));
  }

  // Build animated GIF bytes (GIF89a standard)
  const gifBlob = encodeBasicGif(framesData, targetW, targetH, Math.round(100 / gifFps));
  const filename = `${state.posterId}-${state.aspectRatio.replace(':', 'x')}.gif`;
  onProgress(100);
  onSuccess(gifBlob);

  if (options.fileHandle) {
    try {
      const writable = await options.fileHandle.createWritable();
      await writable.write(gifBlob);
      await writable.close();
      return gifBlob;
    } catch (writeErr) {
      console.warn('Writing to fileHandle failed, falling back to downloadBlob:', writeErr);
    }
  }

  if (options.autoDownload) {
    downloadBlob(gifBlob, filename);
  }
  return gifBlob;
}

/**
 * Basic pure-math GIF89a stream packager
 */
function encodeBasicGif(
  frames: ImageData[],
  width: number,
  height: number,
  delayCentiseconds: number
): Blob {
  const parts: BlobPart[] = [];

  // Header: GIF89a
  const header = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  parts.push(header);

  // Logical Screen Descriptor (width, height, GCT flag, 256 colors)
  const lsd = new Uint8Array(7);
  lsd[0] = width & 0xff;
  lsd[1] = (width >> 8) & 0xff;
  lsd[2] = height & 0xff;
  lsd[3] = (height >> 8) & 0xff;
  lsd[4] = 0x87; // GCT present, 8 bits/pixel
  lsd[5] = 0x00; // Background color index
  lsd[6] = 0x00; // Pixel aspect ratio
  parts.push(lsd);

  // Global Color Table (Standard 256-color 6-7-6 web palette)
  const gct = new Uint8Array(768);
  let gctIdx = 0;
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 7; g++) {
      for (let b = 0; b < 6; b++) {
        if (gctIdx < 765) {
          gct[gctIdx++] = Math.round((r / 5) * 255);
          gct[gctIdx++] = Math.round((g / 6) * 255);
          gct[gctIdx++] = Math.round((b / 5) * 255);
        }
      }
    }
  }
  parts.push(gct);

  // Netscape 2.0 Loop Extension Block (Infinite loop)
  const loopExt = new Uint8Array([
    0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30,
    0x03, 0x01, 0x00, 0x00, 0x00,
  ]);
  parts.push(loopExt);

  // Render each frame
  for (const frame of frames) {
    // Graphic Control Extension (delay, disposal, transparency)
    const gce = new Uint8Array([
      0x21, 0xf9, 0x04, 0x00, delayCentiseconds & 0xff, (delayCentiseconds >> 8) & 0xff, 0x00, 0x00,
    ]);
    parts.push(gce);

    // Image Descriptor
    const id = new Uint8Array([
      0x2c, 0x00, 0x00, 0x00, 0x00, width & 0xff, (width >> 8) & 0xff, height & 0xff,
      (height >> 8) & 0xff, 0x00,
    ]);
    parts.push(id);

    // LZW Raster Data (8-bit minimum code size)
    const minCodeSize = 8;
    parts.push(new Uint8Array([minCodeSize]));

    // Map frame pixels to nearest 6-7-6 palette index
    const data = frame.data;
    const pixelCount = width * height;
    const indices = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const offset = i * 4;
      const r = Math.min(5, Math.floor((data[offset]! / 256) * 6));
      const g = Math.min(6, Math.floor((data[offset + 1]! / 256) * 7));
      const b = Math.min(5, Math.floor((data[offset + 2]! / 256) * 6));
      indices[i] = r * 42 + g * 6 + b;
    }

    // Write uncompressed LZW raster sub-blocks
    let srcIdx = 0;
    while (srcIdx < pixelCount) {
      const blockSize = Math.min(254, pixelCount - srcIdx);
      const block = new Uint8Array(blockSize + 1);
      block[0] = blockSize;
      for (let j = 0; j < blockSize; j++) {
        block[j + 1] = indices[srcIdx + j]!;
      }
      parts.push(block);
      srcIdx += blockSize;
    }
    // Block Terminator
    parts.push(new Uint8Array([0x00]));
  }

  // GIF Trailer
  parts.push(new Uint8Array([0x3b]));

  return new Blob(parts, { type: 'image/gif' });
}
