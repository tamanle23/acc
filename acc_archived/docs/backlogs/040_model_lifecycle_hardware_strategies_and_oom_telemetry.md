# Backlog 040: Enterprise Model Lifecycle, Hardware Memory Strategies & OOM Telemetry Audit Plane

**Status:** `[x] Completed`  
**Component:** `apps/ai-supervisor` (python-backend & control plane)  
**Created Date:** 2026-10-25  
**Completed Date:** 2026-10-25  
**Linked History:** [`343_enterprise_model_lifecycle_and_oom_telemetry.md`](../history/343_enterprise_model_lifecycle_and_oom_telemetry.md)  

---

## 1. Context & Problem Statement
The ACC desktop fleet utilizes a unified Python backend (`apps/ai-supervisor/python-backend`) providing local neural services (TTS, LLM, and future embedding/vision models) managed via gRPC. 
Currently:
1. **Memory Isolation & Hardware Acceleration**: Memory management is coupled to NVIDIA CUDA checks only, failing to handle Apple Silicon MPS accelerators (`torch.mps`) or host RAM constraints cleanly.
2. **OOM & Eviction Synchronicity**: Model evictions and cache clears hold coarse locks across blocking operations. There is no formal Reader-Writer synchronization or OOM Circuit Breaker, leading to daemon crashes or thread stalls under high concurrency.
3. **Audit & Observability Gap**: The supervisor UI lacks structured telemetry audit trails for model life events (OOM interceptions, fallback triggering, eviction scores, and memory reclamation metrics).

---

## 2. Proposed Design & Architecture

```mermaid
flowchart TD
    subgraph PythonBackend["Python AI Backend (apps/ai-supervisor/python-backend)"]
        AdminService["AdminService (gRPC)"]
        Engines["TTS / LLM Engines"]
        CircuitBreaker["OOM Circuit Breaker ContextManager"]
        
        LifecycleMgr["ModelLifecycleManager"]
        Strategy["DeviceMemoryStrategy (CUDA / MPS / CPU)"]
        ModelEntries["ModelEntry (ReaderWriterLock + ModelState)"]
        TelemetryAudit["TelemetryAuditRingBuffer (Last 100 Events)"]
        
        Engines --> CircuitBreaker
        CircuitBreaker --> LifecycleMgr
        LifecycleMgr --> ModelEntries
        LifecycleMgr --> Strategy
        LifecycleMgr --> TelemetryAudit
        AdminService --> LifecycleMgr
    end

    subgraph Supervisor["Supervisor Control Plane (Bun / Solid UI)"]
        SSEBroker["TelemetryEventBroker / SSE Stream"]
        AuditCard["Model Lifecycle & VRAM Audit UI"]
        Supervisor <--> AdminService
        SSEBroker --> AuditCard
    end
```

### Key Pillars:
1. **DeviceMemoryStrategy**: Polymorphic memory manager supporting NVIDIA CUDA (`torch.cuda`), Apple Silicon MPS (`torch.mps`), and host CPU/RAM fallback.
2. **ModelState & Concurrency**: Explicit state machine (`UNLOADED`, `LOADING`, `READY`, `EVICTING`, `ERROR`) protected by per-model Reader-Writer locks (`RWLock`), allowing multi-threaded read inference while guaranteeing exclusive eviction access.
3. **Compound Eviction Policy**: Multi-criteria weighted scoring combining:
   - **LRU**: Age since last accessed.
   - **Footprint**: Estimated VRAM footprint to maximize freed memory.
   - **Priority Tier**: Retention priority tier weights (e.g. LLM vs TTS).
4. **Dual-Response OOM Circuit Breaker**: Intercepts `OutOfMemoryError`, purges device caches, records an alert event in the telemetry audit buffer, and triggers zero-dependency fallback generation without crashing.
5. **Telemetry & Audit Ring Buffer**: Thread-safe in-memory circular audit buffer (default 100 events) exposed through `AdminService.GetVRAMStatus` and structured audit logs.

---

## 3. Acceptance Criteria
- [x] `DeviceMemoryStrategy` protocol implemented with concrete `CudaMemoryStrategy`, `MpsMemoryStrategy`, and `CpuMemoryStrategy`.
- [x] `ModelEntry` equipped with Reader-Writer lock (`RWLock`), explicit `ModelState`, priority tiers, and atomic access tracking.
- [x] Multi-criteria eviction policy implemented (LRU age + VRAM footprint + priority tier).
- [x] `OOM Circuit Breaker` implemented with automatic device cache purge, dual fallback response, and audit telemetry recording.
- [x] `ModelLifecycleManager` background thread refactored to use `threading.Event` with zero sleep blocking and clean shutdown integration in `server.py`.
- [x] In-memory telemetry audit buffer (100 events) tracking evictions, touches, OOM intercepts, and cache purges.
- [x] Comprehensive unit test suite (`apps/ai-supervisor/python-backend/tests/`) with 100% pass rate.
- [x] Full backward compatibility verified for gRPC `AdminService`, `TTSService`, and `LLMService`.
