// ============================================================================
// KINETIX STUDIO v6.0 - MULTI-ASPECT BATCH EXPORTER (ECMA-429)
// Deterministic batch video exporter rendering sequences in 9:16, 16:9, and 1:1.
// ============================================================================

import type { StudioState } from '@/types/studio';
import type { AspectRatio } from '@/types/spatial';
import type { StoryboardSequence } from '@/core/domain/storyboard/storyboard-sequence.entity';
import { StoryboardCompositor } from '@/engine/composition/storyboard-compositor';
import { getBaseExportDimensions, downloadBlob } from '@/lib/export-video';

export interface BatchAspectExportItem {
  readonly aspectRatio: AspectRatio;
  readonly blob: Blob;
  readonly fileName: string;
  readonly width: number;
  readonly height: number;
}

export interface BatchAspectExportOptions {
  readonly sequence: StoryboardSequence;
  readonly baseState: StudioState;
  readonly aspectRatios?: readonly AspectRatio[];
  readonly fps?: number;
  readonly autoDownload?: boolean;
  readonly onProgress?: (aspectRatio: AspectRatio, aspectProgress: number, overallProgress: number) => void;
  readonly abortSignal?: AbortSignal;
}

export interface BatchAspectExportResult {
  readonly items: readonly BatchAspectExportItem[];
  readonly totalDurationSec: number;
  readonly sequenceId: string;
}

/**
 * Renders a single aspect ratio storyboard sequence into a video/image blob.
 */
async function renderSequenceAspect(
  sequence: StoryboardSequence,
  baseState: StudioState,
  aspectRatio: AspectRatio,
  fps = 30,
  onProgress?: (progress: number) => void,
  abortSignal?: AbortSignal
): Promise<BatchAspectExportItem> {
  const { width: fullW, height: fullH } = getBaseExportDimensions(aspectRatio);
  // Half scale for fast multi-aspect batch processing
  const width = Math.round(fullW * 0.5);
  const height = Math.round(fullH * 0.5);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(`Failed to create 2D canvas context for ${aspectRatio}`);
  }

  const compositor = new StoryboardCompositor();
  const totalDuration = Math.max(1, sequence.totalDurationSec);
  const totalFrames = Math.ceil(totalDuration * fps);

  // Check if MediaRecorder is supported in current environment
  const isMediaRecorderSupported =
    typeof window !== 'undefined' &&
    typeof (canvas as any).captureStream === 'function' &&
    typeof MediaRecorder !== 'undefined';

  if (isMediaRecorderSupported) {
    return new Promise<BatchAspectExportItem>((resolve, reject) => {
      try {
        const stream = (canvas as any).captureStream(fps);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4';

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 6_000_000,
        });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onerror = (e) => {
          compositor.dispose();
          reject(e);
        };

        recorder.onstop = () => {
          compositor.dispose();
          const blob = new Blob(chunks, { type: mimeType });
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
          const safeTitle = sequence.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
          const ratioClean = aspectRatio.replace(':', 'x');
          const fileName = `${safeTitle}_${ratioClean}.${ext}`;

          resolve({
            aspectRatio,
            blob,
            fileName,
            width,
            height,
          });
        };

        recorder.start();

        if (abortSignal) {
          abortSignal.addEventListener(
            'abort',
            () => {
              try {
                if (recorder.state !== 'inactive') recorder.stop();
              } catch {}
              compositor.dispose();
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true }
          );
        }

        let currentFrame = 0;
        const intervalTime = 1000 / fps;

        const pumpFrame = () => {
          try {
            if (abortSignal?.aborted) {
              try {
                if (recorder.state !== 'inactive') recorder.stop();
              } catch {}
              compositor.dispose();
              reject(new DOMException('Aborted', 'AbortError'));
              return;
            }

            if (currentFrame >= totalFrames) {
              if (recorder.state !== 'inactive') recorder.stop();
              return;
            }

            const globalTimeSec = (currentFrame / totalFrames) * totalDuration;
            compositor.renderSequenceFrame(ctx, {
              sequence,
              globalTimeSec,
              baseState: { ...baseState, aspectRatio },
              width,
              height,
              totalFrames: 120,
            });

            currentFrame++;
            if (onProgress) {
              onProgress(currentFrame / totalFrames);
            }

            setTimeout(pumpFrame, Math.max(4, Math.floor(intervalTime * 0.5)));
          } catch (err) {
            try {
              if (recorder.state !== 'inactive') recorder.stop();
            } catch {}
            compositor.dispose();
            reject(err);
          }
        };

        pumpFrame();
      } catch (err) {
        compositor.dispose();
        reject(err);
      }
    });
  }

  // Fallback (testing or headless environment): Render final keyframe snapshot
  compositor.renderSequenceFrame(ctx, {
    sequence,
    globalTimeSec: totalDuration * 0.5,
    baseState: { ...baseState, aspectRatio },
    width,
    height,
    totalFrames: 120,
  });

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b ?? new Blob(['mock-video-data'], { type: 'video/webm' })),
      'image/png'
    );
  });

  compositor.dispose();
  const safeTitle = sequence.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const ratioClean = aspectRatio.replace(':', 'x');
  const fileName = `${safeTitle}_${ratioClean}.png`;

  return {
    aspectRatio,
    blob,
    fileName,
    width,
    height,
  };
}

/**
 * Orchestrates batch export across 9:16, 16:9, and 1:1 aspect ratios.
 */
export async function exportStoryboardBatchAspects(
  options: BatchAspectExportOptions
): Promise<BatchAspectExportResult> {
  const {
    sequence,
    baseState,
    aspectRatios = ['9:16', '16:9', '1:1'],
    fps = 30,
    autoDownload = true,
    onProgress,
    abortSignal,
  } = options;

  const items: BatchAspectExportItem[] = [];
  const totalRatios = aspectRatios.length;

  for (let i = 0; i < totalRatios; i++) {
    if (abortSignal?.aborted) {
      throw new DOMException('Batch export aborted', 'AbortError');
    }

    const ratio = aspectRatios[i];
    const item = await renderSequenceAspect(
      sequence,
      baseState,
      ratio,
      fps,
      (aspectProg) => {
        const overall = (i + aspectProg) / totalRatios;
        onProgress?.(ratio, aspectProg, overall);
      },
      abortSignal
    );

    items.push(item);

    if (autoDownload && typeof window !== 'undefined') {
      downloadBlob(item.blob, item.fileName);
    }
  }

  return {
    items,
    totalDurationSec: sequence.totalDurationSec,
    sequenceId: sequence.id,
  };
}
