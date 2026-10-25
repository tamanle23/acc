export interface AmbisonicPanOptions {
  azimuthDeg: number; // -180 to 180 (horizontal angle)
  elevationDeg: number; // -90 to 90 (vertical angle)
  distanceMeters?: number;
  sofaPath?: string;
  outputFormat?: 'binaural' | 'b_format_4ch';
}

export class SpatialAudioAmbisonicsEngine {
  /**
   * Generates FFmpeg audio filter for spatial ambisonics and binaural convolution.
   */
  public static generateFFmpegAmbisonicBFormatFilter(options: AmbisonicPanOptions): string {
    const az = Math.max(-180, Math.min(180, options.azimuthDeg));
    const el = Math.max(-90, Math.min(90, options.elevationDeg));
    const format = options.outputFormat ?? 'binaural';

    if (format === 'b_format_4ch') {
      // 4-channel spherical harmonic coefficients: W=1/√2, X=cos(el)cos(az), Y=cos(el)sin(az), Z=sin(el)
      const azRad = (az * Math.PI) / 180;
      const elRad = (el * Math.PI) / 180;
      const w = 0.7071;
      const x = Math.cos(elRad) * Math.cos(azRad);
      const y = Math.cos(elRad) * Math.sin(azRad);
      const z = Math.sin(elRad);
      return `pan=4c|c0=${w.toFixed(4)}*c0|c1=${x.toFixed(4)}*c0|c2=${y.toFixed(4)}*c0|c3=${z.toFixed(4)}*c0`;
    }

    // Binaural HRIR convolution (sofalizer filter)
    const sofa = options.sofaPath ? `:sofa=${options.sofaPath}` : '';
    return `sofalizer=azimuth=${az}:elevation=${el}${sofa}`;
  }
}
