---
name: nle-memory-optimization
description: Analyze and optimize native memory for in-browser canvas and WebCodecs applications. Use when the user builds video editors, NLEs, or media pipelines, or when debugging large memory leaks caused by unclosed VideoFrames, ImageBitmaps, or OffscreenCanvas instances.
---
# Native Memory Management for Web NLEs

When auditing or building in-browser Non-Linear Editors (NLEs) or media pipelines using WebCodecs and HTML5 Canvas, the standard V8 garbage collector is insufficient for native memory buffers, often causing massive memory leaks (e.g., 2GB+ footprint with only 256MB JS heap).

## When to Use This Skill
- The user is building a video rendering engine, timeline scrubber, or in-browser NLE.
- The user reports large memory discrepancies between Chrome Task Manager (native footprint) and DevTools JS Heap.
- The workflow involves `VideoFrame`, `ImageBitmap`, `OffscreenCanvas`, or `ImageData`.

## Core Audit & Refactor Steps

1. **Explicit Frame Disposal (`.close()`)**
   - You must NOT rely on standard garbage collection for media frames.
   - Refactor code to explicitly call `.close()` on every `VideoFrame` and `ImageBitmap` the exact moment `ctx.drawImage()` completes and the frame is no longer needed for the current render tick.

2. **Scrubbing Cache Management**
   - For timeline scrubbing, implement a strict size-capped Least Recently Used (LRU) cache.
   - Ensure that whenever a frame is evicted or overwritten in the cache, its `.close()` method is synchronously and automatically executed to free the native buffer.

3. **OffscreenCanvas Pooling**
   - Do NOT instantiate a new `OffscreenCanvas` per frame during sequence node compositing.
   - Maintain a persistent pool of worker canvases and reuse them using `ctx.clearRect(0, 0, width, height)`.

4. **ImageData Scoping**
   - If using `ctx.getImageData()` for pixel manipulation (color grading, blending), ensure the massive `Uint8ClampedArray` buffers are strictly scoped to the function block and not unintentionally retained in closures or outer arrays.

## Gotchas
- V8 GC delay: A JS wrapper for a `VideoFrame` is tiny, so V8 won't feel memory pressure to GC it, while the attached uncompressed C++ bitmap explodes native RAM.
- Retained Size: To prove leaks in DevTools, instruct the user to take a Heap Snapshot, filter by `VideoFrame` or `ImageBitmap`, and look at the "Retained Size" rather than "Shallow Size".