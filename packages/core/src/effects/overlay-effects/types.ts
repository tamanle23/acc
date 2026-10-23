export interface OverlayEffectConfig {
  width: number;
  height: number;
  fps: number;
  duration: number;
  output: string;
  bgTransparent: boolean;
  canvasEngine: 'napi-rs' | 'skia';
  variant: string;
}

export interface EffectGenerator {
  name: string;
  generate: (config: OverlayEffectConfig, pipeline: any) => Promise<void>;
}
