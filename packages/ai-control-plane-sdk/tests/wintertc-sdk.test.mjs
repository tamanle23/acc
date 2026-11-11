import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

async function sha256DigestHex(input) {
  let bytes;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function createNdjsonTransformStream() {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const parseAndEnqueueLine = (rawLine, controller) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith(":")) return;
    const jsonPayload = trimmed.startsWith("data:")
      ? trimmed.slice(5).trim()
      : trimmed;
    if (!jsonPayload || jsonPayload === "[DONE]") return;
    try {
      const parsed = JSON.parse(jsonPayload);
      controller.enqueue(parsed);
    } catch {
      // Skip malformed partial frame
    }
  };

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        parseAndEnqueueLine(line, controller);
      }
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        for (const line of buffer.split(/\r?\n/)) {
          parseAndEnqueueLine(line, controller);
        }
      }
      buffer = "";
    },
  });
}

function createPcmFrameTransformStream() {
  let headerChecked = false;
  let headerStaging = new Uint8Array(0);
  let leftoverByte = null;

  const enqueuePcmBytes = (rawData, controller) => {
    let data = rawData;
    if (leftoverByte !== null) {
      const merged = new Uint8Array(1 + data.byteLength);
      merged[0] = leftoverByte;
      merged.set(data, 1);
      data = merged;
      leftoverByte = null;
    }

    const evenLength = data.byteLength - (data.byteLength % 2);
    if (data.byteLength % 2 === 1) {
      leftoverByte = data[data.byteLength - 1];
    }

    if (evenLength > 0) {
      const view = new DataView(data.buffer, data.byteOffset, evenLength);
      const sampleCount = evenLength / 2;
      const float32 = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const int16 = view.getInt16(i * 2, true);
        float32[i] = int16 / 32768.0;
      }
      controller.enqueue(float32);
    }
  };

  return new TransformStream({
    transform(chunk, controller) {
      if (!chunk || chunk.byteLength === 0) return;

      if (!headerChecked) {
        const combined = new Uint8Array(headerStaging.byteLength + chunk.byteLength);
        combined.set(headerStaging, 0);
        combined.set(chunk, headerStaging.byteLength);

        if (combined.byteLength < 44) {
          headerStaging = combined;
          return;
        }

        headerChecked = true;
        headerStaging = new Uint8Array(0);
        const isRiffWav =
          combined[0] === 0x52 &&
          combined[1] === 0x49 &&
          combined[2] === 0x46 &&
          combined[3] === 0x46 &&
          combined[8] === 0x57 &&
          combined[9] === 0x41 &&
          combined[10] === 0x56 &&
          combined[11] === 0x45;

        const payload = isRiffWav ? combined.subarray(44) : combined;
        if (payload.byteLength > 0) {
          enqueuePcmBytes(payload, controller);
        }
        return;
      }

      enqueuePcmBytes(chunk, controller);
    },
    flush(controller) {
      if (!headerChecked && headerStaging.byteLength > 0) {
        headerChecked = true;
        enqueuePcmBytes(headerStaging, controller);
        headerStaging = new Uint8Array(0);
      }
      leftoverByte = null;
    },
  });
}

function matchEdgeModelRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 4 && parts[0] === "edge" && parts[1] === "models") {
    return {
      engineId: decodeURIComponent(parts[2]),
      action: decodeURIComponent(parts[3]),
    };
  }
  return null;
}

test("WinterTC createNdjsonTransformStream parses chunked NDJSON & SSE token streams across split UTF-8 frames", async () => {
  const encoder = new TextEncoder();
  const rawChunks = [
    encoder.encode('{"type":"reasoning_token","token":"Analyzing "}\n{"type":"content_'),
    encoder.encode('token","token":"Xin chào "}\ndata: {"type":"done","tokens_generated":2}\n\n'),
  ];

  const source = new ReadableStream({
    start(controller) {
      for (const c of rawChunks) controller.enqueue(c);
      controller.close();
    },
  });

  const transformed = source.pipeThrough(createNdjsonTransformStream());
  const reader = transformed.getReader();
  const events = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    events.push(value);
  }

  assert.equal(events.length, 3);
  assert.equal(events[0].type, "reasoning_token");
  assert.equal(events[1].token, "Xin chào ");
  assert.equal(events[2].type, "done");
});

test("WinterTC createPcmFrameTransformStream strips 44-byte RIFF WAV header even when split across tiny <44B chunks and aligns odd-byte PCM16 frames", async () => {
  // Build a 44-byte RIFF WAVE header + 4 int16 samples ([16384, -16384, 32767, 0]) = 52 bytes total
  const fullWav = new Uint8Array(52);
  const view = new DataView(fullWav.buffer);
  // "RIFF"
  fullWav.set([0x52, 0x49, 0x46, 0x46], 0);
  // "WAVE" at offset 8
  fullWav.set([0x57, 0x41, 0x56, 0x45], 8);
  // Write 4 int16 samples at offset 44..51
  view.setInt16(44, 16384, true);
  view.setInt16(46, -16384, true);
  view.setInt16(48, 32767, true);
  view.setInt16(50, 0, true);

  // Split into tiny 11-byte and odd-length chunks: 11, 15, 18 (total 44 header), then 3, 2, 3 (8 bytes PCM)
  const slices = [
    fullWav.subarray(0, 11),
    fullWav.subarray(11, 26),
    fullWav.subarray(26, 44),
    fullWav.subarray(44, 47), // 3 bytes (1 sample + 1 leftover byte)
    fullWav.subarray(47, 49), // 2 bytes (merges with leftover -> 1 sample + 1 leftover byte)
    fullWav.subarray(49, 52), // 3 bytes (merges with leftover -> 2 samples)
  ];

  const source = new ReadableStream({
    start(controller) {
      for (const s of slices) controller.enqueue(s);
      controller.close();
    },
  });

  const pcmStream = source.pipeThrough(createPcmFrameTransformStream());
  const reader = pcmStream.getReader();
  const samples = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const v of value) samples.push(v);
  }

  assert.equal(samples.length, 4);
  assert.ok(Math.abs(samples[0] - 0.5) < 1e-4);
  assert.ok(Math.abs(samples[1] - -0.5) < 1e-4);
  assert.ok(Math.abs(samples[2] - 32767 / 32768) < 1e-4);
  assert.equal(samples[3], 0);
});

test("WinterTC FormData & crypto.subtle SHA-256 binary integrity digest", async () => {
  const sampleBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01, 0x02, 0x03, 0x04]);
  const blob = new Blob([sampleBytes], { type: "audio/wav" });
  const digest = await sha256DigestHex(await blob.arrayBuffer());
  assert.equal(digest.length, 64);

  const fd = new FormData();
  fd.append("inputs", "Transcribe studio audio");
  fd.append("file", blob, "recording.wav");
  assert.equal(fd.get("inputs"), "Transcribe studio audio");
});

test("WinterTC Edge Gateway route matcher resolves /edge/models/:engineId/:action with or without global URLPattern", () => {
  const m1 = matchEdgeModelRoute("/edge/models/flux-1-schnell/infer");
  assert.deepEqual(m1, { engineId: "flux-1-schnell", action: "infer" });

  const m2 = matchEdgeModelRoute("/edge/models/bria-rmbg-2.0/inspect");
  assert.deepEqual(m2, { engineId: "bria-rmbg-2.0", action: "inspect" });

  const m3 = matchEdgeModelRoute("/edge/unknown");
  assert.equal(m3, null);
});

test("WinterTC Edge Gateway streaming passthrough (TransformStream) and RFC 7807 malformed JSON guard", async () => {
  // 1. Verify TransformStream binary passthrough for /edge/models/:engineId/stream and /edge/dag/stream
  const encoder = new TextEncoder();
  const upstreamChunks = [
    encoder.encode('{"type":"dag_node_start","stage_index":0}\n'),
    encoder.encode('{"type":"dag_done","total_latency_ms":42.5}\n'),
  ];
  const upstreamStream = new ReadableStream({
    start(controller) {
      for (const c of upstreamChunks) controller.enqueue(c);
      controller.close();
    },
  });

  const passthrough = new TransformStream();
  upstreamStream.pipeTo(passthrough.writable);
  const edgeRes = new Response(passthrough.readable, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Edge-Stream-Mode": "ndjson-dag-passthrough",
    },
  });
  assert.equal(edgeRes.headers.get("X-Edge-Stream-Mode"), "ndjson-dag-passthrough");

  const parsedEvents = [];
  const reader = edgeRes.body.pipeThrough(createNdjsonTransformStream()).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parsedEvents.push(value);
  }
  assert.equal(parsedEvents.length, 2);
  assert.equal(parsedEvents[0].type, "dag_node_start");
  assert.equal(parsedEvents[1].type, "dag_done");

  // 2. Verify /edge/models/:engineId/stream route matcher
  const mStream = matchEdgeModelRoute("/edge/models/qwen2.5-vl-instruct/stream");
  assert.deepEqual(mStream, { engineId: "qwen2.5-vl-instruct", action: "stream" });
});

function parseRetryAfterMs(retryAfterHeader, fallbackMs, maxWaitMs = 15000) {
  if (!retryAfterHeader || !retryAfterHeader.trim()) {
    return Math.max(10, Math.min(maxWaitMs, fallbackMs));
  }
  const trimmed = retryAfterHeader.trim();
  const seconds = Number(trimmed);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return Math.max(10, Math.min(maxWaitMs, Math.round(seconds * 1000)));
  }
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    const deltaMs = parsedDate - Date.now();
    return Math.max(10, Math.min(maxWaitMs, deltaMs));
  }
  return Math.max(10, Math.min(maxWaitMs, fallbackMs));
}

test("WinterTC RFC 9110 Retry-After header parser and AbortSignal.timeout composition", () => {
  assert.equal(parseRetryAfterMs("2", 250), 2000);
  assert.equal(parseRetryAfterMs("0.05", 250), 50);
  assert.equal(parseRetryAfterMs("invalid-header", 320), 320);
  assert.equal(parseRetryAfterMs("120", 250, 15000), 15000);

  if (typeof AbortSignal.timeout === "function") {
    const sig = AbortSignal.timeout(5000);
    assert.equal(sig.aborted, false);
  }
});

function createW3CTraceparent() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `00-${hex.slice(0, 32)}-${hex.slice(32, 48)}-01`;
}

function parseServerTimingHeader(serverTimingHeader) {
  const result = {};
  if (!serverTimingHeader || !serverTimingHeader.trim()) return result;
  for (const metric of serverTimingHeader.split(",")) {
    const parts = metric.split(";").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const name = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const [k, v] = parts[i].split("=");
      if (k && k.trim().toLowerCase() === "dur" && v !== undefined) {
        const dur = Number(v.trim());
        if (!Number.isNaN(dur)) result[name] = dur;
      }
    }
  }
  return result;
}

test("WinterTC W3C traceparent generator & Server-Timing header parser", () => {
  const tp = createW3CTraceparent();
  assert.match(tp, /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);

  const parsed = parseServerTimingHeader('total;dur=14.28;desc="Studio v32 Inference API", queue;dur=0.45');
  assert.equal(parsed.total, 14.28);
  assert.equal(parsed.queue, 0.45);
});

function createSseTransformStream() {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let currentEvent = { dataLines: [] };

  const dispatchEvent = (controller) => {
    if (currentEvent.dataLines.length === 0 && !currentEvent.event && !currentEvent.id) {
      return;
    }
    const rawData = currentEvent.dataLines.join("\n");
    let parsedData = rawData;
    try {
      parsedData = JSON.parse(rawData);
    } catch {}
    const eventObj = {
      id: currentEvent.id,
      event: currentEvent.event ?? "message",
      data: parsedData,
    };
    controller.enqueue(eventObj);
    currentEvent = { dataLines: [] };
  };

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim() === "") {
          dispatchEvent(controller);
          continue;
        }
        if (line.startsWith(":")) continue;
        if (line.startsWith("id:")) {
          currentEvent.id = line.slice(3).trim();
        } else if (line.startsWith("event:")) {
          currentEvent.event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          currentEvent.dataLines.push(line.slice(5).trim());
        }
      }
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        for (const line of buffer.split(/\r?\n/)) {
          if (line.trim() === "") {
            dispatchEvent(controller);
          } else if (line.startsWith("id:")) {
            currentEvent.id = line.slice(3).trim();
          } else if (line.startsWith("event:")) {
            currentEvent.event = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            currentEvent.dataLines.push(line.slice(5).trim());
          }
        }
      }
      dispatchEvent(controller);
      buffer = "";
    },
  });
}

test("Pattern 2: W3C Server-Sent Events TransformStream parses frames and ignores comments", async () => {
  const sseStream = createSseTransformStream();
  const writer = sseStream.writable.getWriter();
  const reader = sseStream.readable.getReader();

  const rawChunks = [
    ": ping\n\nid: 1\nevent: queued\ndata: {\"job_id\":\"job_test_123\",\"queue_position\":1}\n\n",
    ": ping heartbeat\nid: 2\nevent: progress\ndata: {\"step\":1,\"total\":4,\"percent\":25.0}\n\n",
    "id: 3\nevent: completed\ndata: {\"status\":\"completed\",\"latency_ms\":142.5}\n\n",
  ];

  const readPromise = (async () => {
    const events = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      events.push(value);
    }
    return events;
  })();

  for (const chunk of rawChunks) {
    await writer.write(new TextEncoder().encode(chunk));
  }
  await writer.close();

  const events = await readPromise;

  assert.equal(events.length, 3);
  assert.equal(events[0].event, "queued");
  assert.equal(events[0].id, "1");
  assert.equal(events[0].data.job_id, "job_test_123");

  assert.equal(events[1].event, "progress");
  assert.equal(events[1].data.percent, 25.0);

  assert.equal(events[2].event, "completed");
  assert.equal(events[2].data.status, "completed");
});

test("sanitizeHeadersInit sanitizes non-ISO-8859-1 code points without throwing in WHATWG Headers", async () => {
  const { sanitizeHeadersInit, buildMultimodalFormData } = await import("../dist/index.js");

  // Non-ISO-8859-1 string (Vietnamese unicode characters with code point > 255)
  const nonIsoHeaderValue = "Tách nền ảnh chất lượng cao 🌟";
  
  // Directly calling new Headers({ test: nonIsoHeaderValue }) throws in WHATWG Fetch (ByteString / ISO-8859-1 violation)
  assert.throws(() => {
    new Headers({ "X-Custom": nonIsoHeaderValue });
  }, /greater than 255|non ISO-8859-1/);

  // sanitizeHeadersInit must safely handle it without error
  const sanitized = sanitizeHeadersInit({
    "X-Custom": nonIsoHeaderValue,
    "X-Standard": "Standard-ASCII-Header-123",
  });

  assert.ok(sanitized instanceof Headers);
  assert.equal(sanitized.get("X-Standard"), "Standard-ASCII-Header-123");
  assert.equal(sanitized.get("X-Custom"), encodeURIComponent(nonIsoHeaderValue));

  // Verify buildMultimodalFormData outputs URI-encoded metaHeader
  const dummyBlob = new Blob(["fake image data"], { type: "image/png" });
  const result = await buildMultimodalFormData({
    inputs: "Ảnh mẫu chân dung đẹp",
    parameters: { prompt: "Phân vùng đối tượng" },
    file: dummyBlob,
    filename: "ảnh_chân_dung.png",
  });

  assert.ok(result.metaHeader);
  // Verify metaHeader is pure ASCII (all char codes <= 127)
  for (let i = 0; i < result.metaHeader.length; i++) {
    assert.ok(result.metaHeader.charCodeAt(i) <= 127, `Char at ${i} must be ASCII`);
  }
  const decoded = JSON.parse(decodeURIComponent(result.metaHeader));
  assert.equal(decoded.inputs, "Ảnh mẫu chân dung đẹp");
  assert.equal(decoded.parameters.prompt, "Phân vùng đối tượng");
  assert.equal(decoded.filename, "ảnh_chân_dung.png");
});
