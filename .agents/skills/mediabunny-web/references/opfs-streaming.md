# OPFS Zero-Copy Streaming with Mediabunny

Pattern for eliminating JavaScript heap exhaustion when demuxing and muxing multi-hundred megabyte or gigabyte video files in modern browser applications.

## Problem: Contiguous In-Memory Bloat
Using `UrlSource` forces continuous network requests on seeks, while `BufferTarget` holds the entire output MP4 in a contiguous `ArrayBuffer`, which crashes the browser tab (OOM) on long 1080p/4K exports.

## Solution: Origin Private File System (OPFS) + Stream Handles
OPFS (`navigator.storage.getDirectory()`) provides fast, persistent, disk-backed storage isolated from user file pickers. Mediabunny natively supports:
1. `BlobSource(file)` for zero-copy slice demuxing.
2. `StreamTarget(writableStream)` for direct-to-disk MP4 muxing.

---

### 1. Direct OPFS Demuxing via `BlobSource`

```typescript
import { Input, BlobSource, CanvasSink } from 'mediabunny';

export async function createOpfsVideoReader(fileName: string) {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('media_cache', { create: true });
  const fileHandle = await dir.getFileHandle(fileName);
  const file = await fileHandle.getFile(); // File inherits from Blob

  // Mediabunny reads byte ranges on-demand from the OS file handle without loading the whole file into RAM
  const input = new Input({
    source: new BlobSource(file),
  });

  const track = await input.getPrimaryVideoTrack();
  return new CanvasSink(track);
}
```

---

### 2. Zero-RAM MP4 Export via `StreamTarget`

```typescript
import { Output, Mp4OutputFormat, StreamTarget, VideoSampleSource, VideoSample } from 'mediabunny';

export async function exportToOpfsScratch(
  width: number,
  height: number,
  fps: number,
  renderFrame: (f: number) => Uint8Array,
  totalFrames: number
): Promise<File> {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('media_cache', { create: true });
  const fileHandle = await dir.getFileHandle(`export_${Date.now()}.mp4`, { create: true });
  const writableStream = await fileHandle.createWritable();

  const videoSource = new VideoSampleSource({
    codec: 'avc',
    width,
    height,
    bitrate: 4_000_000,
  });

  // Muxer streams output bytes directly to disk via FileSystemWritableFileStream
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new StreamTarget(writableStream),
  });

  output.addVideoTrack(videoSource);
  await output.start();

  for (let f = 0; f < totalFrames; f++) {
    const rgba = renderFrame(f);
    const sample = new VideoSample(rgba, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: f / fps,
      duration: 1 / fps,
    });
    await videoSource.add(sample);
    sample.close(); // Mandatory GPU memory release
  }

  await output.finalize();

  // Return zero-copy File handle (can be downloaded directly via URL.createObjectURL(file))
  return await fileHandle.getFile();
}
```
