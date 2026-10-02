import type { ExtendedPipelineIR } from '@acc/ir';

export interface IEditingCommand {
  readonly id: string;
  execute(state?: Record<string, any>): Promise<Record<string, any>>;
  estimateCost(): { cpuUnits: number; memoryMb: number };
}

export class RenderTimelineCommand implements IEditingCommand {
  public readonly id = 'render_timeline_cmd';
  private ir: ExtendedPipelineIR;

  constructor(ir: ExtendedPipelineIR) {
    this.ir = ir;
  }

  public async execute(state: Record<string, any> = {}): Promise<Record<string, any>> {
    const totalDurationMs = this.ir.extendedChunks.reduce((acc, c) => acc + c.durationMs, 0);
    return {
      ...state,
      renderedJobId: this.ir.metadata.jobId,
      totalDurationMs,
      chunksProcessed: this.ir.extendedChunks.length,
      executedAt: new Date().toISOString(),
    };
  }

  public estimateCost(): { cpuUnits: number; memoryMb: number } {
    return { cpuUnits: 4, memoryMb: 512 };
  }
}

export class ApplyColorGradingCommand implements IEditingCommand {
  public readonly id = 'apply_color_grading_cmd';
  private lutPath?: string;
  private contrast: number;
  private saturation: number;

  constructor(lutPath?: string, contrast = 1.1, saturation = 1.2) {
    this.lutPath = lutPath;
    this.contrast = contrast;
    this.saturation = saturation;
  }

  public async execute(state: Record<string, any> = {}): Promise<Record<string, any>> {
    const filter = `eq=contrast=${this.contrast.toFixed(2)}:saturation=${this.saturation.toFixed(2)}${this.lutPath ? `:lut3d=file='${this.lutPath}'` : ''}`;
    return {
      ...state,
      colorFilter: filter,
      lutApplied: !!this.lutPath,
    };
  }

  public estimateCost(): { cpuUnits: number; memoryMb: number } {
    return { cpuUnits: 1, memoryMb: 128 };
  }
}

export class BurnSubtitleCommand implements IEditingCommand {
  public readonly id = 'burn_subtitle_cmd';
  private fontName: string;
  private fontSize: number;

  constructor(fontName = 'Sans-Serif', fontSize = 48) {
    this.fontName = fontName;
    this.fontSize = fontSize;
  }

  public async execute(state: Record<string, any> = {}): Promise<Record<string, any>> {
    const assStyle = `Style: Default,${this.fontName},${this.fontSize},&H00FFFFFF,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1`;
    return {
      ...state,
      subtitleStyle: assStyle,
      hardsubBurnEnabled: true,
    };
  }

  public estimateCost(): { cpuUnits: number; memoryMb: number } {
    return { cpuUnits: 1, memoryMb: 64 };
  }
}

export class AnimateMaskCommand implements IEditingCommand {
  public readonly id = 'animate_mask_cmd';
  private cx: number;
  private cy: number;
  private rx: number;
  private ry: number;

  constructor(cx = 540, cy = 960, rx = 300, ry = 300) {
    this.cx = cx;
    this.cy = cy;
    this.rx = rx;
    this.ry = ry;
  }

  public async execute(state: Record<string, any> = {}): Promise<Record<string, any>> {
    return {
      ...state,
      activeMask: { cx: this.cx, cy: this.cy, rx: this.rx, ry: this.ry },
      maskAnimated: true,
    };
  }

  public estimateCost(): { cpuUnits: number; memoryMb: number } {
    return { cpuUnits: 2, memoryMb: 128 };
  }
}

export class HomographyTransformCommand implements IEditingCommand {
  public readonly id = 'homography_transform_cmd';
  private srcPoints: number[];
  private dstPoints: number[];

  constructor(srcPoints = [0, 0, 100, 0, 100, 100, 0, 100], dstPoints = [10, 10, 110, 10, 110, 110, 10, 110]) {
    this.srcPoints = srcPoints;
    this.dstPoints = dstPoints;
  }

  public async execute(state: Record<string, any> = {}): Promise<Record<string, any>> {
    // Computes homography 3x3 matrix translation vector
    const matrix = [1.0, 0.0, this.dstPoints[0] - this.srcPoints[0], 0.0, 1.0, this.dstPoints[1] - this.srcPoints[1], 0.0, 0.0, 1.0];
    return {
      ...state,
      homographyMatrix: matrix,
      perspectiveTransformed: true,
    };
  }

  public estimateCost(): { cpuUnits: number; memoryMb: number } {
    return { cpuUnits: 2, memoryMb: 256 };
  }
}

export class EmbedMetadataCommand implements IEditingCommand {
  public readonly id = 'embed_metadata_cmd';
  private title: string;
  private author: string;

  constructor(title: string, author = 'ACC Engine') {
    this.title = title;
    this.author = author;
  }

  public async execute(state: Record<string, any> = {}): Promise<Record<string, any>> {
    return {
      ...state,
      metadataArgs: ['-metadata', `title=${this.title}`, '-metadata', `artist=${this.author}`],
      metadataEmbedded: true,
    };
  }

  public estimateCost(): { cpuUnits: number; memoryMb: number } {
    return { cpuUnits: 1, memoryMb: 32 };
  }
}
