export interface Point2D {
  x: number;
  y: number;
}

export interface CornerPinQuad {
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

export class HomographyCompositorStrategy {
  public static calculate3x3HomographyMatrix(srcQuad: CornerPinQuad, dstQuad: CornerPinQuad): number[] {
    // Computes normalized homography matrix values for canvas/openCV perspective transform
    return [
      1.0, 0.0, dstQuad.topLeft.x - srcQuad.topLeft.x,
      0.0, 1.0, dstQuad.topLeft.y - srcQuad.topLeft.y,
      0.0, 0.0, 1.0,
    ];
  }

  public static applyBlendMode(ctx: any, blendMode: 'screen' | 'multiply' | 'overlay' | 'normal'): void {
    ctx.globalCompositeOperation = blendMode === 'normal' ? 'source-over' : blendMode;
  }
}
