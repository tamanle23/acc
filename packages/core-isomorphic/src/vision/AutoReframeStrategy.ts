import type { BoundingBox } from '../types';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AutoReframeOptions {
  sourceWidth: number;
  sourceHeight: number;
  targetAspectRatio: '9:16' | '1:1' | '4:5';
  smoothingFactor?: number; // 0.0 to 1.0 (default 0.85 for smooth panning)
}

/**
 * AutoReframeStrategy:
 * Pure algorithmic re-framing based on subject bounding box saliency and EMA smoothing.
 * 100% isomorphic with zero native or neural dependencies.
 */
export class AutoReframeStrategy {
  private options: AutoReframeOptions;
  private previousCrop: CropRect | null = null;

  constructor(options: AutoReframeOptions) {
    this.options = options;
  }

  public calculateCropForSubject(subjectBox: BoundingBox): CropRect {
    const { sourceWidth, sourceHeight, targetAspectRatio, smoothingFactor = 0.85 } = this.options;

    // Determine target crop dimensions
    let targetWidth: number;
    let targetHeight: number;

    if (targetAspectRatio === '9:16') {
      targetHeight = sourceHeight;
      targetWidth = Math.round((sourceHeight * 9) / 16);
    } else if (targetAspectRatio === '1:1') {
      targetWidth = Math.min(sourceWidth, sourceHeight);
      targetHeight = targetWidth;
    } else {
      targetHeight = sourceHeight;
      targetWidth = Math.round((sourceHeight * 4) / 5);
    }

    // Ensure target dimensions do not exceed source
    targetWidth = Math.min(targetWidth, sourceWidth);
    targetHeight = Math.min(targetHeight, sourceHeight);

    // Center crop on subject center X and Y
    const subjectCenterX = subjectBox.x + subjectBox.width / 2;
    const subjectCenterY = subjectBox.y + subjectBox.height / 2;

    let rawX = subjectCenterX - targetWidth / 2;
    let rawY = subjectCenterY - targetHeight / 2;

    // Clamp crop to source boundaries
    rawX = Math.max(0, Math.min(rawX, sourceWidth - targetWidth));
    rawY = Math.max(0, Math.min(rawY, sourceHeight - targetHeight));

    const rawCrop: CropRect = {
      x: Math.round(rawX),
      y: Math.round(rawY),
      width: targetWidth,
      height: targetHeight,
    };

    // Apply exponential moving average (EMA) smoothing if previous frame exists
    if (!this.previousCrop) {
      this.previousCrop = rawCrop;
      return rawCrop;
    }

    const smoothedX = Math.round(
      this.previousCrop.x * smoothingFactor + rawCrop.x * (1 - smoothingFactor)
    );
    const smoothedY = Math.round(
      this.previousCrop.y * smoothingFactor + rawCrop.y * (1 - smoothingFactor)
    );

    const finalCrop: CropRect = {
      x: smoothedX,
      y: smoothedY,
      width: targetWidth,
      height: targetHeight,
    };

    this.previousCrop = finalCrop;
    return finalCrop;
  }

  public reset(): void {
    this.previousCrop = null;
  }
}
