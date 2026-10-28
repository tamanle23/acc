# WebCodecs Decoder Pooling & Hardware Quota Management

## Overview
Chromium and WebKit strictly enforce a hardware `VideoDecoder` limit of approximately 16 concurrent sessions per renderer process. In non-linear video editors with multi-track timelines, picture-in-picture (PIP), overlays, and rapid video transitions, creating an unrestricted `VideoDecoder` or `CanvasSink` per asset causes `QuotaExceededError` or black frames.

## Architecture & Priority Leasing Pattern

```
                      +---------------------------------------+
                      |       WebCodecsDecoderPool            |
                      |   (Lease Cap: 8 Hardware Decoders)    |
                      +---------------------------------------+
                                     |
               +---------------------+---------------------+
               |                                           |
      [High Priority Lease]                       [Quota Exceeded]
               |                                           |
    +-----------------------+                   +-----------------------+
    | Active VideoDecoder   |                   | Fallback Poster Frame |
    | (Real-time playback)  |                   | (OPFS / Keyframe BMP) |
    +-----------------------+                   +-----------------------+
```

## Implementation Guidelines

### 1. Centralized Lease Pool (`preview.worker.ts`)
Maintain a lease pool that strictly caps concurrent hardware decoders at $\le 8$, leaving headroom for other browser components.

```typescript
export class WebCodecsDecoderPool {
  private activeLeases = new Map<string, MediabunnyWorkerReader>();
  private maxHardwareDecoders = 8;

  public async acquireLease(clipId: string, reader: MediabunnyWorkerReader, priority: number): Promise<boolean> {
    if (this.activeLeases.has(clipId)) return true;

    if (this.activeLeases.size >= this.maxHardwareDecoders) {
      const evicted = this.evictLowestPriority(priority);
      if (!evicted) return false; // Higher-priority clips already occupy all slots
    }

    this.activeLeases.set(clipId, reader);
    return true;
  }

  public releaseLease(clipId: string): void {
    const reader = this.activeLeases.get(clipId);
    if (reader) {
      reader.evictHardwareDecoder();
      this.activeLeases.delete(clipId);
    }
  }
}
```

### 2. Priority Scoring Formula
Evaluate priority whenever playhead frame $F_{\text{playhead}}$ changes:
$$
P(\text{clip}) = \begin{cases}
  10,000 - (\text{trackIndex} \times 100) & \text{if } F_{\text{playhead}} \in [\text{start}, \text{end}] \land \neg \text{track.muted} \\
  1,000 - \frac{|F_{\text{playhead}} - \text{start}|}{\text{FPS}} \times 50 & \text{if within } \pm 3 \text{ seconds} \\
  0 & \text{otherwise}
\end{cases}
$$

### 3. Graceful OPFS Fallback
When a reader is evicted or waiting for a hardware lease:
1. Call `input.dispose()` to immediately free the native GPU context.
2. Read a cached keyframe/poster frame from OPFS via `ContentCacheRegistry.get('opfs')`.
3. Re-acquire a hardware decoder lazily when the playhead approaches the clip.
