import type { ExtendedPipelineIR } from '@acc/ir';

export interface IEditingCommand {
  readonly id: string;
  execute(): Promise<void>;
  estimateCost(): { cpuUnits: number; memoryMb: number };
}

export class RenderTimelineCommand implements IEditingCommand {
  public readonly id = 'render_timeline_cmd';
  private ir: ExtendedPipelineIR;

  constructor(ir: ExtendedPipelineIR) {
    this.ir = ir;
  }

  public async execute(): Promise<void> {
    // Executes timeline rendering pass
  }

  public estimateCost(): { cpuUnits: number; memoryMb: number } {
    return {
      cpuUnits: 4,
      memoryMb: 512,
    };
  }
}

export class ApplyColorGradingCommand implements IEditingCommand {
  public readonly id = 'apply_color_grading_cmd';
  private lutPath?: string;

  constructor(lutPath?: string) {
    this.lutPath = lutPath;
  }

  public async execute(): Promise<void> {}

  public estimateCost(): { cpuUnits: number; memoryMb: number } {
    return { cpuUnits: 1, memoryMb: 128 };
  }
}

export class BurnSubtitleCommand implements IEditingCommand {
  public readonly id = 'burn_subtitle_cmd';

  public async execute(): Promise<void> {}

  public estimateCost(): { cpuUnits: number; memoryMb: number } {
    return { cpuUnits: 1, memoryMb: 64 };
  }
}

export class AnimateMaskCommand implements IEditingCommand {
  public readonly id = 'animate_mask_cmd';

  public async execute(): Promise<void> {}

  public estimateCost(): { cpuUnits: number; memoryMb: number } {
    return { cpuUnits: 2, memoryMb: 128 };
  }
}

export class HomographyTransformCommand implements IEditingCommand {
  public readonly id = 'homography_transform_cmd';

  public async execute(): Promise<void> {}

  public estimateCost(): { cpuUnits: number; memoryMb: number } {
    return { cpuUnits: 2, memoryMb: 256 };
  }
}

export class EmbedMetadataCommand implements IEditingCommand {
  public readonly id = 'embed_metadata_cmd';

  public async execute(): Promise<void> {}

  public estimateCost(): { cpuUnits: number; memoryMb: number } {
    return { cpuUnits: 1, memoryMb: 32 };
  }
}
