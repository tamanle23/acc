import { FFmpegCommand } from '@acc/core';
import fs from 'fs';

export function applyPolyrhythmicOverlays(
  mainVideoPath: string,
  overlayPaths: string[],
  outputPath: string
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    if (!overlayPaths || overlayPaths.length === 0) {
      // If no overlays, just copy the file
      fs.copyFileSync(mainVideoPath, outputPath);
      return resolve();
    }

    try {
      const command = new FFmpegCommand(mainVideoPath);

      // Overlay Inputs (Loop infinitely to create the polyrhythmic effect)
      overlayPaths.forEach((path) => {
        const isWebm = path.toLowerCase().endsWith('.webm');
        const inputOpts = ['-stream_loop', '-1'];
        if (isWebm) {
          inputOpts.unshift('-c:v', 'libvpx-vp9');
        }
        command.input(path);
        command.inputOptions(inputOpts);
      });

      let filterComplex = '';
      let lastV = '[0:v]';

      overlayPaths.forEach((path, i) => {
        const overlayIndex = i + 1;
        const nextOut = `[v_out${i}]`;
        const isWebm = path.toLowerCase().endsWith('.webm');
        
        if (isWebm) {
          filterComplex += `${lastV}[${overlayIndex}:v]overlay=shortest=1:format=auto[v_ovl${i}];[v_ovl${i}]format=yuv420p${nextOut};`;
        } else {
          filterComplex += `${lastV}[${overlayIndex}:v]blend=all_mode=screen:all_opacity=1:shortest=1[v_blended${i}];[v_blended${i}]format=yuv420p${nextOut};`;
        }
        
        lastV = nextOut;
      });

      if (filterComplex.endsWith(';')) {
        filterComplex = filterComplex.slice(0, -1);
      }

      command.complexFilter(filterComplex);
      command.outputOptions([
        '-map', `${lastV}`,
        '-map', '0:a?',
        '-c:v', 'libx264',
        '-c:a', 'copy',
        '-crf', '18',
        '-preset', 'fast'
      ]);
      command.output(outputPath);

      await command.run();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}
