import { Logger } from './logger';
import path from 'path';
import fs from 'fs';
import { FFmpegCommand } from './FFmpegExecutor';

export type PlaybackType = 'loop' | 'oneshot';

export class AudioNormalizer {
  
  /**
   * Automatically determines if a category should be a loop or one-shot.
   */
  public static getPlaybackType(category: string, variant: string): PlaybackType {
    const loopCategories = ['weather', 'water', 'urban', 'ambience'];
    if (loopCategories.includes(category.toLowerCase())) return 'loop';
    
    // Mechanical idle sounds
    if (category === 'mechanical' && variant.includes('idle')) return 'loop';
    // Insects like cicadas or bees are loops
    if (category === 'reptile_insect' && (variant === 'insect' || variant === 'cicada' || variant === 'bee')) return 'loop';
    
    return 'oneshot';
  }

  /**
   * Applies standardization filters: High-pass (noise reduction), Loudness (EBU R128),
   * and looping/fade-out logic.
   */
  public static async normalize(
    inputPath: string, 
    outputPath: string, 
    playbackType: PlaybackType, 
    targetDuration: number
  ): Promise<string> {
    const finalExt = '.wav';
    
    const parsedPath = path.parse(outputPath);
    const finalWavPath = path.join(parsedPath.dir, `${parsedPath.name}_normalized${finalExt}`);
    
    let filterComplex = '';

    if (playbackType === 'oneshot') {
      // 1. Remove silence at start and end
      // 2. Highpass filter for clarity (remove < 40Hz rumble)
      // 3. Trim to target duration
      // 4. Loudness normalization
      // 5. Fade out last 0.2s to prevent clicking
      const fadeStart = Math.max(0, targetDuration - 0.2);
      filterComplex = `[0:a]silenceremove=start_periods=1:start_threshold=-50dB,highpass=f=40,atrim=0:${targetDuration},loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=${fadeStart}:d=0.2[out]`;
      
      const cmd = new FFmpegCommand(inputPath);
      cmd.complexFilter(filterComplex, ['out']);
      cmd.audioFrequency(44100);
      cmd.audioChannels(2);
      cmd.output(finalWavPath);
      await cmd.run();

    } else {
      // LOOP LOGIC
      // 1. Highpass filter
      // 2. Loudnorm
      // 3. Seamless crossfade to ensure end matches the start perfectly.
      // 4. Loop duration logic: We take a bit more than target (e.g. + 1s) and crossfade 0.5s of it.
      
      const crossfadeDur = 0.5;
      const trimEnd = targetDuration;
      
      // We will split the audio, swap the two halves (split exactly at crossfadeDur), and crossfade them.
      // This is the classic "audio splicing" trick for seamless loops.
      // [head] = first crossfadeDur seconds.
      // [tail] = after crossfadeDur to targetDuration.
      // Then we crossfade [tail] and [head].
      
      filterComplex = `[0:a]highpass=f=40,loudnorm=I=-16:TP=-1.5:LRA=11,atrim=0:${targetDuration + crossfadeDur},asplit=2[part1][part2];` +
                      `[part1]atrim=0:${crossfadeDur},asetpts=PTS-STARTPTS[head];` +
                      `[part2]atrim=${crossfadeDur}:${targetDuration + crossfadeDur},asetpts=PTS-STARTPTS[tail];` +
                      `[tail][head]acrossfade=d=${crossfadeDur}:curve1=losi:curve2=losi[out]`;

      try {
        const cmd = new FFmpegCommand(inputPath);
        cmd.complexFilter(filterComplex, ['out']);
        cmd.audioFrequency(44100);
        cmd.audioChannels(2);
        cmd.output(finalWavPath);
        await cmd.run();
      } catch (err) {
        // Fallback if audio is too short for crossfade trick
        Logger.warn('AudioNormalizer', 'Audio too short for crossfade, using standard trim...');
        const fallbackCmd = new FFmpegCommand(inputPath);
        fallbackCmd.outputOptions(['-af', `highpass=f=40,atrim=0:${targetDuration},loudnorm=I=-16:TP=-1.5:LRA=11`]);
        fallbackCmd.audioFrequency(44100);
        fallbackCmd.audioChannels(2);
        fallbackCmd.output(finalWavPath);
        await fallbackCmd.run();
      }
    }

    // Clean up original raw file to save space
    if (fs.existsSync(inputPath) && inputPath !== finalWavPath) {
      fs.unlinkSync(inputPath);
    }

    return finalWavPath;
  }
}
