# FFmpeg Manager Rule

**Whenever you need to invoke `ffmpeg` or `ffprobe`, you MUST adhere to the `FFmpegManager` protocol to ensure cross-platform compatibility and handle environments without pre-installed dependencies.**

### 1. Initialization
In any entrypoint or CLI script (`cli.ts`, etc.), you MUST initialize the manager before any processing occurs:
```typescript
import { FFmpegManager } from './src/core/FFmpegManager';

async function main() {
  await FFmpegManager.prepare(); // Checks, downloads (if needed), and sets up paths
  // ... rest of the CLI logic
}
```

### 2. fluent-ffmpeg Integration
If you are using the `fluent-ffmpeg` package, you MUST inject the binary paths explicitly immediately after `prepare()` is guaranteed to have finished, typically before invoking the builder:
```typescript
import ffmpeg from 'fluent-ffmpeg';
import { FFmpegManager } from './core/FFmpegManager';

ffmpeg.setFfmpegPath(FFmpegManager.getFFmpegPath());
ffmpeg.setFfprobePath(FFmpegManager.getFFprobePath());
```

### 3. Native Shell Execution (`child_process`)
If you are spawning or executing `ffmpeg` via raw shell commands (`exec`, `execSync`, `spawn`), you MUST dynamically retrieve the path and properly quote it:
```typescript
import { FFmpegManager } from './core/FFmpegManager';

// WRONG: const cmd = 'ffmpeg -i input.mp4 output.mkv';
// RIGHT:
const ffmpegPath = FFmpegManager.getFFmpegPath();
const cmd = `"${ffmpegPath}" -i input.mp4 output.mkv`;
execSync(cmd);
```

### Rationale
The `FFmpegManager` automatically downloads GPU-enabled (NVENC/QSV) GPL builds of FFmpeg on Windows if the user doesn't have it installed. Bypassing this manager will cause `ENOENT` crashes on fresh machines and break the "Zero-Config" philosophy of the storytelling generator.
