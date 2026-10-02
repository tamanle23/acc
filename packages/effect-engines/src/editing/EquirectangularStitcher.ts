export interface VR360StitchOptions {
  inputProjection?: 'dual_fisheye' | 'equirectangular';
  yawDeg?: number;
  pitchDeg?: number;
  rollDeg?: number;
}

export class EquirectangularStitcher {
  public static generateFFmpegV360Filter(options: VR360StitchOptions = {}): string {
    const yaw = options.yawDeg ?? 0;
    const pitch = options.pitchDeg ?? 0;
    const roll = options.rollDeg ?? 0;
    const inProj = options.inputProjection === 'dual_fisheye' ? 'dfisheye' : 'equirect';

    return `v360=input=${inProj}:output=equirect:yaw=${yaw}:pitch=${pitch}:roll=${roll}`;
  }
}
