import { BaseContentTaskStrategy, StrategyDescriptor } from '../BaseContentTaskStrategy';
import type { UnifiedPipelineContext } from '../../../pipeline/UnifiedPipelineContext';
import type { PipelineIR } from '@acc/ir';

export interface InteractiveWebOutput {
  contentTypeId: string;
  pipelineId: string;
  targetModality: 'interactive-web';
  widgetType: 'html5_game' | 'd3_chart' | 'calculator' | 'scrollytelling';
  bundlePayload: {
    html: string;
    jsBundle: string;
    initialState: Record<string, unknown>;
  };
  ir: PipelineIR;
  timestamp: number;
}

export class InteractiveWebContentStrategy extends BaseContentTaskStrategy<any, InteractiveWebOutput> {
  constructor(descriptor: StrategyDescriptor) {
    super({
      ...descriptor,
      targetModality: 'interactive-web',
    });
  }

  protected override async produceOutput(
    ctx: UnifiedPipelineContext<any>,
    ir: PipelineIR
  ): Promise<InteractiveWebOutput> {
    const input = ctx.input as any;
    const title = ir.metadata.title;
    const summary = ir.chunks[0]?.text || '';

    // Identify widget archetype
    let widgetType: InteractiveWebOutput['widgetType'] = 'calculator';
    if (this.pipelineId === '4') widgetType = 'html5_game';
    else if (this.pipelineId === '2') widgetType = 'd3_chart';
    else if (this.pipelineId === '5') widgetType = 'calculator';
    else if (this.pipelineId === '1') widgetType = 'scrollytelling';

    const html = `<div id="acc-widget-${this.contentTypeId}" class="acc-interactive-widget" data-type="${widgetType}"><h2>${title}</h2><div class="widget-viewport"></div></div>`;
    const jsBundle = `/* ACC Interactive Bundle: ${this.contentTypeId} */ (function(){ console.log("Initializing ${widgetType}: ${title}"); })();`;

    return {
      contentTypeId: this.contentTypeId,
      pipelineId: this.pipelineId,
      targetModality: 'interactive-web',
      widgetType,
      bundlePayload: {
        html,
        jsBundle,
        initialState: input?.initialState || { title, summary },
      },
      ir,
      timestamp: Date.now(),
    };
  }
}
