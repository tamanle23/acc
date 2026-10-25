import time
import threading
from collections import deque
from enum import Enum
from typing import Any, Dict, List, Optional


class ModelState(str, Enum):
    """
    Explicit lifecycle states for AI models in the supervisor.
    """
    UNLOADED = "UNLOADED"
    LOADING = "LOADING"
    READY = "READY"
    EVICTING = "EVICTING"
    ERROR = "ERROR"


class RWLock:
    """
    Reader-Writer Lock allowing concurrent readers (inference execution)
    while requiring an exclusive writer lock for model unloading/eviction.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._read_ready = threading.Condition(self._lock)
        self._readers = 0
        self._writer = False
        self._waiting_writers = 0

    def acquire_read(self, timeout: Optional[float] = None) -> bool:
        start_time = time.time()
        with self._lock:
            while self._writer or self._waiting_writers > 0:
                remaining = None if timeout is None else max(0.0, timeout - (time.time() - start_time))
                if timeout is not None and remaining <= 0:
                    return False
                if not self._read_ready.wait(remaining):
                    return False
            self._readers += 1
            return True

    def release_read(self) -> None:
        with self._lock:
            self._readers -= 1
            if self._readers == 0:
                self._read_ready.notify_all()

    def acquire_write(self, timeout: Optional[float] = None) -> bool:
        start_time = time.time()
        with self._lock:
            self._waiting_writers += 1
            try:
                while self._writer or self._readers > 0:
                    remaining = None if timeout is None else max(0.0, timeout - (time.time() - start_time))
                    if timeout is not None and remaining <= 0:
                        return False
                    if not self._read_ready.wait(remaining):
                        return False
                self._writer = True
                return True
            finally:
                self._waiting_writers -= 1

    def release_write(self) -> None:
        with self._lock:
            self._writer = False
            self._read_ready.notify_all()


class TelemetryAuditBuffer:
    """
    Thread-safe in-memory ring buffer tracking model lifecycle, eviction,
    and OOM events for supervisor audit and telemetry streams.
    """

    def __init__(self, capacity: int = 100):
        self.capacity = capacity
        self._buffer: deque = deque(maxlen=capacity)
        self._lock = threading.Lock()

    def record_event(self, event_type: str, model_name: str, details: Optional[Dict[str, Any]] = None) -> None:
        event = {
            "timestamp": time.time(),
            "event_type": event_type,
            "model_name": model_name,
            "details": details or {},
        }
        with self._lock:
            self._buffer.append(event)

    def get_recent_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            events = list(self._buffer)
        return events[-limit:]
