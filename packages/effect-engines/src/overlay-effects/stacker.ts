import { FFmpegCommand } from '@acc/core';
import fs from 'fs';
import path from 'path';

export interface OverlayLayer {
  videoPath: string;
  metadataPath?: string;
  overlayMethod?: 'alpha' | 'screen' | 'multiply' | 'overlay';
}

/**
 * Composite Pattern implementation for combining multiple polyrhythmic VFX overlay layers.
 */
export class VFXCompositeLayerStack {
  private baseVideoPath: string;
  private layers: OverlayLayer[] = [];

  constructor(baseVideoPath: string) {
    this.baseVideoPath = baseVideoPath;
  }

  addLayer(layer: OverlayLayer): void {
    this.layers.push(layer);
  }

  calculatePolyrhythmicLCM(durations: number[]): number {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);
    return durations.reduce((acc, val) => lcm(acc, val), 1);
  }

  buildComplexFilter(): { filterComplex: string; lastTag: string } {
    let filterComplex = '';
    let lastV = '[0:v]';

    this.layers.forEach((layer, i) => {
      const overlayIndex = i + 1;
      const nextOut = `[v_out${i}]`;
      let method = layer.overlayMethod;

      // Inspect companion JSON if method not explicitly supplied
      if (!method) {
        const jsonPath = layer.metadataPath || layer.videoPath.replace(/\.(mp4|webm)$/, '.json');
        if (fs.existsSync(jsonPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            method = meta.overlay_method || (layer.videoPath.endsWith('.webm') ? 'alpha' : 'screen');
          } catch {
            method = layer.videoPath.endsWith('.webm') ? 'alpha' : 'screen';
          }
        } else {
          method = layer.videoPath.endsWith('.webm') ? 'alpha' : 'screen';
        }
      }

      switch (method) {
        case 'alpha':
          filterComplex += `${lastV}[${overlayIndex}:v]overlay=shortest=1:format=auto[v_ovl${i}];[v_ovl${i}]format=yuv420p${nextOut};`;
          break;
        case 'multiply':
          filterComplex += `${lastV}[${overlayIndex}:v]blend=all_mode=multiply:all_opacity=1:shortest=1[v_blended${i}];[v_blended${i}]format=yuv420p${nextOut};`;
          break;
        case 'overlay':
          filterComplex += `${lastV}[${overlayIndex}:v]blend=all_mode=overlay:all_opacity=1:shortest=1[v_blended${i}];[v_blended${i}]format=yuv420p${nextOut};`;
          break;
        case 'screen':
        default:
          filterComplex += `${lastV}[${overlayIndex}:v]blend=all_mode=screen:all_opacity=1:shortest=1[v_blended${i}];[v_blended${i}]format=yuv420p${nextOut};`;
          break;
      }

      lastV = nextOut;
    });

    if (filterComplex.endsWith(';')) {
      filterComplex = filterComplex.slice(0, -1);
    }

    return { filterComplex, lastTag: lastV };
  }

  async renderComposite(outputPath: string): Promise<void> {
    if (this.layers.length === 0) {
      fs.copyFileSync(this.baseVideoPath, outputPath);
      return;
    }

    const command = new FFmpegCommand(this.baseVideoPath);

    this.layers.forEach((layer) => {
      const isWebm = layer.videoPath.toLowerCase().endsWith('.webm');
      const inputOpts = ['-stream_loop', '-1'];
      if (isWebm) {
        inputOpts.unshift('-c:v', 'libvpx-vp9');
      }
      command.input(layer.videoPath);
      command.inputOptions(inputOpts);
    });

    const { filterComplex, lastTag } = this.buildComplexFilter();
    command.complexFilter(filterComplex);
    command.outputOptions([
      '-map', `${lastTag}`,
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-c:a', 'copy',
      '-crf', '18',
      '-preset', 'fast'
    ]);
    command.output(outputPath);

    await command.run();
  }
}

export function applyPolyrhythmicOverlays(
  mainVideoPath: string,
  overlayPaths: string[],
  outputPath: string
): Promise<void> {
  const stack = new VFXCompositeLayerStack(mainVideoPath);
  overlayPaths.forEach((p) => stack.addLayer({ videoPath: p }));
  return stack.renderComposite(outputPath);
}
