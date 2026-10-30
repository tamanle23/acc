---
name: wintertc-web-api
description: Architect, implement, audit, and refactor portable, runtime-agnostic TypeScript and JavaScript server and edge software conforming to the WinterTC Minimum Common Web Platform API (ECMA-429). Use when writing isomorphic HTTP handlers, edge middleware, stream pipelines, cryptography utilities, or universal libraries targeting Node.js, Deno, Bun, Cloudflare Workers, Fastly Compute, and Service Workers without runtime-specific APIs or legacy polyfills.
---

# wintertc-web-api

A skill for developing, reviewing, and modernizing runtime-agnostic JavaScript and TypeScript code targeting the WinterTC Minimum Common Web Platform API (ECMA-429 standard).

## When to Use

- Writing universal server or edge libraries intended to run unchanged across Node.js, Bun, Deno, Cloudflare Workers, Fastly Compute, and browsers.
- Building HTTP handlers or middleware using Web-standard Request, Response, and URLPattern instead of runtime-specific primitives (like Node http.IncomingMessage or Express).
- Refactoring legacy Node.js code away from proprietary modules (crypto, stream, buffer, node-fetch) toward Web Platform standards.
- Auditing existing packages for hidden runtime dependencies or non-standard global usage.
- Designing high-throughput streaming pipelines with WHATWG Streams (ReadableStream, WritableStream, TransformStream, CompressionStream).

## Conformance Surface (ECMA-429 Baseline)

Only rely on standard globals mandated by the Minimum Common Web Platform API:

- **HTTP and Fetch**: fetch(), Request, Response, Headers, FormData
- **URLs and Routing**: URL, URLSearchParams, URLPattern
- **Streams and Encoding**: ReadableStream, WritableStream, TransformStream, ByteLengthQueuingStrategy, CountQueuingStrategy, CompressionStream, DecompressionStream, TextEncoder, TextDecoder, TextEncoderStream, TextDecoderStream
- **Binary and Files**: Blob, File
- **Cryptography**: crypto (Crypto), SubtleCrypto, CryptoKey, crypto.randomUUID(), crypto.getRandomValues()
- **Lifecycle and Cancellation**: AbortController, AbortSignal, Event, EventTarget, CustomEvent, ErrorEvent, PromiseRejectionEvent
- **Timers and Scheduling**: setTimeout(), clearTimeout(), setInterval(), clearInterval(), queueMicrotask()
- **Structured Data and Messaging**: structuredClone(), MessageChannel, MessagePort, MessageEvent
- **Diagnostics and Performance**: console, performance (performance.now(), performance.timeOrigin), DOMException
- **Utilities and WebAssembly**: atob(), btoa(), navigator.userAgent, WebAssembly

## Core Workflow

### 1. Enforce Web Standard Request and Response Signatures

Design all server handlers to accept a WHATWG Request and return a WHATWG Response (or a Promise resolving to one).

```typescript
export interface AgnosticHandlerContext {
  params?: Record<string, string>;
  signal?: AbortSignal;
}

export type AgnosticHandler = (
  request: Request,
  context?: AgnosticHandlerContext
) => Promise<Response> | Response;
```

### 2. Standard URL Routing with URLPattern

Avoid third-party path-matching regex libraries when URLPattern is available.

```typescript
const userRoute = new URLPattern({ pathname: "/api/users/:id" });

export function matchAndHandle(request: Request): Response | null {
  const match = userRoute.exec(request.url);
  if (!match) return null;

  const userId = match.pathname.groups.id;
  return Response.json({ id: userId, status: "active" });
}
```

### 3. Native Streaming over Node Streams or Buffers

Never import stream or buffer. Use standard WHATWG Streams and Uint8Array.

```typescript
export function createUppercasePipeline(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      controller.enqueue(encoder.encode(text.toUpperCase()));
    },
    flush(controller) {
      const remaining = decoder.decode();
      if (remaining.length > 0) {
        controller.enqueue(encoder.encode(remaining.toUpperCase()));
      }
    }
  });
}
```

### 4. Portable Cryptography

Use crypto.subtle instead of Node's node:crypto.

```typescript
export async function sha256DigestHex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
```

### 5. Multi-Runtime Adapters

When packaging for deployment, supply thin runtime bridges rather than branching logic in business code:

- **Bun and Deno**: Pass the agnostic handler directly to Bun.serve({ fetch: handler }) or Deno.serve(handler).
- **Node.js**: Adapt using @whatwg-node/server or node:http bridge via Readable.toWeb() and Response streaming.
- **Cloudflare Workers**: Direct export: export default { fetch: handler }.

## Gotchas

- **Do Not Rely on process or Buffer**: Globals like process.env and Buffer do not exist in standard WinterTC isolates. Use Uint8Array for binary data and inject configuration via constructor arguments or context parameters.
- **Node globalThis is not an EventTarget**: Do not assume globalThis.addEventListener(...) works identically across environments. While browsers and Deno allow attaching listeners to globalThis, Node.js emits process-level events on process.
- **Avoid Filesystem Access in Core Code**: The WinterTC baseline intentionally excludes filesystem APIs (node:fs, Deno.readTextFile). Separate storage abstractions behind an interface so implementations can use KV, S3, or local disk as needed.
- **Opaque User Agents**: Do not write user-agent sniffers assuming browser-style tokens. WinterTC specifies simple product tokens like Deno or Cloudflare-Workers.
- **Request Clones for Body Re-reads**: A Request or Response body is a single-use stream. If you must read a body multiple times (e.g. for signature validation and JSON parsing), call request.clone() before reading.
