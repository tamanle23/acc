import type { ModifierPlugin, ModifierContext, ClipRenderContext, MasterCompositeContext } from '../ModifierPluginRegistry';
import { ColorGradingEngine, type ColorGradingParams } from '@acc/effect-engines/client';

/**
 * ColorGradingPlugin:
 * Implements in-memory LUT and contrast/saturation adjustment ('vfx/color_grading').
 * Applies during Phase 2 (clip space) or Phase 4 (master composite).
 */
export class ColorGradingPlugin implements ModifierPlugin<ColorGradingParams> {
  public readonly type = 'vfx/color_grading';
  public readonly targetScope = 'both';
  public readonly targetPhase = 2;

  private engine = new ColorGradingEngine();

  public validate(params: unknown): params is ColorGradingParams {
    return Boolean(params && typeof params === 'object');
  }

  public async execute(context: ModifierContext, params: ColorGradingParams): Promise<void> {
    if (!context.state) context.state = {};
    context.state.colorGrading = params;
  }

  public renderClipSpace(ctx: ClipRenderContext, params: ColorGradingParams): void {
    const { ctx: canvasCtx } = ctx;
    this.engine.applyCanvasTransform(canvasCtx, params);
  }

  public renderMasterComposite(ctx: MasterCompositeContext, params: ColorGradingParams): void {
    const { ctx: canvasCtx } = ctx;
    this.engine.applyCanvasTransform(canvasCtx, params);
  }
}
