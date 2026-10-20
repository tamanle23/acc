---
name: mediabunny-expert
description: Write efficient, high-performance HTML5 video/audio processing code using the Mediabunny library. Use when the user asks for client-side media conversion, demuxing, video editing, or smooth video playback.
---

# Mediabunny Expert

You are an expert at building web-first media applications using [Mediabunny](https://mediabunny.dev/), a zero-dependency TypeScript library for reading, writing, and converting video and audio files directly in the browser.

## Core Concepts

*   **Tree-shakable & Browser-Native:** Mediabunny is built for the web. It uses WebCodecs for hardware-accelerated encoding/decoding and operates fully client-side without server uploads.
*   **Universal I/O:** It can read/write from memory, disk, network, Canvas, or microphone.
*   **Pipelined Design:** It efficiently processes data by loading only what is needed, enabling high performance (e.g., fast transmuxing and frame extraction).

## Common Workflows

### 1. Reading Metadata & Frame Extraction

When asked to read video metadata or extract specific frames:

```typescript
import { Input, UrlSource, VideoSampleSink } from 'mediabunny';

const input = new Input({
  source: new UrlSource('./video.mp4'),
  // Formats can be customized, e.g., ['.mp4', '.webm']
});

const duration = await input.computeDuration();
const videoTrack = await input.getPrimaryVideoTrack();
const displayWidth = await videoTrack.getDisplayWidth();
const displayHeight = await videoTrack.getDisplayHeight();
const rotation = await videoTrack.getRotation();

// Extract a specific frame (e.g., halfway through)
const sink = new VideoSampleSink(videoTrack);
const frame = await sink.getSample(duration / 2);

// Loop through all frames
for await (const frame of sink.samples()) {
  // Process frame
}
```

### 2. Creating & Converting Media

When asked to convert formats or generate new media programmatically (e.g., from a Canvas stream):

```typescript
import { Input, Output, Conversion, StreamTarget } from 'mediabunny';

// For conversion:
const input = new Input({ /* ... */ });
const output = new Output({
  target: new StreamTarget(writableStream), // Write to disk or network
  // specify formats
});

const conversion = await Conversion.init({ input, output });
await conversion.execute();
```

### 3. Server-side processing (Node.js/Bun)

Mediabunny also works on the server via `@mediabunny/server`.

```typescript
import { registerMediabunnyServer } from '@mediabunny/server';
// Optional: configure hardware context
registerMediabunnyServer();
```

## Gotchas & Best Practices

*   **Always read only what is necessary:** Leverage `Input` methods like `getPrimaryVideoTrack()` to avoid loading unneeded data.
*   **WebCodecs:** Ensure the browser environment supports WebCodecs for optimal performance, as Mediabunny heavily relies on it.
*   **Zero-copy paths:** When on the server, utilize zero-copy GPU paths whenever possible to maintain O(1) memory usage during heavy processing.
*   **Canvas integration:** For video editing, combine Mediabunny with the Canvas API to transform frames before writing them to the output stream.
