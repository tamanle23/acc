---
name: mediabunny-server
description: Process video and audio on the server using Mediabunny in Node.js and Bun runtimes. Use when building backend media processing pipelines, hardware-accelerated transcoding, video clipping/stitching workers, audio extraction, or filesystem stream transformations with @mediabunny/server.
---
# Mediabunny Server

A specialized skill for engineering high-performance, server-side media processing pipelines and background workers using Mediabunny (`@mediabunny/server`) in Node.js and Bun environments.

## When to Use This Skill

- Building backend video/audio transformation APIs and batch conversion workers.
- Implementing zero-copy GPU transcoding and hardware-accelerated pipelines on the server.
- Processing media directly from local filesystems, temp storage, or object storage streams (S3, Cloudflare R2).
- Performing high-throughput video demuxing, clipping, concatenation, and audio track extraction in background jobs.

---

## 1. Runtime Initialization & Registration

Mediabunny requires registering server-side platform bindings before processing media:

```typescript
import { registerMediabunnyServer } from '@mediabunny/server';

// Register hardware context and platform primitives for Node.js / Bun
registerMediabunnyServer({
  // Configure hardware acceleration preferences if available (e.g., VAAPI, NVENC, VideoToolbox)
});
```

---

## 2. Server I/O & Filesystem Streaming

Avoid buffering whole multi-gigabyte video files into RAM. Always use streaming sources and targets to maintain $O(1)$ memory consumption:

```typescript
import { Input, Output, Conversion, StreamTarget } from 'mediabunny';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable, Writable } from 'node:stream';

export async function transcodeFile(inputPath: string, outputPath: string) {
  const nodeReadStream = createReadStream(inputPath);
  const webReadable = Readable.toWeb(nodeReadStream) as ReadableStream<Uint8Array>;

  const input = new Input({
    source: webReadable,
    formats: ['.mp4', '.mov', '.mkv', '.webm']
  });

  const nodeWriteStream = createWriteStream(outputPath);
  const webWritable = Writable.toWeb(nodeWriteStream) as WritableStream<Uint8Array>;

  const output = new Output({
    target: new StreamTarget(webWritable),
    format: '.mp4'
  });

  const conversion = await Conversion.init({
    input,
    output,
    video: {
      codec: 'avc', // H.264
      bitrate: 4_000_000
    },
    audio: {
      codec: 'aac',
      bitrate: 192_000
    }
  });

  await conversion.execute();
}
```

---

## 3. High-Performance Frame Extraction & Analysis

Extract individual frames or thumbnails without demuxing or decoding the full stream:

```typescript
import { Input, VideoSampleSink } from 'mediabunny';
import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';

export async function extractThumbnailSample(filePath: string, timestampSeconds: number) {
  const readStream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
  const input = new Input({ source: readStream });

  const duration = await input.computeDuration();
  const videoTrack = await input.getPrimaryVideoTrack();

  const sink = new VideoSampleSink(videoTrack);
  const sample = await sink.getSample(Math.min(timestampSeconds, duration));

  return sample;
}
```

---

## 4. Best Practices & Production Architecture

- **Zero-Copy Memory Model:** Use pipeable streams and bypass intermediate array buffers. This prevents out-of-memory (OOM) fatal crashes in containerized workers (Docker/Kubernetes).
- **Concurrency & Worker Threads:** Heavy media transcoding tasks should be offloaded to Node.js `worker_threads` or isolated child processes so the main event loop remains responsive for incoming API requests.
- **Graceful Cancellation:** Implement `AbortController` signal propagation through `Conversion.init({ ..., signal: abortController.signal })` to immediately release file handles and system resources if a client disconnects or a job times out.
