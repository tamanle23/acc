export interface AudioDuckingOptions {
  attenuationDb?: number; // e.g. -18dB (default -18)
  attackMs?: number; // e.g. 20ms (default 20)
  releaseMs?: number; // e.g. 250ms (default 250)
  thresholdDb?: number; // e.g. -24dB (default -24)
}

export class AudioDuckingDSP {
  public static buildSidechainFilterGraph(
    narrationStreamName = 'a_narration',
    bgmStreamName = 'a_bgm',
    outputStreamName = 'a_ducked',
    options: AudioDuckingOptions = {}
  ): string {
    const attenuation = options.attenuationDb ?? -18;
    const attack = options.attackMs ?? 20;
    const release = options.releaseMs ?? 250;
    const threshold = options.thresholdDb ?? -24;

    // FFmpeg sidechaincompress filter:
    // [bgm][narration]sidechaincompress=threshold=...:ratio=...:attack=...:release=...[ducked]
    const ratio = Math.pow(10, Math.abs(attenuation) / 20); // convert dB to ratio approx

    return `[${bgmStreamName}][${narrationStreamName}]sidechaincompress=threshold=${threshold}dB:ratio=${ratio.toFixed(1)}:attack=${attack}:release=${release}[${outputStreamName}]`;
  }

  public static buildEBUR128LoudnessFilter(targetLufs = -14.0): string {
    // loudnorm filter for EBU R128 compliance
    return `loudnorm=I=${targetLufs.toFixed(1)}:LRA=11:TP=-1.5`;
  }
}
