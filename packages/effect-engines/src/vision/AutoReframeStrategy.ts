export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

    // Ensure target width does not exceed source
    targetWidth = Math.min(targetWidth, sourceWidth);

    // Center crop on subject center X
    const subjectCenterX = subjectBox.x + subjectBox.width / 2;
    let rawX = subjectCenterX - targetWidth / 2;

    // Clamp crop to source boundaries
    rawX = Math.max(0, Math.min(rawX, sourceWidth - targetWidth));
    const rawY = Math.max(0, Math.min(0, sourceHeight - targetHeight));

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

    const finalCrop: CropRect = {
      x: smoothedX,
      y: rawCrop.y,
      width: targetWidth,
      height: targetHeight,
    };

    this.previousCrop = finalCrop;
    return finalCrop;
  }

  public generateFFmpegCropFilter(crop: CropRect): string {
    return `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`;
  }
}
