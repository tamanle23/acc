"""High-Throughput Asynchronous Inference Job Manager with W3C Server-Sent Events (SSE) (Pattern 2).

Provides:
- Non-blocking job submission returning HTTP 202 Accepted.
- Real-time SSE streaming (`text/event-stream`) for zero-polling lifecycle events:
  - `event: queued` (queue position, wait time)
  - `event: started` (worker device, allocated VRAM)
  - `event: progress` (step counter, completion percentage, stage descriptor)
  - `event: completed` (final synthesized output payload, latency, resource telemetry)
  - `event: failed` (RFC 7807 problem details)
  - `event: cancelled` (cooperative cancellation broadcast)
- Ring-buffer event history per job to support monotonic replay via `Last-Event-ID`.
- Cooperative cancellation token propagation (`asyncio.Event`) to halt running GPU/CPU workloads.
- Periodic heartbeat keep-alive comments (`: ping\n\n`) to prevent proxy/NAT dropouts.
- Durable persistence integration with `SqliteTelemetryStore` (WAL mode).
- Automatic TTL pruning of completed in-memory subscriber queues.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable, Coroutine

from infrastructure.sqlite_telemetry_store import SqliteTelemetryStore

logger = logging.getLogger("inference.jobs")


@dataclass
class JobState:
    job_id: str
    engine_id: str
    pipeline_type: str
    inputs: Any
    parameters: dict[str, Any]
    priority: int = 1
    tags: list[str] = field(default_factory=list)
    status: str = "queued"  # queued, running, completed, failed, cancelled
    created_at: float = field(default_factory=time.time)
    started_at: float | None = None
    completed_at: float | None = None
    latency_ms: float = 0.0
    progress: dict[str, Any] = field(default_factory=lambda: {"step": 0, "total_steps": 1, "percent": 0.0, "stage": "queued"})
    result: Any | None = None
    error: dict[str, Any] | None = None
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    next_seq: int = 1
    event_history: deque[dict[str, Any]] = field(default_factory=lambda: deque(maxlen=128))
    subscribers: set[asyncio.Queue[dict[str, Any] | None]] = field(default_factory=set)

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "engine_id": self.engine_id,
            "pipeline_type": self.pipeline_type,
            "status": self.status,
            "priority": self.priority,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "latency_ms": self.latency_ms,
            "inputs": self.inputs,
            "parameters": self.parameters,
            "progress": self.progress,
            "result": self.result,
            "error": self.error,
            "tags": self.tags,
            "events_url": f"/v1/jobs/{self.job_id}/events",
            "status_url": f"/v1/jobs/{self.job_id}",
        }


ExecuteJobFn = Callable[[JobState], Coroutine[Any, Any, Any]]


class InferenceJobManager:
    """Enterprise Asynchronous Background Job Manager with SSE Push Broadcasting."""

    def __init__(
        self,
        telemetry_store: SqliteTelemetryStore,
        execute_fn: ExecuteJobFn | None = None,
        max_workers: int = 2,
        history_ttl_sec: float = 1800.0,
    ) -> None:
        self._store = telemetry_store
        self._execute_fn = execute_fn
        self._max_workers = max_workers
        self._history_ttl_sec = history_ttl_sec

        self._jobs: dict[str, JobState] = {}
        self._lock: asyncio.Lock | None = None
        self._queue: asyncio.PriorityQueue[tuple[int, float, str]] | None = None
        self._worker_tasks: list[asyncio.Task] = []
        self._janitor_task: asyncio.Task | None = None
        self._bound_loop: asyncio.AbstractEventLoop | None = None
        self._running = False

    def _ensure_loop_bound(self) -> asyncio.AbstractEventLoop:
        loop = asyncio.get_running_loop()
        needs_init = (
            self._bound_loop is not loop
            or self._lock is None
            or self._queue is None
            or not self._worker_tasks
            or any(t.done() for t in self._worker_tasks)
        )
        if self._running and needs_init:
            if self._bound_loop is not loop or self._queue is None:
                self._lock = asyncio.Lock()
                old_queue = self._queue
                self._queue = asyncio.PriorityQueue()
                if old_queue is not None:
                    while not old_queue.empty():
                        try:
                            item = old_queue.get_nowait()
                            self._queue.put_nowait(item)
                        except Exception:
                            break
                # Re-bind cancel_event on active jobs if needed
                for job in self._jobs.values():
                    if job.status in ("queued", "running"):
                        is_set = job.cancel_event.is_set()
                        job.cancel_event = asyncio.Event()
                        if is_set:
                            job.cancel_event.set()

            self._bound_loop = loop
            self._worker_tasks = [
                loop.create_task(self._worker_loop(i), name=f"job-worker-{i}")
                for i in range(self._max_workers)
            ]
            self._janitor_task = loop.create_task(self._janitor_loop(), name="job-janitor")
        elif self._lock is None:
            self._lock = asyncio.Lock()
            self._queue = asyncio.PriorityQueue()
            self._bound_loop = loop
        return loop

    async def start(self) -> None:
        """Start background queue workers and cleanup janitor."""
        if not self._running:
            self._running = True
            reconciled = self._store.reconcile_stale_jobs()
            if reconciled > 0:
                logger.info("Reconciled %d orphaned jobs from previous server run to failed state.", reconciled)

        self._ensure_loop_bound()
        logger.info("InferenceJobManager started with %d workers.", self._max_workers)

    async def stop(self) -> None:
        """Gracefully stop background workers and notify active subscribers."""
        if not self._running:
            return
        self._running = False

        for task in self._worker_tasks:
            task.cancel()
        if self._janitor_task:
            self._janitor_task.cancel()

        self._worker_tasks.clear()
        self._janitor_task = None

        # Notify any remaining subscribers with shutdown
        if self._lock is not None:
            async with self._lock:
                for job in self._jobs.values():
                    for sub in list(job.subscribers):
                        try:
                            sub.put_nowait(None)
                        except Exception:
                            pass
                    job.subscribers.clear()

        logger.info("InferenceJobManager stopped.")

    def set_execute_fn(self, execute_fn: ExecuteJobFn) -> None:
        self._execute_fn = execute_fn

    async def submit_job(
        self,
        *,
        engine_id: str,
        pipeline_type: str,
        inputs: Any,
        parameters: dict[str, Any] | None = None,
        priority: int = 1,
        tags: list[str] | None = None,
    ) -> JobState:
        """Submit an asynchronous inference job returning JobState immediately."""
        self._ensure_loop_bound()
        assert self._lock is not None and self._queue is not None
        job_id = f"job_{uuid.uuid4().hex[:16]}"
        params = dict(parameters or {})
        tag_list = list(tags or [])

        job = JobState(
            job_id=job_id,
            engine_id=engine_id,
            pipeline_type=pipeline_type,
            inputs=inputs,
            parameters=params,
            priority=priority,
            tags=tag_list,
        )

        # 1. Persist to SQLite
        self._store.record_job_created(
            job_id=job_id,
            engine_id=engine_id,
            pipeline_type=pipeline_type,
            inputs=inputs,
            parameters=params,
            priority=priority,
            tags=tag_list,
        )

        async with self._lock:
            self._jobs[job_id] = job

        # 2. Emit initial queued event
        self.publish_event(
            job_id=job_id,
            event_type="queued",
            data={
                "job_id": job_id,
                "status": "queued",
                "queue_position": self._queue.qsize() + 1,
                "engine_id": engine_id,
                "pipeline_type": pipeline_type,
                "created_at": job.created_at,
            },
        )

        # 3. Enqueue for processing (priority inverse: lower number = higher priority)
        await self._queue.put((priority, job.created_at, job_id))
        logger.info("Submitted async job %s for engine '%s' (queue depth: %d)", job_id, engine_id, self._queue.qsize())
        return job

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        """Retrieve job state from memory or persistent SQLite fallback."""
        if job_id in self._jobs:
            return self._jobs[job_id].to_dict()
        return self._store.get_job(job_id)

    def list_jobs(
        self,
        *,
        status: str | None = None,
        engine_id: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List jobs using persistent SQLite store with optional filters."""
        return self._store.list_jobs(status=status, engine_id=engine_id, limit=limit)

    def cancel_job(self, job_id: str, reason: str = "Client requested cancellation") -> bool:
        """Signal cooperative cancellation to a queued or running job."""
        job = self._jobs.get(job_id)
        if not job:
            persisted = self._store.get_job(job_id)
            if persisted and persisted.get("status") in ("queued", "running"):
                self._store.record_job_cancelled(job_id, reason=reason)
                return True
            return False

        if job.status in ("completed", "failed", "cancelled"):
            return False

        job.status = "cancelled"
        job.completed_at = time.time()
        job.cancel_event.set()

        # Update SQLite
        self._store.record_job_cancelled(job_id, reason=reason, completed_at=job.completed_at)

        # Broadcast SSE event
        self.publish_event(
            job_id=job_id,
            event_type="cancelled",
            data={
                "job_id": job_id,
                "status": "cancelled",
                "reason": reason,
                "completed_at": job.completed_at,
            },
        )

        # Close all active subscribers for this job
        for sub in list(job.subscribers):
            try:
                sub.put_nowait(None)
            except Exception:
                pass
        job.subscribers.clear()

        logger.info("Cancelled job %s: %s", job_id, reason)
        return True

    def publish_event(self, job_id: str, event_type: str, data: dict[str, Any]) -> None:
        """Publish a typed Server-Sent Event to all active subscribers and append to ring buffer."""
        job = self._jobs.get(job_id)
        if not job:
            return

        seq = job.next_seq
        job.next_seq += 1

        envelope = {
            "id": seq,
            "event": event_type,
            "data": data,
            "timestamp": time.time(),
        }
        job.event_history.append(envelope)

        # Dispatch to all active subscriber queues
        dead_subs = []
        for q in job.subscribers:
            try:
                q.put_nowait(envelope)
            except asyncio.QueueFull:
                dead_subs.append(q)
            except Exception:
                dead_subs.append(q)

        for dead in dead_subs:
            job.subscribers.discard(dead)

    def emit_progress(
        self,
        job_id: str,
        *,
        step: int,
        total_steps: int,
        percent: float,
        stage: str = "",
        extra: dict[str, Any] | None = None,
    ) -> None:
        """Emit real-time progress update over SSE."""
        job = self._jobs.get(job_id)
        if not job or job.status != "running":
            return

        prog = {
            "job_id": job_id,
            "step": step,
            "total_steps": max(1, total_steps),
            "percent": round(max(0.0, min(100.0, float(percent))), 1),
            "stage": stage or "processing",
            **(extra or {}),
        }
        job.progress = prog
        self._store.update_job_progress(job_id, prog)

        self.publish_event(
            job_id=job_id,
            event_type="progress",
            data=prog,
        )

    async def subscribe_events(
        self,
        job_id: str,
        last_event_id: int | None = None,
    ) -> AsyncIterator[str]:
        """Async generator yielding SSE formatted text frames (`text/event-stream`).

        Supports:
        - `Last-Event-ID` playback from ring buffer for seamless reconnection.
        - Immediate final terminal event if job is already completed/failed.
        - Heartbeat ping comments every 15s to keep connections alive.
        """
        self._ensure_loop_bound()
        job = self._jobs.get(job_id)
        if not job:
            # Check SQLite
            persisted = self._store.get_job(job_id)
            if not persisted:
                yield "event: error\ndata: {\"message\": \"Job not found\"}\n\n"
                return

            # Already finished job from SQLite
            status = persisted.get("status")
            if status == "completed":
                yield f"id: 1\nevent: completed\ndata: {json.dumps(persisted, ensure_ascii=False)}\n\n"
            elif status == "cancelled":
                yield f"id: 1\nevent: cancelled\ndata: {json.dumps(persisted, ensure_ascii=False)}\n\n"
            else:
                yield f"id: 1\nevent: failed\ndata: {json.dumps(persisted, ensure_ascii=False)}\n\n"
            return

        sub_queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue(maxsize=256)
        job.subscribers.add(sub_queue)

        try:
            # Replay any missed events since last_event_id
            if last_event_id is not None:
                for past_ev in list(job.event_history):
                    if past_ev["id"] > last_event_id:
                        yield self._format_sse_frame(past_ev)
            else:
                # If no last_event_id, send current state snapshot event
                yield (
                    f"id: 0\n"
                    f"event: state\n"
                    f"data: {json.dumps({'job_id': job.job_id, 'status': job.status, 'progress': job.progress}, ensure_ascii=False)}\n\n"
                )

            # If job is already in a terminal state, emit terminal event and terminate SSE stream immediately
            if job.status in ("completed", "failed", "cancelled"):
                yield self._format_sse_frame(
                    {
                        "id": job.next_seq,
                        "event": job.status,
                        "data": job.to_dict(),
                    }
                )
                return

            # Stream real-time events until terminal event or disconnect
            while True:
                try:
                    envelope = await asyncio.wait_for(sub_queue.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep HTTP connection alive through reverse proxies
                    yield ": ping\n\n"
                    continue

                if envelope is None:
                    # End of stream signaled
                    break

                yield self._format_sse_frame(envelope)

                # Terminal event ends the SSE stream cleanly
                if envelope.get("event") in ("completed", "failed", "cancelled"):
                    break

        finally:
            job.subscribers.discard(sub_queue)

    @staticmethod
    def _format_sse_frame(envelope: dict[str, Any]) -> str:
        """Format an envelope into W3C Server-Sent Event standard string."""
        ev_id = envelope.get("id")
        ev_type = envelope.get("event", "message")
        data = envelope.get("data", {})
        data_str = json.dumps(data, ensure_ascii=False)
        lines = [f"id: {ev_id}", f"event: {ev_type}"]
        for d_line in data_str.split("\n"):
            lines.append(f"data: {d_line}")
        return "\n".join(lines) + "\n\n"

    async def _worker_loop(self, worker_id: int) -> None:
        """Background execution worker loop."""
        logger.info("Job worker #%d online.", worker_id)
        while self._running:
            try:
                priority, created_at, job_id = await self._queue.get()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error fetching job from queue: %s", e)
                await asyncio.sleep(0.1)
                continue

            job = self._jobs.get(job_id)
            if not job:
                self._queue.task_done()
                continue

            if job.status == "cancelled":
                self._queue.task_done()
                continue

            # Execute job
            t0 = time.perf_counter()
            job.status = "running"
            job.started_at = time.time()
            self._store.update_job_status(job_id, "running", started_at=job.started_at)

            self.publish_event(
                job_id=job_id,
                event_type="started",
                data={
                    "job_id": job_id,
                    "status": "running",
                    "started_at": job.started_at,
                    "worker_id": worker_id,
                    "engine_id": job.engine_id,
                },
            )

            try:
                if not self._execute_fn:
                    raise RuntimeError("No execution function registered on InferenceJobManager")

                # Run inference function
                result = await self._execute_fn(job)

                if job.cancel_event.is_set() or job.status == "cancelled":
                    # Was cancelled during execution
                    self._queue.task_done()
                    continue

                lat_ms = round((time.perf_counter() - t0) * 1000.0, 2)
                job.status = "completed"
                job.completed_at = time.time()
                job.latency_ms = lat_ms
                job.result = result
                job.progress = {"step": 1, "total_steps": 1, "percent": 100.0, "stage": "completed"}

                self._store.record_job_completed(job_id, result=result, latency_ms=lat_ms, completed_at=job.completed_at)

                self.publish_event(
                    job_id=job_id,
                    event_type="completed",
                    data={
                        "job_id": job_id,
                        "status": "completed",
                        "completed_at": job.completed_at,
                        "latency_ms": lat_ms,
                        "result": result,
                    },
                )
            except asyncio.CancelledError:
                # Server shutdown or worker cancelled
                job.status = "cancelled"
                job.completed_at = time.time()
                self._store.record_job_cancelled(job_id, reason="Server shutdown or worker cancelled")
                self.publish_event(job_id=job_id, event_type="cancelled", data={"job_id": job_id, "status": "cancelled"})
                break
            except Exception as exc:
                lat_ms = round((time.perf_counter() - t0) * 1000.0, 2)
                job.status = "failed"
                job.completed_at = time.time()
                job.latency_ms = lat_ms
                err_dict = {
                    "code": exc.__class__.__name__,
                    "message": str(exc),
                }
                job.error = err_dict
                self._store.record_job_failed(job_id, error=err_dict, latency_ms=lat_ms, completed_at=job.completed_at)
                self.publish_event(
                    job_id=job_id,
                    event_type="failed",
                    data={
                        "job_id": job_id,
                        "status": "failed",
                        "completed_at": job.completed_at,
                        "latency_ms": lat_ms,
                        "error": err_dict,
                    },
                )
                logger.error("Job %s failed on worker #%d: %s", job_id, worker_id, exc, exc_info=True)
            finally:
                self._queue.task_done()

    async def _janitor_loop(self) -> None:
        """Periodic loop to prune old in-memory job records exceeding history TTL."""
        while self._running:
            try:
                await asyncio.sleep(60.0)
                now = time.time()
                async with self._lock:
                    to_prune = []
                    for jid, job in self._jobs.items():
                        if job.status in ("completed", "failed", "cancelled") and job.completed_at:
                            if (now - job.completed_at) > self._history_ttl_sec:
                                to_prune.append(jid)
                    for jid in to_prune:
                        self._jobs.pop(jid, None)
                    if to_prune:
                        logger.debug("Janitor pruned %d old completed jobs from memory.", len(to_prune))
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in job janitor loop: %s", e)
