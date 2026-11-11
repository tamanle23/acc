"""High-Throughput Adaptive Dynamic Micro-Batching Scheduler with Circuit Breaker, OOM Recovery & Backpressure (Studio v26)."""

from __future__ import annotations

import asyncio
import gc
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

try:
    import torch
except ImportError:
    torch = None  # type: ignore[assignment]

from core.exceptions import BackpressureQueueFullError
from core.protocols import BatchableEngine
from infrastructure.resilience import EngineCircuitBreaker, LatencyHistogram

logger = logging.getLogger(__name__)

TIn = TypeVar("TIn")
TOut = TypeVar("TOut")


def _is_cuda_oom_error(exc: BaseException) -> bool:
    if isinstance(exc, MemoryError):
        return True
    if torch is not None and hasattr(torch.cuda, "OutOfMemoryError"):
        if isinstance(exc, torch.cuda.OutOfMemoryError):
            return True
    msg = str(exc).lower()
    return "out of memory" in msg or "cuda error: out of memory" in msg


def _recover_cuda_oom() -> None:
    gc.collect()
    if torch is not None and torch.cuda.is_available():
        try:
            torch.cuda.empty_cache()
        except Exception:
            pass


@dataclass(slots=True)
class _BatchItem(Generic[TIn, TOut]):
    payload: TIn
    future: asyncio.Future[TOut]
    enqueued_at: float


class DynamicBatchScheduler(Generic[TIn, TOut]):
    """Collates concurrent single-item async requests into hardware-optimal micro-batches.

    Features:
    - Single-worker ThreadPoolExecutor per GPU/model instance to prevent CUDA context thrashing.
    - Non-blocking queue backpressure (`put_nowait` raising `BackpressureQueueFullError`).
    - Integrated `EngineCircuitBreaker` and `LatencyHistogram` (p50/p95/p99 + queue wait).
    - Automatic CUDA OOM cache recovery (`gc.collect()` + `torch.cuda.empty_cache()`).
    - Cancellation pruning: skips requests whose HTTP clients disconnected while queued.
    """

    def __init__(
        self,
        engine: BatchableEngine[TIn, TOut],
        max_batch_size: int = 16,
        max_wait_ms: float = 15.0,
        max_queue_size: int = 512,
        failure_threshold: int = 5,
        recovery_timeout_sec: float = 15.0,
    ) -> None:
        self._engine = engine
        self._max_batch_size = max(1, int(max_batch_size))
        self._max_wait_sec = max(0.001, float(max_wait_ms) / 1000.0)
        self._max_queue_size = max(1, int(max_queue_size))
        self._queue: asyncio.Queue[_BatchItem[TIn, TOut]] = asyncio.Queue(
            maxsize=self._max_queue_size
        )
        self._executor = ThreadPoolExecutor(
            max_workers=1,
            thread_name_prefix=f"worker-{engine.engine_id}",
        )
        self._circuit = EngineCircuitBreaker(
            name=engine.engine_id,
            failure_threshold=failure_threshold,
            recovery_timeout_sec=recovery_timeout_sec,
        )
        self._metrics = LatencyHistogram()
        self._worker_task: asyncio.Task[None] | None = None
        self._bound_loop: asyncio.AbstractEventLoop | None = None
        self._running = False

    @property
    def circuit_breaker(self) -> EngineCircuitBreaker:
        return self._circuit

    def metrics_snapshot(self) -> dict[str, Any]:
        return {
            "queue_depth": self._queue.qsize(),
            "max_queue_size": self._max_queue_size,
            "max_batch_size": self._max_batch_size,
            "max_wait_ms": round(self._max_wait_sec * 1000.0, 2),
            "circuit_breaker": self._circuit.snapshot(),
            "latency": self._metrics.snapshot(),
        }

    def _ensure_loop_bound(self) -> asyncio.AbstractEventLoop:
        loop = asyncio.get_running_loop()
        try:
            from infrastructure.gpu_worker_bridge import set_active_loop
            set_active_loop(loop)
        except Exception:
            pass
        if self._running and (
            self._bound_loop is not loop
            or self._worker_task is None
            or self._worker_task.done()
        ):
            if self._bound_loop is not loop:
                old_queue = self._queue
                self._queue = asyncio.Queue(maxsize=self._max_queue_size)
                while not old_queue.empty():
                    try:
                        item = old_queue.get_nowait()
                        if not item.future.done():
                            self._queue.put_nowait(item)
                    except Exception:
                        break
            self._bound_loop = loop
            self._worker_task = loop.create_task(
                self._batch_loop(), name=f"batch-loop-{self._engine.engine_id}"
            )
        return loop

    async def start(self) -> None:
        self._running = True
        self._ensure_loop_bound()

    async def stop(self) -> None:
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        self._executor.shutdown(wait=True)

    async def submit(self, payload: TIn) -> TOut:
        """Check circuit breaker, enqueue request with bounded backpressure, and await result."""
        self._circuit.ensure_allow_request()
        loop = self._ensure_loop_bound()
        future: asyncio.Future[TOut] = loop.create_future()
        item = _BatchItem(payload=payload, future=future, enqueued_at=time.perf_counter())

        try:
            self._queue.put_nowait(item)
        except asyncio.QueueFull as exc:
            raise BackpressureQueueFullError(
                f"Scheduler queue for '{self._engine.engine_id}' is full ({self._max_queue_size} items)."
            ) from exc

        return await future

    async def _batch_loop(self) -> None:
        loop = asyncio.get_running_loop()
        while self._running:
            try:
                first_item = await self._queue.get()
            except asyncio.CancelledError:
                break

            batch: list[_BatchItem[TIn, TOut]] = [first_item]
            deadline = loop.time() + self._max_wait_sec

            while len(batch) < self._max_batch_size:
                timeout = deadline - loop.time()
                if timeout <= 0:
                    break
                try:
                    next_item = await asyncio.wait_for(self._queue.get(), timeout=timeout)
                    batch.append(next_item)
                except TimeoutError:
                    break

            # Filter out cancelled futures (e.g., client disconnected before batch fired)
            active_batch = [item for item in batch if not item.future.cancelled()]
            if not active_batch:
                for _ in batch:
                    self._queue.task_done()
                continue

            now_perf = time.perf_counter()
            avg_wait_ms = (
                sum((now_perf - item.enqueued_at) * 1000.0 for item in active_batch)
                / len(active_batch)
            )
            payloads = [item.payload for item in active_batch]
            t0 = time.perf_counter()
            try:
                from infrastructure.gpu_worker_bridge import get_gpu_worker_bridge

                get_gpu_worker_bridge().set_loop(loop)
                results = await loop.run_in_executor(
                    self._executor,
                    self._engine.infer_batch,
                    payloads,
                )
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                self._circuit.record_success()
                self._metrics.record_batch(
                    elapsed_ms, len(active_batch), avg_queue_wait_ms=avg_wait_ms
                )

                for item, result in zip(active_batch, results, strict=True):
                    if not item.future.done():
                        item.future.set_result(result)
            except Exception as exc:
                is_oom = _is_cuda_oom_error(exc)
                if is_oom:
                    logger.error(
                        "CUDA/Memory OOM detected on engine '%s'; clearing caches.",
                        self._engine.engine_id,
                    )
                    _recover_cuda_oom()
                self._circuit.record_failure(reason=str(exc), is_oom=is_oom)
                logger.exception("Batch inference failed on engine %s", self._engine.engine_id)
                for item in active_batch:
                    if not item.future.done():
                        item.future.set_exception(exc)
            finally:
                for _ in batch:
                    self._queue.task_done()
