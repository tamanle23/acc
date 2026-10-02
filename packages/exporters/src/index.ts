export * from './base/BaseExporter';
export * from './video/VideoExporter';
export * from './video/SpatialVideoExporter';
export * from './audio/AudioExporter';
export * from './social/SocialExporter';
export * from './static-web/StaticWebExporter';
export * from './interactive-web/WidgetExporter';
export * from './live-stream/ZeroCopyRTMPStreamStrategy';

import type { PipelineIR } from '@acc/ir';
import type { IExporter, ExportResult, ExportOptions } from './base/BaseExporter';
import { VideoExporter } from './video/VideoExporter';
import { AudioExporter } from './audio/AudioExporter';
import { SocialExporter } from './social/SocialExporter';
import { StaticWebExporter } from './static-web/StaticWebExporter';

export interface MultiExportResults {
  video?: ExportResult;
  audio?: ExportResult;
  social?: ExportResult;
  staticWeb?: ExportResult;
}

export class ExporterDispatcher {
  private exporters: Map<string, IExporter> = new Map();

  constructor() {
    this.register(new VideoExporter());
    this.register(new AudioExporter());
    this.register(new SocialExporter());
    this.register(new StaticWebExporter());
  }

  public register(exporter: IExporter) {
    this.exporters.set(exporter.id, exporter);
  }

  public get(id: string): IExporter | undefined {
    return this.exporters.get(id);
  }

  public async exportAll(ir: PipelineIR, options: ExportOptions = {}): Promise<MultiExportResults> {
    const results: MultiExportResults = {};

    const videoExp = this.exporters.get('video');
    if (videoExp) results.video = await videoExp.export(ir, options);

    const audioExp = this.exporters.get('audio');
    if (audioExp) results.audio = await audioExp.export(ir, options);

    const socialExp = this.exporters.get('social');
    if (socialExp) results.social = await socialExp.export(ir, options);

    const webExp = this.exporters.get('static-web');
    if (webExp) results.staticWeb = await webExp.export(ir, options);

    return results;
  }
}

export const defaultExporterDispatcher = new ExporterDispatcher();
