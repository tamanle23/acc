import { AudioDuckingDSP, type AudioDuckingOptions } from '@acc/core';

export class AudioDuckingDecorator {
  private baseFilterGraph: string;
  private duckingOptions: AudioDuckingOptions;

  constructor(baseFilterGraph: string, duckingOptions: AudioDuckingOptions = {}) {
    this.baseFilterGraph = baseFilterGraph;
    this.duckingOptions = duckingOptions;
  }

  public generateDecoratedFilterGraph(narrationStream = 'a_voice', bgmStream = 'a_bgm', outputStream = 'a_ducked'): string {
    const duckingFilter = AudioDuckingDSP.buildSidechainFilterGraph(narrationStream, bgmStream, outputStream, this.duckingOptions);
    return `${this.baseFilterGraph}; ${duckingFilter}`;
  }
}
