import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';

export function applyPolyrhythmicOverlays(
  mainVideoPath: string,
  overlayPaths: string[],
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!overlayPaths || overlayPaths.length === 0) {
      // If no overlays, just copy the file
      fs.copyFileSync(mainVideoPath, outputPath);
      return resolve();
    }

    const command = ffmpeg();
    
    // Primary Input (The main story video)
    command.input(mainVideoPath);

    // Overlay Inputs (Loop infinitely to create the polyrhythmic effect)
    overlayPaths.forEach((path) => {
      const isWebm = path.toLowerCase().endsWith('.webm');
      const inputOpts = ['-stream_loop', '-1'];
      if (isWebm) {
        // FFmpeg's native vp9 decoder discards alpha; libvpx-vp9 is required to decode alpha plane (yuva420p)
        inputOpts.unshift('-c:v', 'libvpx-vp9');
      }
      command.input(path).inputOptions(inputOpts);
    });

    let filterComplex = '';
    let lastV = '[0:v]';

    overlayPaths.forEach((path, i) => {
      const overlayIndex = i + 1;
      const nextOut = `[v_out${i}]`;
      
      // Sniff format. .webm uses transparency (alpha), .mp4 uses solid black (luma)
      const isWebm = path.toLowerCase().endsWith('.webm');
      
      if (isWebm) {
        // Alpha Transparency Overlay
        // shortest=1 ensures the output ends when the main video ends
        filterComplex += `${lastV}[${overlayIndex}:v]overlay=shortest=1:format=auto[v_ovl${i}];[v_ovl${i}]format=yuv420p${nextOut};`;
      } else {
        // Luma/Screen Blending Overlay
        // shortest=1 ensures the blend ends when the shortest stream ends
        filterComplex += `${lastV}[${overlayIndex}:v]blend=all_mode=screen:all_opacity=1:shortest=1[v_blended${i}];[v_blended${i}]format=yuv420p${nextOut};`;
      }
      
      lastV = nextOut;
    });

    // Remove trailing semicolon
    if (filterComplex.endsWith(';')) {
      filterComplex = filterComplex.slice(0, -1);
    }

    command
      .complexFilter(filterComplex, [lastV.replace(/[[\]]/g, '')])
      .outputOptions([
        '-map', '0:a', // Audio from primary video
        '-c:v', 'libx264',
        '-c:a', 'copy', // Do not re-encode audio
        '-crf', '18',
        '-preset', 'fast'
      ])
      .output(outputPath)
      .on('start', (cmdLine) => console.log(`FFmpeg Command: ${cmdLine}`))
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}
