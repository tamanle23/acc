export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
}

export interface CompositorLayoutResult {
  layoutMode: 'pip' | 'split_screen' | 'fullscreen';
  canvasDimensions: { width: number; height: number };
  viewports: Array<{
    layerId: string;
    rect: ViewportRect;
    zIndex: number;
  }>;
}

export interface ICompositorStrategy {
  readonly id: string;
  composeLayout(
    canvasWidth: number,
    canvasHeight: number,
    layers: Array<{ id: string; isPrimary?: boolean }>
  ): CompositorLayoutResult;
}

export class PiPCompositorStrategy implements ICompositorStrategy {
  public readonly id = 'pip';
  private readonly pipScale: number;
  private readonly corner: 'bottom_right' | 'top_right' | 'bottom_left' | 'top_left';

  constructor(pipScale = 0.35, corner: 'bottom_right' | 'top_right' | 'bottom_left' | 'top_left' = 'bottom_right') {
    this.pipScale = pipScale;
    this.corner = corner;
  }

  public composeLayout(
    canvasWidth: number,
    canvasHeight: number,
    layers: Array<{ id: string; isPrimary?: boolean }>
  ): CompositorLayoutResult {
    if (layers.length === 0) {
      return {
        layoutMode: 'fullscreen',
        canvasDimensions: { width: canvasWidth, height: canvasHeight },
        viewports: [],
      };
    }

    const primaryLayer = layers.find(l => l.isPrimary) || layers[0];
    const secondaryLayers = layers.filter(l => l.id !== primaryLayer.id);

    const viewports: CompositorLayoutResult['viewports'] = [
      {
        layerId: primaryLayer.id,
        rect: { x: 0, y: 0, width: canvasWidth, height: canvasHeight },
        zIndex: 0,
      },
    ];

    const pipW = Math.round(canvasWidth * this.pipScale);
    const pipH = Math.round(canvasHeight * this.pipScale);
    const margin = 24;

    secondaryLayers.forEach((sec, idx) => {
      let x = canvasWidth - pipW - margin;
      let y = canvasHeight - pipH - margin;

      if (this.corner === 'top_right') {
        y = margin + idx * (pipH + 12);
      } else if (this.corner === 'bottom_left') {
        x = margin;
      } else if (this.corner === 'top_left') {
        x = margin;
        y = margin + idx * (pipH + 12);
      } else {
        y = canvasHeight - pipH - margin - idx * (pipH + 12);
      }

      viewports.push({
        layerId: sec.id,
        rect: {
          x,
          y,
          width: pipW,
          height: pipH,
          borderRadius: 16,
          borderWidth: 3,
          borderColor: '#FFFFFF',
        },
        zIndex: idx + 1,
      });
    });

    return {
      layoutMode: 'pip',
      canvasDimensions: { width: canvasWidth, height: canvasHeight },
      viewports,
    };
  }
}

export class SplitScreenCompositorStrategy implements ICompositorStrategy {
  public readonly id = 'split_screen';
  private readonly orientation: 'vertical' | 'horizontal';

  constructor(orientation: 'vertical' | 'horizontal' = 'horizontal') {
    this.orientation = orientation;
  }

  public composeLayout(
    canvasWidth: number,
    canvasHeight: number,
    layers: Array<{ id: string; isPrimary?: boolean }>
  ): CompositorLayoutResult {
    if (layers.length === 0) {
      return {
        layoutMode: 'split_screen',
        canvasDimensions: { width: canvasWidth, height: canvasHeight },
        viewports: [],
      };
    }

    const count = layers.length;
    const viewports: CompositorLayoutResult['viewports'] = [];

    if (this.orientation === 'horizontal') {
      // Divide horizontally (stacked top to bottom)
      const sectionH = Math.round(canvasHeight / count);
      layers.forEach((layer, idx) => {
        viewports.push({
          layerId: layer.id,
          rect: {
            x: 0,
            y: idx * sectionH,
            width: canvasWidth,
            height: sectionH,
          },
          zIndex: idx,
        });
      });
    } else {
      // Divide vertically (side by side left to right)
      const sectionW = Math.round(canvasWidth / count);
      layers.forEach((layer, idx) => {
        viewports.push({
          layerId: layer.id,
          rect: {
            x: idx * sectionW,
            y: 0,
            width: sectionW,
            height: canvasHeight,
          },
          zIndex: idx,
        });
      });
    }

    return {
      layoutMode: 'split_screen',
      canvasDimensions: { width: canvasWidth, height: canvasHeight },
      viewports,
    };
  }
}
