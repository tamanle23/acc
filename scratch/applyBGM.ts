export function applyBGM(
  inputVideo: string,
  bgmConfig: BGMSettings,
  outputPath: string,
  baseDir: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const bgmPath = path.isAbsolute(bgmConfig.source) ? bgmConfig.source : path.resolve(baseDir, bgmConfig.source);
    if (!fs.existsSync(bgmPath)) {
      console.warn(`[BGM] Warning: Không tìm thấy file nhạc nền tại ${bgmPath}. Bỏ qua BGM.`);
      fs.copyFileSync(inputVideo, outputPath);
      return resolve();
    }

    const volume = bgmConfig.volume !== undefined ? bgmConfig.volume : 0.1;
    const isLoop = bgmConfig.loop !== false;
    const fadeIn = bgmConfig.fadeIn || 0;
    const fadeOut = bgmConfig.fadeOut !== undefined ? bgmConfig.fadeOut : 2;

    let command = ffmpeg().input(inputVideo);

    if (isLoop) {
      command = command.inputOption('-stream_loop', '-1');
    }
    command = command.input(bgmPath);

    let audioFilter = `[1:a]volume=${volume}`;
    if (fadeIn > 0) {
      audioFilter += `,afade=t=in:st=0:d=${fadeIn}`;
    }
    // We can't easily do fadeOut from the end without knowing the exact duration in filter,
    // but we can use amix with duration=first (video duration) which cuts the audio.
    // Actually afade=t=out requires start time. If we don't know the exact duration, we can skip fade out for now,
    // or just rely on duration=first which makes a hard cut.
    // A better approach for fade out is to apply it if we know the video duration.
    // For now, let's just use amix.

    filterComplex = `${audioFilter}[bgm_processed];[0:a][bgm_processed]amix=inputs=2:duration=first:dropout_transition=2[a_out]`;

    command
      .complexFilter(filterComplex)
      .outputOptions([
        '-map 0:v',
        '-map [a_out]',
        '-c:v copy',
        '-c:a aac',
        '-b:a 192k'
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => {
        console.error(`[BGM] Lỗi mix nhạc nền:`, err);
        reject(err);
      })
      .run();
  });
}
