"""Enterprise Resilience Primitives: Circuit Breaker & Sliding-Window Telemetry (Studio v26)."""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any

from core.exceptions import CircuitBreakerOpenError


class EngineCircuitBreaker:
    """Thread-safe state-machine circuit breaker (CLOSED -> OPEN -> HALF_OPEN) protecting GPU/CPU engines.

    Features:
    - Half-open probe gating (`half_open_max_calls`) to prevent thundering-herd recovery storms.
    - Tracks `last_failure_reason`, `total_trips`, and `oom_recoveries`.
    - Supports explicit `reset()` for operator/UI circuit recovery.
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout_sec: float = 15.0,
        half_open_max_calls: int = 1,
    ) -> None:
        self.name = name
        self.failure_threshold = max(1, int(failure_threshold))
        self.recovery_timeout_sec = max(0.01, float(recovery_timeout_sec))
        self.half_open_max_calls = max(1, int(half_open_max_calls))
        self._lock = threading.Lock()
        self._failure_count = 0
        self._state = "CLOSED"
        self._opened_at: float = 0.0
        self._half_open_in_flight = 0
        self._total_trips = 0
        self._oom_recoveries = 0
        self._last_failure_reason: str | None = None

    @property
    def state(self) -> str:
        with self._lock:
            if self._state == "OPEN":
                if (time.monotonic() - self._opened_at) >= self.recovery_timeout_sec:
                    self._state = "HALF_OPEN"
                    self._half_open_in_flight = 0
            return self._state

    def ensure_allow_request(self) -> None:
        with self._lock:
            if self._state == "OPEN":
                elapsed = time.monotonic() - self._opened_at
                if elapsed >= self.recovery_timeout_sec:
                    self._state = "HALF_OPEN"
                    self._half_open_in_flight = 0
                else:
                    retry_after = max(0.1, round(self.recovery_timeout_sec - elapsed, 2))
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker for '{self.name}' is OPEN. Retry after {retry_after}s."
                    )

            if self._state == "HALF_OPEN":
                if self._half_open_in_flight >= self.half_open_max_calls:
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker for '{self.name}' is HALF_OPEN (recovery probe in progress)."
                    )
                self._half_open_in_flight += 1

    def record_success(self) -> None:
        with self._lock:
            self._failure_count = 0
            self._half_open_in_flight = 0
            self._state = "CLOSED"
            self._last_failure_reason = None

    def record_failure(self, reason: str | None = None, is_oom: bool = False) -> None:
        with self._lock:
            self._failure_count += 1
            self._half_open_in_flight = max(0, self._half_open_in_flight - 1)
            if reason:
                self._last_failure_reason = str(reason)[:240]
            if is_oom:
                self._oom_recoveries += 1
            if self._state == "HALF_OPEN" or self._failure_count >= self.failure_threshold:
                if self._state != "OPEN":
                    self._total_trips += 1
                self._state = "OPEN"
                self._opened_at = time.monotonic()

    def reset(self) -> dict[str, Any]:
        with self._lock:
            self._failure_count = 0
            self._half_open_in_flight = 0
            self._state = "CLOSED"
            self._opened_at = 0.0
            self._last_failure_reason = None
        return self.snapshot()

    def snapshot(self) -> dict[str, Any]:
        current_state = self.state
        with self._lock:
            retry_after_sec = (
                max(0.0, round(self.recovery_timeout_sec - (time.monotonic() - self._opened_at), 2))
                if current_state == "OPEN"
                else 0.0
            )
            return {
                "name": self.name,
                "state": current_state,
                "consecutive_failures": self._failure_count,
                "failure_threshold": self.failure_threshold,
                "recovery_timeout_sec": self.recovery_timeout_sec,
                "retry_after_sec": retry_after_sec,
                "total_trips": self._total_trips,
                "oom_recoveries": self._oom_recoveries,
                "last_failure_reason": self._last_failure_reason,
            }


class LatencyHistogram:
    """Bounded sliding window tracker computing p50, p95, p99, average latencies, and queue wait times."""

    def __init__(self, window_size: int = 256) -> None:
        self._samples: deque[float] = deque(maxlen=window_size)
        self._queue_wait_samples: deque[float] = deque(maxlen=window_size)
        self._total_requests = 0
        self._total_batches = 0

    def record_batch(
        self,
        latency_ms: float,
        batch_size: int,
        avg_queue_wait_ms: float = 0.0,
    ) -> None:
        self._samples.append(max(0.0, float(latency_ms)))
        self._queue_wait_samples.append(max(0.0, float(avg_queue_wait_ms)))
        self._total_requests += int(batch_size)
        self._total_batches += 1

    def snapshot(self) -> dict[str, Any]:
        if not self._samples:
            return {
                "total_requests": self._total_requests,
                "total_batches": self._total_batches,
                "avg_ms": 0.0,
                "p50_ms": 0.0,
                "p95_ms": 0.0,
                "p99_ms": 0.0,
                "queue_wait_p95_ms": 0.0,
            }
        sorted_samples = sorted(self._samples)
        n = len(sorted_samples)
        p50 = sorted_samples[int(0.50 * (n - 1))]
        p95 = sorted_samples[int(0.95 * (n - 1))]
        p99 = sorted_samples[int(0.99 * (n - 1))]
        avg_ms = sum(sorted_samples) / n

        qw_p95 = 0.0
        if self._queue_wait_samples:
            sorted_qw = sorted(self._queue_wait_samples)
            qw_p95 = sorted_qw[int(0.95 * (len(sorted_qw) - 1))]

        return {
            "total_requests": self._total_requests,
            "total_batches": self._total_batches,
            "avg_ms": round(avg_ms, 2),
            "p50_ms": round(p50, 2),
            "p95_ms": round(p95, 2),
            "p99_ms": round(p99, 2),
            "queue_wait_p95_ms": round(qw_p95, 2),
        }
