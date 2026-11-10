export type FitMode = 'cover' | 'fit' | 'stretch' | 'center';

export interface NormalizedCrop {
  top: number;    // 0.0 - 1.0
  bottom: number; // 0.0 - 1.0
  left: number;   // 0.0 - 1.0
  right: number;  // 0.0 - 1.0
}

export interface SpatialConformanceConfig {
  fitMode: FitMode;
  pixelAspectRatio?: number; // Defaults to 1.0 (square pixels)
  crop?: NormalizedCrop;
  smartReframe?: { focusX: number; focusY: number };
}

export type ColorTransferFunction = 'srgb' | 'rec709' | 'hlg' | 'pq' | 'slog3' | 'linear';
export type ColorGamut = 'rec709' | 'p3' | 'rec2020';

export interface ColorConformanceConfig {
  sourceTransfer?: ColorTransferFunction;
  sourceGamut?: ColorGamut;
  toneMapping?: 'none' | 'aces' | 'reinhard';
  exposureBias?: number; // in stops (e.g. 0.0)
}

export interface AudioChannelMatrix {
  downmixMode: 'auto' | 'itu-r-bs775' | 'mono-center' | 'passthrough';
  targetSampleRate: number; // e.g. 48000
  resampleQuality: 'fast_linear' | 'web_audio' | 'pristine_kaiser_sinc';
  targetLufs?: number; // e.g. -14.0 LUFS
}

export interface AssetConformanceProfile {
  assetId: string;
  spatial: SpatialConformanceConfig;
  color: ColorConformanceConfig;
  audio: AudioChannelMatrix;
}
