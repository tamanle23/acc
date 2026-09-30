import { FFmpegManager } from '@acc/core';
import { FFmpegCommand } from '@acc/core';
import { RegistryManager } from './core/Registry';
import { AudioNormalizer } from '@acc/core';
import path from 'path';
import fs from 'fs';

export async function renderSoundEffect(
  registry: RegistryManager,
  effect: string,
  variant: string,
  subVariant: string,
  duration: number,
  outDir: string,
  customPrompt?: string
): Promise<string> {
  const generator = registry.getGenerator(effect);
  const result = await generator.generate(effect, variant, subVariant, duration, outDir, customPrompt);
  
  const playbackType = AudioNormalizer.getPlaybackType(effect, variant);
  
  console.log(`[Normalizer] Post-processing output (Type: ${playbackType}, Duration: ${duration}s)...`);
  const finalWavPath = await AudioNormalizer.normalize(result.audioPath, result.audioPath, playbackType, duration);
  
  // Update the JSON metadata
  if (result.jsonPath && fs.existsSync(result.jsonPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'));
      meta.playback_type = playbackType;
      meta.is_normalized = true;
      meta.loudness = "-16 LUFS";
      meta.final_audio = path.basename(finalWavPath);
      fs.writeFileSync(result.jsonPath, JSON.stringify(meta, null, 2));
    } catch(e) {}
  }
  
  return finalWavPath;
}

export async function renderCompositeSound(
  registry: RegistryManager,
  compositeName: string,
  outDir: string
): Promise<string[]> {
  const config = registry.getCompositeConfig(compositeName);
  const outputs: string[] = [];
  
  console.log(`[Audio-Engine] Preparing mix for composite: ${compositeName}...`);
  
  for (const layer of config.layers) {
    const dur = layer.duration || 5.0; // Polyrhythmic defaults
    const wavPath = await renderSoundEffect(registry, layer.effect, layer.variant, layer.subVariant, dur, outDir);
    outputs.push(wavPath);
  }
  
  // Mix the layers together using FFmpeg's filter_complex with delays
  const finalWavPath = path.join(outDir, `${compositeName}_composite.wav`);
  const inputs = outputs.map(o => `-i "${o}"`).join(' ');
  
  let filterComplex = '';
  
  const bgIndices: string[] = [];
  const fgIndices: string[] = [];

  for (let i = 0; i < outputs.length; i++) {
    const layer = config.layers[i];
    const layerDelaySec = layer.delay || 0;
    let outLabel = `[${i}:a]`;

    if (layerDelaySec > 0) {
      const delayMs = layerDelaySec * 1000;
      filterComplex += `[${i}:a]adelay=${delayMs}|${delayMs}[d${i}];`;
      outLabel = `[d${i}]`;
    }

    if (layer.role === 'background') {
      bgIndices.push(outLabel);
    } else {
      fgIndices.push(outLabel);
    }
  }

  // If no background or foreground distinction, just mix normally
  if (bgIndices.length === 0 || fgIndices.length === 0) {
    const allLabels = [...bgIndices, ...fgIndices].join('');
    filterComplex += `${allLabels}amix=inputs=${outputs.length}:duration=longest[out]`;
  } else {
    // 1. Mix Backgrounds
    const bgMixLabel = bgIndices.length > 1 ? '[bg_mix]' : bgIndices[0];
    if (bgIndices.length > 1) {
      filterComplex += `${bgIndices.join('')}amix=inputs=${bgIndices.length}:duration=longest[bg_mix];`;
    }

    // 2. Mix Foregrounds
    const fgMixLabel = fgIndices.length > 1 ? '[fg_mix]' : fgIndices[0];
    if (fgIndices.length > 1) {
      filterComplex += `${fgIndices.join('')}amix=inputs=${fgIndices.length}:duration=longest[fg_mix];`;
    }

    // 3. Split Foreground for Sidechain
    filterComplex += `${fgMixLabel}asplit=2[fg_out][fg_sc];`;

    // 4. Duck Background
    filterComplex += `${bgMixLabel}[fg_sc]sidechaincompress=threshold=-20dB:ratio=5:attack=10:release=300[bg_ducked];`;

    // 5. Final Mix
    filterComplex += `[bg_ducked][fg_out]amix=inputs=2:duration=longest[out]`;
  }
  const cmd = new FFmpegCommand();
  for (const part of layers) {
    cmd.input(part.audioPath);
  }
  cmd.complexFilter(filterComplex, ['out']);
  cmd.output(finalWavPath);
  await cmd.run();
  
  outputs.push(finalWavPath);

  return outputs;
}

