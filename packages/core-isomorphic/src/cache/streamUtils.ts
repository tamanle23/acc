import { fastChecksum } from './fastChecksum';
import type { CachePayload } from './types';

/**
 * Universal Isomorphic Stream & Blob Utilities:
 * High-performance, zero-unnecessary-cloning helpers across Web, Web Worker, Node.js, and Bun.
 */

/**
 * Wraps a Uint8Array in a WHATWG ReadableStream<Uint8Array>.
 */
export function uint8ArrayToStream(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

/**
 * Consumes a WHATWG ReadableStream<Uint8Array> into a single contiguous Uint8Array.
 * Uses chunk accumulation with single allocation at the end to minimize memory thrashing.
 */
export async function streamToUint8Array(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        chunks.push(value);
        totalLength += value.byteLength;
      }
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/**
 * Converts a Web standard Blob into a WHATWG ReadableStream<Uint8Array>.
 */
export function blobToStream(blob: Blob): ReadableStream<Uint8Array> {
  if (typeof blob.stream === 'function') {
    return blob.stream();
  }
  // Fallback for polyfilled or mock Blob implementations
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const buffer = await blob.arrayBuffer();
        controller.enqueue(new Uint8Array(buffer));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/**
 * Consumes a WHATWG ReadableStream<Uint8Array> and constructs a Web standard Blob.
 * In browser runtimes, this leverages Blob constructor with array parts directly.
 */
export async function streamToBlob(
  stream: ReadableStream<Uint8Array>,
  mimeType: string = 'application/octet-stream'
): Promise<Blob> {
  const reader = stream.getReader();
  const parts: BlobPart[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        parts.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
      }
    }
  } finally {
    reader.releaseLock();
  }

  return new Blob(parts, { type: mimeType });
}

/**
 * Converts a Web standard Blob into a contiguous Uint8Array.
 */
export async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Computes fast checksum and byte length from a ReadableStream without loading the entire stream into RAM.
 * Returns checksum, size in bytes, and a fresh tee'd ReadableStream identical to original.
 */
export async function computeStreamChecksumAndSize(
  stream: ReadableStream<Uint8Array>
): Promise<{ checksum: string; sizeBytes: number; stream: ReadableStream<Uint8Array> }> {
  const [streamA, streamB] = stream.tee();
  const reader = streamA.getReader();
  let sizeBytes = 0;
  let runningHash = 0x811c9dc5; // 2166136261 (FNV offset basis)

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        sizeBytes += value.byteLength;
        for (let i = 0; i < value.length; i++) {
          runningHash ^= value[i];
          runningHash = Math.imul(runningHash, 0x01000193);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const checksum = (runningHash >>> 0).toString(16).padStart(8, '0');
  return {
    checksum,
    sizeBytes,
    stream: streamB,
  };
}

/**
 * Normalizes any supported CachePayload into a standard Web Blob.
 */
export async function payloadToBlob(
  payload: CachePayload,
  mimeType: string = 'application/octet-stream'
): Promise<Blob> {
  if (payload instanceof Blob) {
    return payload;
  }
  if (payload instanceof ReadableStream) {
    return streamToBlob(payload, mimeType);
  }
  if (typeof payload === 'string') {
    return new Blob([payload], { type: mimeType });
  }
  if (ArrayBuffer.isView(payload)) {
    const view = payload as ArrayBufferView;
    const slice = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
    return new Blob([slice], { type: mimeType });
  }
  if (payload instanceof ArrayBuffer) {
    return new Blob([payload], { type: mimeType });
  }
  return new Blob([payload as any], { type: mimeType });
}

/**
 * Normalizes any supported CachePayload into a WHATWG ReadableStream<Uint8Array>.
 */
export function payloadToStream(payload: CachePayload): ReadableStream<Uint8Array> {
  if (payload instanceof ReadableStream) {
    return payload;
  }
  if (payload instanceof Blob) {
    return blobToStream(payload);
  }
  if (typeof payload === 'string') {
    return uint8ArrayToStream(new TextEncoder().encode(payload));
  }
  if (payload instanceof Uint8Array) {
    return uint8ArrayToStream(payload);
  }
  if (ArrayBuffer.isView(payload)) {
    const view = payload as ArrayBufferView;
    return uint8ArrayToStream(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  }
  if (payload instanceof ArrayBuffer) {
    return uint8ArrayToStream(new Uint8Array(payload));
  }
  return uint8ArrayToStream(new Uint8Array(payload as any));
}

