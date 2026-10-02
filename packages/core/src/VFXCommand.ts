import { FFmpegFilterGraph } from './FFmpegFilterGraph';
import { AssetContext } from './AssetContext';

export interface CommandValidationResult {
  valid: boolean;
  errors: string[];
}

export interface VFXCommandCost {
  cpuScore: number;
  vramMB: number;
  durationSec: number;
}

export interface VFXCommand {
  id: string;
  type: string;
  validate(context: AssetContext): CommandValidationResult;
  compileToFilterGraph(graph: FFmpegFilterGraph, context: AssetContext): Promise<void>;
  estimateCost(): VFXCommandCost;
}

/**
 * Concrete Command: Crossfade Transition between two slides/scenes
 */
export class XFadeTransitionCommand implements VFXCommand {
  public id: string;
  public type = 'VFX_XFADE_TRANSITION';

  constructor(
    id: string,
    private leftSceneId: string,
    private rightSceneId: string,
    private transitionType: string = 'fade',
    private durationSec: number = 1.0,
    private offsetSec: number = 0.0
  ) {
    this.id = id;
  }

  public validate(context: AssetContext): CommandValidationResult {
    const errors: string[] = [];
    const leftImg = context.getPreferred(this.leftSceneId, ['upscaled', 'original']);
    const rightImg = context.getPreferred(this.rightSceneId, ['upscaled', 'original']);

    if (!leftImg) errors.push(`Left scene asset missing for scene ID: ${this.leftSceneId}`);
    if (!rightImg) errors.push(`Right scene asset missing for scene ID: ${this.rightSceneId}`);

    return { valid: errors.length === 0, errors };
  }

  public async compileToFilterGraph(graph: FFmpegFilterGraph, context: AssetContext): Promise<void> {
    const validation = this.validate(context);
    if (!validation.valid) {
      throw new Error(`XFadeTransitionCommand [${this.id}] validation failed: ${validation.errors.join(', ')}`);
    }

    const leftStream = `v_${this.leftSceneId}`;
    const rightStream = `v_${this.rightSceneId}`;
    const outputStream = `v_xfade_${this.id}`;

    graph.addNode({
      filter: 'xfade',
      inputs: [leftStream, rightStream],
      outputs: [outputStream],
      options: {
        transition: this.transitionType,
        duration: this.durationSec,
        offset: this.offsetSec
      }
    });
  }

  public estimateCost(): VFXCommandCost {
    return { cpuScore: 2, vramMB: 128, durationSec: this.durationSec };
  }
}

/**
 * Concrete Command: Depth 3D Pop-Out Effect Composition
 */
export class Depth3DPopOutCommand implements VFXCommand {
  public id: string;
  public type = 'VFX_3D_POP_OUT';

  constructor(
    id: string,
    private sceneId: string,
    private style: 'polaroid' | 'comic' | 'card' = 'polaroid',
    private durationSec: number = 3.0
  ) {
    this.id = id;
  }

  public validate(context: AssetContext): CommandValidationResult {
    const errors: string[] = [];
    const cutout = context.getPreferred(this.sceneId, ['cutout']);
    const bg = context.getPreferred(this.sceneId, ['upscaled', 'original']);

    if (!cutout) errors.push(`Depth3D requires cutout variant for scene ID: ${this.sceneId}`);
    if (!bg) errors.push(`Depth3D requires background asset for scene ID: ${this.sceneId}`);

    return { valid: errors.length === 0, errors };
  }

  public async compileToFilterGraph(graph: FFmpegFilterGraph, context: AssetContext): Promise<void> {
    const validation = this.validate(context);
    if (!validation.valid) {
      throw new Error(`Depth3DPopOutCommand [${this.id}] validation failed: ${validation.errors.join(', ')}`);
    }

    graph.addNode({
      filter: 'overlay',
      inputs: [`v_bg_${this.sceneId}`, `v_cutout_${this.sceneId}`],
      outputs: [`v_3d_out_${this.sceneId}`],
      options: {
        x: '(main_w-overlay_w)/2',
        y: '(main_h-overlay_h)/2'
      }
    });
  }

  public estimateCost(): VFXCommandCost {
    return { cpuScore: 5, vramMB: 512, durationSec: this.durationSec };
  }
}

/**
 * Macro Command: Chains multiple VFXCommands into a composite execution unit
 */
export class CompositeVFXCommand implements VFXCommand {
  public id: string;
  public type = 'VFX_COMPOSITE_MACRO';
  private commands: VFXCommand[] = [];

  constructor(id: string, commands: VFXCommand[] = []) {
    this.id = id;
    this.commands = commands;
  }

  public addCommand(command: VFXCommand): void {
    this.commands.push(command);
  }

  public validate(context: AssetContext): CommandValidationResult {
    const errors: string[] = [];
    for (const cmd of this.commands) {
      const res = cmd.validate(context);
      if (!res.valid) {
        errors.push(...res.errors);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  public async compileToFilterGraph(graph: FFmpegFilterGraph, context: AssetContext): Promise<void> {
    for (const cmd of this.commands) {
      await cmd.compileToFilterGraph(graph, context);
    }
  }

  public estimateCost(): VFXCommandCost {
    return this.commands.reduce(
      (acc, cmd) => {
        const cost = cmd.estimateCost();
        return {
          cpuScore: acc.cpuScore + cost.cpuScore,
          vramMB: Math.max(acc.vramMB, cost.vramMB),
          durationSec: acc.durationSec + cost.durationSec
        };
      },
      { cpuScore: 0, vramMB: 0, durationSec: 0 }
    );
  }
}
