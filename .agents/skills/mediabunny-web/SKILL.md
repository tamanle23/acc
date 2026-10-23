---
name: mediabunny-web
description: Build client-side browser video and audio applications using Mediabunny. Use when implementing in-browser video editing, WebCodecs decoding and encoding, HTML5 Canvas frame manipulation, audio waveform processing, Blob/UrlSource conversion, or smooth client-side media playback.
---
# Mediabunny Web Client

A specialized skill for building high-performance, browser-native media editing, playback, and conversion applications with Mediabunny using WebCodecs and modern Web APIs.

## When to Use This Skill

- Implementing in-browser video editors, trimming tools, and composition timelines.
- Processing, transforming, or watermarking video frames in real time using HTML5 Canvas and `OffscreenCanvas`.
- Transmuxing or converting video/audio client-side without sending media to a backend server.
- Extracting video thumbnails, keyframes, and audio waveforms directly in the browser.
- Recording canvas animations or WebRTC streams into downloadable MP4/WebM files.

---

## 1. Core Browser Concepts & Architecture

- **WebCodecs Acceleration:** Leverages browser-native hardware acceleration for video decoding (`VideoDecoder`) and encoding (`VideoEncoder`).
- **Zero Server Overhead:** All processing runs entirely on the client machine via Web Workers, Web Streams, and WebCodecs.
- **Progressive Demuxing:** Mediabunny inspects and reads only necessary atoms/boxes (e.g. `moov`), avoiding the need to buffer massive video files into browser memory.

---

## 2. In-Browser Frame Extraction & Canvas Pipeline

Extracting frames and manipulating them directly onto an HTML5 `<canvas>` or `OffscreenCanvas`:

```typescript
import { Input, UrlSource, VideoSampleSink } from 'mediabunny';

export async function renderFrameAtTimestamp(
  videoUrl: string,
  timestampSeconds: number,
  canvas: HTMLCanvasElement
) {
  const input = new Input({
    source: new UrlSource(videoUrl)
  });

  const videoTrack = await input.getPrimaryVideoTrack();
  const width = await videoTrack.getDisplayWidth();
  const height = await videoTrack.getDisplayHeight();

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');

  const sink = new VideoSampleSink(videoTrack);
  const sample = await sink.getSample(timestampSeconds);

  if (sample) {
    // sample.frame is a browser VideoFrame
    ctx.drawImage(sample.frame, 0, 0, width, height);
    sample.frame.close(); // Crucial: Always close VideoFrame to prevent GPU memory leaks
  }
}
```

---

## 3. Client-Side Format Conversion (Transmuxing)

Convert uploaded video files (e.g. WebM/MOV to MP4) entirely inside the user's browser using `BlobSource` and `BufferTarget`:

```typescript
import { Input, Output, Conversion, BlobSource, BufferTarget } from 'mediabunny';

export async function convertBlobToMp4(
  inputBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const input = new Input({
    source: new BlobSource(inputBlob)
  });

  const output = new Output({
    target: new BufferTarget(),
    format: '.mp4'
  });

  const conversion = await Conversion.init({
    input,
    output,
    video: { codec: 'avc' },
    audio: { codec: 'aac' }
  });

  if (onProgress) {
    conversion.on('progress', onProgress);
  }

  await conversion.execute();

  const buffer = (output.target as BufferTarget).getBuffer();
  return new Blob([buffer], { type: 'video/mp4' });
}
```

---

## 4. Browser Memory & Performance Safeguards

- **`VideoFrame` Resource Management:** Every `VideoFrame` created by WebCodecs holds GPU/VRAM texture references. Always call `frame.close()` as soon as rendering or processing completes.
- **Web Workers:** Run all heavy demuxing and conversion logic inside a dedicated Web Worker to maintain 60 FPS UI responsiveness on the main thread.
- **Feature Detection:** Verify browser support for WebCodecs before initializing the pipeline:
  ```typescript
  export function isWebCodecsSupported(): boolean {
    return typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoDecoder' in window;
  }
  ```
