# Backlog 041: Inverted Telemetry Ingestion Architecture & Ark UI Fleet Observability

## Metadata
- **ID:** 041
- **Status:** [x] Completed
- **Component:** `apps/ai-supervisor`, `apps/worker`, `packages/proto`
- **Created Date:** 2026-10-25
- **Completed Date:** 2026-10-25
- **Linked History:** [345_inverted_telemetry_ingestion_and_ark_ui_observability.md](../history/345_inverted_telemetry_ingestion_and_ark_ui_observability.md)

---

## Context & Problem
In Iteration 35-36, the AI-Supervisor daemon polled sidecars passively via HTTP/process sampling intervals, while the SolidJS frontend polled the supervisor with 3 distinct `setInterval` loops instead of consuming real-time Server-Sent Events.

To establish enterprise-grade stream telemetry:
1. **Inverted Ingestion**: Sidecars must stream metrics outbound to the supervisor. Python AI backend streams via gRPC server streaming (`StreamTelemetry`), and Worker daemon streams via standard HTTP SSE (`GET /api/worker/telemetry/stream`).
2. **Supervisor SSE Fan-Out**: Supervisor consumes sidecar streams with backoff auto-reconnect, aggregates fleet metrics into dual persistence (in-memory ring buffer + append-only JSONL), and broadcasts to the UI via `GET /api/telemetry/stream`.
3. **Reactive UI & Ark UI Primitives**: SolidJS dashboard connects via native `EventSource` (zero HTTP intervals), renders a live Model Lifecycle & OOM Audit Drawer (`@ark-ui/solid` Drawer), and hosts an interactive Neural TTS Playground (`@ark-ui/solid` Dialog and Slider).

---

## Proposed Design
- **Protobuf**: Define `TelemetryService` in `packages/proto/proto/acc/v1/telemetry.proto` with `rpc StreamTelemetry(TelemetryRequest) returns (stream TelemetryEvent)`.
- **Python Backend**: Implement `TelemetryServiceServicer` in `apps/ai-supervisor/python-backend/src/services/telemetry_service.py` that hooks into `ModelLifecycleManager` and `DeviceMemoryStrategy` to stream VRAM and OOM circuit breaker alerts.
- **Worker Daemon**: Add SSE streaming endpoint `GET /api/worker/telemetry/stream` in `apps/worker/src/`.
- **Supervisor**: Implement `PythonGrpcStreamConsumer` and `WorkerSseStreamConsumer` with exponential backoff (`1s -> 2s -> 5s -> 10s`). Aggregate into `TelemetryEventBroker` and append to `~/.acc/supervisor/audit_events.jsonl`.
- **SolidJS Dashboard**: Remove `setInterval` polling in `supervisorStore.ts`, use native `EventSource`. Implement `AuditDrawer.tsx` and `TtsPlaygroundModal.tsx` using Ark UI primitives.

---

## Acceptance Criteria
- [x] Protobuf contract updated with `StreamTelemetry` and Python stubs generated
- [x] Python backend implements gRPC streaming telemetry with unit test verification
- [x] Worker daemon provides SSE telemetry endpoint (`/api/worker/telemetry/stream`)
- [x] Supervisor implements gRPC client consumer and SSE consumer with backoff reconnection
- [x] Supervisor persists audit events to in-memory ring-buffer and `~/.acc/supervisor/audit_events.jsonl`
- [x] SolidJS dashboard connects via native `EventSource` with zero HTTP polling intervals
- [x] Ark UI Audit Drawer implemented with 5-state matrix and filtering tabs
- [x] Ark UI Neural TTS Playground implemented with Kokoro/VieNeu/Cadence dynamic strategy
- [x] All unit and UI build checks pass cleanly (`pytest`, `bun test`, `bun run build:ui`)
