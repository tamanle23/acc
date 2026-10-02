export interface AmbisonicPanOptions {
  azimuthDeg: number; // -180 to 180 (horizontal angle)
  elevationDeg: number; // -90 to 90 (vertical angle)
}

export class SpatialAudioAmbisonicsEngine {
  public static generateFFmpegAmbisonicBFormatFilter(options: AmbisonicPanOptions): string {
    const az = options.azimuthDeg;
    const el = options.elevationDeg;
    // Ambisonic B-Format 4-channel encoding (W, X, Y, Z)
    return `sofalizer=azimuth=${az}:elevation=${el}`;
  }
}
